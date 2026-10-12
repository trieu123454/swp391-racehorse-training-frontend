import type { AuthResponse, AuthUser, RoleName } from "../lib/types";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  isRemembered,
  saveSession,
} from "../lib/session";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export const SESSION_EXPIRED_EVENT = "racehorse:session-expired";

function expiredSession(): ApiRequestError {
  clearSession();
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  return new ApiRequestError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type ApiError = {
  message?: string;
  error?: {
    message?: string;
    details?: unknown;
  };
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const multipart = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(multipart ? {} : { "Content-Type": "application/json" }),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    let error: ApiError = {};
    try {
      error = await response.json();
    } catch {
      error = { message: response.statusText };
    }

    const message = error.error?.message || error.message || "Request failed";
    let details = Array.isArray(error.error?.details)
      ? error.error.details
      ?.map((item) => [item.field, item.message].filter(Boolean).join(": "))
      .filter(Boolean)
      .join(" · ")
      : "";
    if (!details && error.error?.details && typeof error.error.details === "object") {
      const conflicts = (error.error.details as { conflicts?: { event_type?: string; event_date?: string; start_time?: string; end_time?: string; horse_name?: string }[] }).conflicts;
      if (conflicts?.length) {
        details = conflicts.map((item) => [item.event_type, item.horse_name, item.event_date, item.start_time && item.end_time ? `${item.start_time}–${item.end_time}` : "cả ngày"].filter(Boolean).join(" · ")).join("; ");
      }
    }
    throw new ApiRequestError(details ? `${message}: ${details}` : message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/** Use the current signed-in session for role-protected API endpoints. */
export async function authenticatedRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let accessToken = getAccessToken();
  if (!accessToken) {
    await validateSession();
    accessToken = getAccessToken();
  }
  if (!accessToken) {
    throw expiredSession();
  }
  const withToken = (token: string) => ({
    ...options,
    headers: { ...(options.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  try {
    return await request<T>(path, withToken(accessToken));
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401) throw error;
    try {
      await validateSession(true);
    } catch (refreshError) {
      if (refreshError instanceof ApiRequestError && [400, 401, 403].includes(refreshError.status)) {
        throw expiredSession();
      }
      throw refreshError;
    }
    const refreshed = getAccessToken();
    if (!refreshed) throw expiredSession();
    if (refreshed === accessToken) throw error;
    try {
      return await request<T>(path, withToken(refreshed));
    } catch (retryError) {
      if (retryError instanceof ApiRequestError && retryError.status === 401) throw expiredSession();
      throw retryError;
    }
  }
}

export function login(email: string, password: string) {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return request<AuthResponse>("/api/auth/change-password", {
    method: "POST",
    headers: { Authorization: `Bearer ${getAccessToken()}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function register(input: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  roleName: "HORSE_OWNER";
}) {
  return request<AuthUser>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function loginWithGoogle(idToken: string, roleName?: RoleName) {
  return request<AuthResponse>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken, roleName }),
  });
}

export function logout(refreshToken: string) {
  return request<{ message: string }>("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

let sessionCheck: Promise<AuthUser> | null = null;
const SESSION_CACHE_TTL_MS = 60_000;
let validatedSession: {
  accessToken: string | null;
  refreshToken: string | null;
  validatedAt: number;
  user: AuthUser;
} | null = null;

// Share validation across dashboard mounts (including React Strict Mode).
export function validateSession(force = false): Promise<AuthUser> {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  if (force) validatedSession = null;
  if (
    validatedSession &&
    Date.now() - validatedSession.validatedAt < SESSION_CACHE_TTL_MS &&
    validatedSession.accessToken === accessToken &&
    validatedSession.refreshToken === refreshToken
  ) {
    return Promise.resolve(validatedSession.user);
  }
  if (sessionCheck) return sessionCheck;
  sessionCheck = restoreSession()
    .then((user) => {
      validatedSession = {
        accessToken: getAccessToken(),
        refreshToken: getRefreshToken(),
        validatedAt: Date.now(),
        user,
      };
      return user;
    })
    .finally(() => {
      sessionCheck = null;
    });
  return sessionCheck;
}

async function restoreSession(): Promise<AuthUser> {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  const remember = isRemembered();
  try {
    if (accessToken) {
      try {
        return await request<AuthUser>("/api/auth/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch (error) {
        if (!(error instanceof ApiRequestError) || error.status !== 401)
          throw error;
      }
    }
    if (!refreshToken) throw new ApiRequestError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
    const auth = await request<AuthResponse>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
    saveSession(auth, remember);
    return auth.user;
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      [400, 401, 403].includes(error.status)
    )
      clearSession();
    throw error;
  }
}
