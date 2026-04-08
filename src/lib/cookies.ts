import { cookies } from "next/headers";

const ACCESS = "eh_spotify_access";
const REFRESH = "eh_spotify_refresh";
const EXPIRES = "eh_spotify_expires";
const SCOPE = "eh_spotify_scope";

export function setSpotifyCookies(
  accessToken: string,
  refreshToken: string,
  expiresInSec: number,
  scope?: string
) {
  const store = cookies();
  const maxAgeAccess = Math.max(60, expiresInSec - 60);
  const maxAgeRefresh = 60 * 60 * 24 * 365;

  store.set(ACCESS, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeAccess,
  });
  store.set(REFRESH, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeRefresh,
  });
  store.set(EXPIRES, String(Date.now() + expiresInSec * 1000), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeRefresh,
  });
  if (scope) {
    store.set(SCOPE, scope, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeRefresh,
    });
  }
}

export function clearSpotifyCookies() {
  const store = cookies();
  store.delete(ACCESS);
  store.delete(REFRESH);
  store.delete(EXPIRES);
  store.delete(SCOPE);
}
