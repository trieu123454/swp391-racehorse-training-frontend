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
    public code?: string,
    public details?: unknown,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export const SESSION_EXPIRED_EVENT = "racehorse:session-expired";
export const APP_MUTATION_COMPLETED_EVENT = "racehorse:mutation-completed";
export const NOTIFICATION_COUNT_CHANGED_EVENT = "racehorse:notification-count-changed";
export const SWR_CACHE_UPDATED_EVENT = "racehorse:swr-updated";
const CROSS_TAB_MUTATION_CHANNEL = "racehorse:mutation-sync";
const TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const GET_FRESH_TTL_MS = 15_000;
const GET_STALE_TTL_MS = 300_000;
const GET_STORAGE_PREFIX = "racehorse:api-get:v2:";
type CacheEntry = { value: unknown; freshUntil: number; staleUntil: number };
const getResponseCache = new Map<string, CacheEntry>();
const inFlightGets = new Map<string, Promise<unknown>>();
let swrNotifyTimer: number | null = null;
const updatedGetPaths = new Set<string>();

function scheduleSwrNotify(path: string) {
  if (typeof window === "undefined") return;
  updatedGetPaths.add(path);
  if (swrNotifyTimer !== null) window.clearTimeout(swrNotifyTimer);
  swrNotifyTimer = window.setTimeout(() => {
    swrNotifyTimer = null;
    const paths = [...updatedGetPaths];
    updatedGetPaths.clear();
    window.dispatchEvent(new CustomEvent(SWR_CACHE_UPDATED_EVENT, { detail: { paths } }));
  }, 60);
}

export function clearApiGetCache(pathPrefix?: string) {
  const matches = (key: string) => !pathPrefix || key.slice(key.indexOf("|") + 1).startsWith(pathPrefix);
  for (const key of getResponseCache.keys()) if (matches(key)) getResponseCache.delete(key);
  for (const key of inFlightGets.keys()) if (matches(key)) inFlightGets.delete(key);
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && (k.startsWith(GET_STORAGE_PREFIX) || k.startsWith("racehorse:api-get:v1:")) && matches(k)) keys.push(k);
    }
    keys.forEach((k) => window.sessionStorage.removeItem(k));
  } catch { /* ignore storage errors */ }
}

function isCacheableGet(path: string, method: string, options: RequestInit): boolean {
  if (method.toUpperCase() !== "GET") return false;
  if (options.cache === "no-store" || options.signal) return false;
  if (path.startsWith("/api/auth/") || path.includes("/simulations")) return false;
  return true;
}

function readGetCache<T>(cacheKey: string, now: number): { value: T; isStale: boolean } | undefined {
  const mem = getResponseCache.get(cacheKey);
  if (mem && now < mem.staleUntil) {
    return { value: mem.value as T, isStale: now >= mem.freshUntil };
  }
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(GET_STORAGE_PREFIX + cacheKey);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (parsed && typeof parsed.staleUntil === "number" && now < parsed.staleUntil) {
      getResponseCache.set(cacheKey, parsed);
      return { value: parsed.value as T, isStale: now >= parsed.freshUntil };
    }
  } catch { /* ignore */ }
  return undefined;
}

function writeGetCache(cacheKey: string, value: unknown, now: number, path: string) {
  // Image URL endpoints sign the same object repeatedly. Reuse the URL for four
  // minutes so polling does not force the browser to download the image again.
  const freshTtl = /\/image(?:\?|$)/.test(path) ? 240_000 : GET_FRESH_TTL_MS;
  const entry: CacheEntry = {
    value,
    freshUntil: now + freshTtl,
    staleUntil: now + GET_STALE_TTL_MS,
  };
  getResponseCache.set(cacheKey, entry);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(GET_STORAGE_PREFIX + cacheKey, JSON.stringify(entry));
  } catch { /* ignore quota errors */ }
}

function handleCrossTabMutation(raw: unknown) {
  if (!raw || typeof raw !== "object") return;
  const payload = raw as { tabId?: unknown; path?: unknown; method?: unknown };
  if (payload.tabId === TAB_ID || typeof payload.path !== "string" || typeof payload.method !== "string") return;
  clearApiGetCache(payload.path.startsWith("/api/notifications/") ? "/api/notifications" : undefined);
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
    window.dispatchEvent(new CustomEvent(APP_MUTATION_COMPLETED_EVENT, {
      detail: { path: payload.path, method: payload.method, crossTab: true },
    }));
  }
}

