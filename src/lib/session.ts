import { cookies } from "next/headers";
import { refreshAccessToken } from "./spotify";

const ACCESS = "eh_spotify_access";
const REFRESH = "eh_spotify_refresh";
const EXPIRES = "eh_spotify_expires";
const SCOPE = "eh_spotify_scope";

function cookieStore() {
  return cookies();
}

export async function getValidAccessToken(): Promise<string | null> {
  const store = cookieStore();
  let access = store.get(ACCESS)?.value ?? null;
  const refresh = store.get(REFRESH)?.value ?? null;
  const expMs = store.get(EXPIRES)?.value;
  const expiresAt = expMs ? Number(expMs) : 0;

  if (access && expiresAt > Date.now() + 30_000) {
    return access;
  }
  if (!refresh) return access;

  try {
    const data = await refreshAccessToken(refresh);
    const newRefresh = data.refresh_token ?? refresh;
    const maxAgeAccess = Math.max(60, data.expires_in - 60);
    store.set(ACCESS, data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeAccess,
    });
    store.set(REFRESH, newRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    store.set(EXPIRES, String(Date.now() + data.expires_in * 1000), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    if (data.scope) {
      store.set(SCOPE, data.scope, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return data.access_token;
  } catch {
    return null;
  }
}
