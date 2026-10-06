"use client";

import type { AuthResponse, AuthUser } from "./types";

const ACCESS_TOKEN_KEY = "racehorse.accessToken";
const REFRESH_TOKEN_KEY = "racehorse.refreshToken";
const USER_KEY = "racehorse.user";
const REMEMBER_KEY = "racehorse.remember";
const LEGACY_SESSION_CLEARED_KEY = "racehorse.legacySessionCleared";
let transientLogoutToken: string | null = null;

function tabStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  const storage = window.sessionStorage;
  if (storage.getItem(LEGACY_SESSION_CLEARED_KEY) !== "true") {
    // Older builds kept one shared session in localStorage, which let one tab
    // overwrite or clear the credentials used by every other role tab.
    for (const key of [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]) {
      window.localStorage.removeItem(key);
    }
    storage.setItem(LEGACY_SESSION_CLEARED_KEY, "true");
  }
  return storage;
}

export function saveSession(auth: AuthResponse, remember = true) {
  clearSession();
  const storage = tabStorage();
  if (!storage) return;
  storage.setItem(ACCESS_TOKEN_KEY, auth.accessToken);
  if (remember) storage.setItem(REFRESH_TOKEN_KEY, auth.refreshToken);
  else {
    storage.removeItem(REFRESH_TOKEN_KEY);
    transientLogoutToken = auth.refreshToken;
  }
  storage.setItem(USER_KEY, JSON.stringify(auth.user));
  storage.setItem(REMEMBER_KEY, String(remember));
}

function read(key: string) {
  return tabStorage()?.getItem(key) ?? null;
}

export function isRemembered() {
  return read(REMEMBER_KEY) === "true";
}

export function getUser(): AuthUser | null {
  const raw = read(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    clearSession();
    return null;
  }
}

export function getRefreshToken() {
  return read(REFRESH_TOKEN_KEY);
}

export function getLogoutRefreshToken() {
  return read(REFRESH_TOKEN_KEY) ?? transientLogoutToken;
}

export function getAccessToken() {
  return read(ACCESS_TOKEN_KEY);
}

export function clearSession() {
  transientLogoutToken = null;
  const storage = tabStorage();
  if (!storage) return;
  storage.removeItem(ACCESS_TOKEN_KEY);
  storage.removeItem(REFRESH_TOKEN_KEY);
  storage.removeItem(USER_KEY);
  storage.removeItem(REMEMBER_KEY);
}