if (typeof window !== "undefined") {
  try {
    const navEntry = window.performance?.getEntriesByType?.("navigation")?.[0] as { type?: string } | undefined;
    if (navEntry?.type === "reload") {
      clearApiGetCache();
    }
  } catch { /* ignore navigation timing errors */ }
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(CROSS_TAB_MUTATION_CHANNEL);
      channel.onmessage = (event) => handleCrossTabMutation(event.data);
    }
  } catch { /* ignore BroadcastChannel errors */ }
  try {
    window.addEventListener?.("storage", (event) => {
      if (event.key !== CROSS_TAB_MUTATION_CHANNEL || !event.newValue) return;
      try {
        handleCrossTabMutation(JSON.parse(event.newValue));
      } catch { /* ignore malformed cross-tab payload */ }
    });
  } catch { /* ignore storage listener errors */ }
}

function announceMutationCompleted(path: string, method: string) {
  const normalizedMethod = method.toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(normalizedMethod)) {
    clearApiGetCache(path.startsWith("/api/notifications/") ? "/api/notifications" : undefined);
  }
  if (typeof window === "undefined") return;
  if (["GET", "HEAD", "OPTIONS"].includes(normalizedMethod)) return;
  if (path.startsWith("/api/notifications/")) return;
  const detail = { path, method: normalizedMethod };
  window.dispatchEvent?.(new CustomEvent(APP_MUTATION_COMPLETED_EVENT, { detail }));
  const payload = { tabId: TAB_ID, path, method: normalizedMethod, ts: Date.now() };
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(CROSS_TAB_MUTATION_CHANNEL);
      channel.postMessage(payload);
      channel.close();
    }
  } catch { /* ignore BroadcastChannel errors */ }
  try {
    window.localStorage?.setItem(CROSS_TAB_MUTATION_CHANNEL, JSON.stringify(payload));
  } catch { /* ignore storage quota errors */ }
}

function expiredSession(): ApiRequestError {
  clearApiGetCache();
  clearSession();
  validatedSession = null;
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  return new ApiRequestError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
}

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");

type ApiErrorItem = { field?: string; message?: string };

