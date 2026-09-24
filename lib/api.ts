import type { AuthResponse, AuthUser, RoleName } from "./types";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  isRemembered,
  saveSession,
} from "./session";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type ApiError = {
  message?: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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

    throw new ApiRequestError(
      error.message || "Request failed",
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

export function login(email: string, password: string) {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(input: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  roleName: RoleName;
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

// Share validation across dashboard mounts (including React Strict Mode).
export function validateSession(): Promise<AuthUser> {
  if (sessionCheck) return sessionCheck;
  sessionCheck = restoreSession().finally(() => {
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
    if (!refreshToken) throw new ApiRequestError("Please sign in again", 401);
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
