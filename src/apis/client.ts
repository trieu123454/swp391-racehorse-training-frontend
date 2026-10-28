import type { AuthResponse, AuthUser, RoleName } from "../types/auth";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  isRemembered,
  saveSession,
} from "../stores/session";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export const SESSION_EXPIRED_EVENT = "racehorse:session-expired";
export const APP_MUTATION_COMPLETED_EVENT = "racehorse:mutation-completed";

function announceMutationCompleted(path: string, method: string) {
  if (typeof window === "undefined") return;
  const normalizedMethod = method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(normalizedMethod)) return;
  if (path.startsWith("/api/notifications/")) return;
  window.dispatchEvent(new CustomEvent(APP_MUTATION_COMPLETED_EVENT, {
    detail: { path, method: normalizedMethod },
  }));
}

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
  if (accessTokenExpiresSoon(accessToken)) {
    try {
      await refreshSession(accessToken);
    } catch (refreshError) {
      if (refreshError instanceof ApiRequestError && [400, 401, 403].includes(refreshError.status)) {
        throw expiredSession();
      }
      throw refreshError;
    }
    accessToken = getAccessToken();
    if (!accessToken) throw expiredSession();
  }
  const withToken = (token: string) => ({
    ...options,
    headers: { ...(options.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  try {
    const result = await request<T>(path, withToken(accessToken));
    announceMutationCompleted(path, options.method ?? "GET");
    return result;
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401) throw error;
    try {
      await refreshSession(accessToken);
    } catch (refreshError) {
      if (refreshError instanceof ApiRequestError && [400, 401, 403].includes(refreshError.status)) {
        throw expiredSession();
      }
      throw refreshError;
    }
    const refreshed = getAccessToken();
    if (!refreshed) throw expiredSession();
    try {
      const result = await request<T>(path, withToken(refreshed));
      announceMutationCompleted(path, options.method ?? "GET");
      return result;
    } catch (retryError) {
      // If a newly issued token is also rejected, this session belongs to a
      // different API instance or is no longer valid. Clear it and return to
      // login instead of leaving the owner stuck on repeated 401 responses.
      if (retryError instanceof ApiRequestError && retryError.status === 401) {
        throw expiredSession();
      }
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
let refreshAfterUnauthorizedCheck: Promise<void> | null = null;
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
    if (refreshAfterUnauthorizedCheck) {
      await refreshAfterUnauthorizedCheck;
      const refreshedAccessToken = getAccessToken();
      if (refreshedAccessToken) {
        return await request<AuthUser>("/api/auth/me", {
          headers: { Authorization: `Bearer ${refreshedAccessToken}` },
        });
      }
    }
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

function accessTokenExpiresSoon(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload || typeof atob !== "function") return false;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    const expiresAt = (JSON.parse(decoded) as { exp?: unknown }).exp;
    return typeof expiresAt === "number" && expiresAt * 1000 <= Date.now() + 30_000;
  } catch {
    return false;
  }
}

/** Refresh a stale credential once for all requests using it. */
function refreshSession(staleAccessToken: string): Promise<void> {
  const currentAccessToken = getAccessToken();
  // Another request may have refreshed the session while this request was in flight.
  if (currentAccessToken && currentAccessToken !== staleAccessToken) {
    return Promise.resolve();
  }
  if (refreshAfterUnauthorizedCheck) return refreshAfterUnauthorizedCheck;

  const refreshPromise = (async () => {
    // Let a session restore that was already running finish first. It may have
    // refreshed the same token, in which case there is no need to rotate it again.
    if (sessionCheck) await sessionCheck;
    const latestAccessToken = getAccessToken();
    if (latestAccessToken && latestAccessToken !== staleAccessToken) return;

    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new ApiRequestError("Refresh token is missing", 401);

    const remember = isRemembered();
    const auth = await request<AuthResponse>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
    // A logout or a new login may happen while refresh is in flight. Never let
    // an older response replace that newer session.
    if (getRefreshToken() === refreshToken) saveSession(auth, remember);
  })()
    .finally(() => {
      refreshAfterUnauthorizedCheck = null;
    });

  refreshAfterUnauthorizedCheck = refreshPromise;
  return refreshPromise;
}