type ApiError = {
  code?: string;
  message?: string;
  errors?: ApiErrorItem[];
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

function extractApiFieldErrors(error: ApiError): Record<string, string> | undefined {
  const items = Array.isArray(error.errors)
    ? error.errors
    : Array.isArray(error.error?.details)
      ? (error.error.details as ApiErrorItem[])
      : [];
  const mapped: Record<string, string> = {};
  for (const item of items) {
    if (item && typeof item.field === "string" && item.field && typeof item.message === "string" && item.message) {
      mapped[item.field] = item.message;
    }
  }
  return Object.keys(mapped).length > 0 ? mapped : undefined;
}

function extractApiErrorMessage(error: ApiError, statusText: string): string {
  const rawError = error.error;
  const message = (typeof rawError === "string" ? rawError : rawError?.message) || error.message || statusText || "Request failed";
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
  return details ? `${message}: ${details}` : message;
}

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
    throw new ApiRequestError(
      extractApiErrorMessage(error, response.statusText),
      response.status,
      error.error?.code ?? error.code,
      error.error?.details,
      extractApiFieldErrors(error),
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function sendFormDataWithProgress<T>(
  path: string,
  method: "POST" | "PATCH",
  formData: FormData,
  token: string,
  onUploadProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Đã hủy tải lên", "AbortError"));
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    signal?.addEventListener("abort", abort, { once: true });
    xhr.open(method, `${API_BASE_URL}${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.timeout = 90_000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onUploadProgress?.(Math.min(1, event.loaded / event.total));
      }
    };
    xhr.upload.onload = () => {
      onUploadProgress?.(1);
    };
    xhr.onloadend = () => {
      signal?.removeEventListener("abort", abort);
    };
    xhr.onerror = () => {
      reject(new ApiRequestError("Không kết nối được máy chủ. Vui lòng thử lại.", 0));
    };
    xhr.onabort = () => {
      reject(new DOMException("Đã hủy tải lên", "AbortError"));
    };
    xhr.ontimeout = () => {
      reject(new ApiRequestError("Tải hồ sơ quá thời gian chờ. Vui lòng thử lại.", 408));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (xhr.status === 204 || !xhr.responseText) {
          resolve(undefined as T);
          return;
        }
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new ApiRequestError("Phản hồi từ máy chủ không hợp lệ.", xhr.status));
        }
        return;
      }
      let parsed: ApiError = {};
      try {
        parsed = JSON.parse(xhr.responseText) as ApiError;
      } catch {
        parsed = { message: xhr.statusText };
      }
      reject(
        new ApiRequestError(
          extractApiErrorMessage(parsed, xhr.statusText),
          xhr.status,
          parsed.error?.code ?? parsed.code,
          parsed.error?.details,
          extractApiFieldErrors(parsed),
        ),
      );
    };
    xhr.send(formData);
  });
}

async function runWithAuthRetry<T>(
  execute: (token: string) => Promise<T>,
  path: string,
  method: string,
): Promise<T> {
  let accessToken = getAccessToken();
  if (!accessToken) {
    try {
      await validateSession();
    } catch (validationError) {
      if (validationError instanceof ApiRequestError && [400, 401, 403].includes(validationError.status)) {
        throw expiredSession();
      }
      throw validationError;
    }
    accessToken = getAccessToken();
  }
  if (!accessToken) {
    throw expiredSession();
  }
  if (!isRemembered() && accessTokenExpired(accessToken)) {
    throw expiredSession();
  }
  if (isRemembered() && accessTokenExpiresSoon(accessToken)) {
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
  try {
    const result = await execute(accessToken);
    announceMutationCompleted(path, method);
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
      const result = await execute(refreshed);
      announceMutationCompleted(path, method);
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

/** Use the current signed-in session for role-protected API endpoints. */
export async function authenticatedRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const canCache = isCacheableGet(path, method, options);
  const tokenPrefix = (getAccessToken() ?? "").slice(-16);
  const cacheKey = `${tokenPrefix}|${path}`;

  const fetchAndCache = (notifyOnUpdate: boolean): Promise<T> => {
    const existing = inFlightGets.get(cacheKey);
    if (existing) return existing as Promise<T>;
    const promise = runWithAuthRetry(
      (token) =>
        request<T>(path, {
          ...options,
          headers: { ...(options.headers ?? {}), Authorization: `Bearer ${token}` },
        }),
      path,
      method,
    ).then((result) => {
        // An intervening mutation/session change invalidates this response too.
        if (inFlightGets.get(cacheKey) === promise) {
          writeGetCache(cacheKey, result, Date.now(), path);
          if (notifyOnUpdate) scheduleSwrNotify(path);
        }
        return result;
      })
      .finally(() => {
        if (inFlightGets.get(cacheKey) === promise) inFlightGets.delete(cacheKey);
      });
    inFlightGets.set(cacheKey, promise);
    return promise;
  };

  if (canCache) {
    const cached = options.cache === "reload" ? undefined : readGetCache<T>(cacheKey, Date.now());
    if (cached !== undefined) {
      if (cached.isStale) {
        void fetchAndCache(true).catch(() => {});
      }
      return cached.value;
    }
    return fetchAndCache(false);
  }

  return runWithAuthRetry(
    (token) =>
      request<T>(path, {
        ...options,
        headers: { ...(options.headers ?? {}), Authorization: `Bearer ${token}` },
      }),
    path,
    method,
  );
}

/** Upload multipart FormData with real XHR upload progress tracking and auth retry. */
export async function authenticatedUploadWithProgress<T>(
  path: string,
  method: "POST" | "PATCH",
  formData: FormData,
  onUploadProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  return runWithAuthRetry(
    (token) => sendFormDataWithProgress<T>(path, method, formData, token, onUploadProgress, signal),
    path,
    method,
  );
}

export function login(email: string, password: string) {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return authenticatedRequest<AuthResponse>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function forgotPassword(email: string) {
  return request<{ message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(email: string, code: string, newPassword: string) {
  return request<{ message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, code, newPassword }),
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
const SESSION_CACHE_TTL_MS = 300_000;
let validatedSession: {
  accessToken: string | null;
  refreshToken: string | null;
  validatedAt: number;
  user: AuthUser;
} | null = null;

export function hasValidAccessToken(): boolean {
  const token = getAccessToken();
  return Boolean(token && !accessTokenExpiresSoon(token));
}

// Share validation across dashboard mounts (including React Strict Mode).
export function validateSession(force = false): Promise<AuthUser> {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  if (!accessToken && !refreshToken) {
    validatedSession = null;
    return Promise.reject(new ApiRequestError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401));
  }
  if (force) validatedSession = null;
  if (
    validatedSession &&
    accessToken &&
    !accessTokenExpiresSoon(accessToken) &&
    Date.now() - validatedSession.validatedAt < SESSION_CACHE_TTL_MS &&
    validatedSession.accessToken === accessToken &&
    validatedSession.refreshToken === refreshToken
  ) {
    return Promise.resolve(validatedSession.user);
  }
  if (sessionCheck) return sessionCheck;
  sessionCheck = restoreSession()
    .then((user) => {
      const latestAccess = getAccessToken();
      validatedSession = latestAccess
        ? {
            accessToken: latestAccess,
            refreshToken: getRefreshToken(),
            validatedAt: Date.now(),
            user,
          }
        : null;
      return user;
    })
    .finally(() => {
      sessionCheck = null;
    });
  return sessionCheck;
}

async function restoreSession(): Promise<AuthUser> {
  const remember = isRemembered();
  try {
    if (refreshAfterUnauthorizedCheck) {
      await refreshAfterUnauthorizedCheck;
      const refreshedAccessToken = getAccessToken();
      if (refreshedAccessToken && !accessTokenExpiresSoon(refreshedAccessToken)) {
        const user = await request<AuthUser>("/api/auth/me", {
          headers: { Authorization: `Bearer ${refreshedAccessToken}` },
        });
        if (!getAccessToken()) throw new ApiRequestError("Phiên đăng nhập đã kết thúc.", 401);
        return user;
      }
      if (!getAccessToken() && !getRefreshToken()) {
        throw new ApiRequestError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
      }
    }
    const accessToken = getAccessToken();
    if (accessToken && !accessTokenExpiresSoon(accessToken)) {
      try {
        const user = await request<AuthUser>("/api/auth/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!getAccessToken()) throw new ApiRequestError("Phiên đăng nhập đã kết thúc.", 401);
        return user;
      } catch (error) {
        if (!(error instanceof ApiRequestError) || error.status !== 401)
          throw error;
      }
    } else if (accessToken && !remember && !accessTokenExpired(accessToken)) {
      try {
        const user = await request<AuthUser>("/api/auth/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!getAccessToken()) throw new ApiRequestError("Phiên đăng nhập đã kết thúc.", 401);
        return user;
      } catch (error) {
        if (!(error instanceof ApiRequestError) || error.status !== 401)
          throw error;
      }
    }
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new ApiRequestError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
    const auth = await request<AuthResponse>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
    if (getRefreshToken() !== refreshToken) {
      throw new ApiRequestError("Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.", 401);
    }
    saveSession(auth, remember);
    return auth.user;
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      [400, 401, 403].includes(error.status)
    ) {
      clearSession();
      validatedSession = null;
      throw new ApiRequestError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
    }
    throw error;
  }
}

function tokenExpirationMs(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload || typeof atob !== "function") return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    const expiresAt = (JSON.parse(decoded) as { exp?: unknown }).exp;
    return typeof expiresAt === "number" ? expiresAt * 1000 : null;
  } catch {
    return null;
  }
}

function accessTokenExpired(token: string): boolean {
  const expMs = tokenExpirationMs(token);
  return expMs !== null && expMs <= Date.now();
}

function accessTokenExpiresSoon(token: string): boolean {
  const expMs = tokenExpirationMs(token);
  return expMs !== null && expMs <= Date.now() + 30_000;
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
