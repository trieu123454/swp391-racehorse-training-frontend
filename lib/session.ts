"use client";

import type { AuthResponse, AuthUser } from "./types";

const ACCESS_TOKEN_KEY = "racehorse.accessToken";
const REFRESH_TOKEN_KEY = "racehorse.refreshToken";
const USER_KEY = "racehorse.user";

export function saveSession(auth: AuthResponse, remember = true) {
  clearSession();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(ACCESS_TOKEN_KEY, auth.accessToken);
  storage.setItem(REFRESH_TOKEN_KEY, auth.refreshToken);
  storage.setItem(USER_KEY, JSON.stringify(auth.user));
}

function read(key: string) {
  return sessionStorage.getItem(key) ?? localStorage.getItem(key);
}

export function isRemembered() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) !== null;
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

export function getAccessToken() {
  return read(ACCESS_TOKEN_KEY);
}

export function clearSession() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
    storage.removeItem(USER_KEY);
  }
}
