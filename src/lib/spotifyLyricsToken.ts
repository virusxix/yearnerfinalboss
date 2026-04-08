/**
 * Exchanges the sp_dc cookie for an internal Spotify access token
 * that works with spclient.wg.spotify.com (lyrics, canvas, etc.)
 *
 * The sp_dc cookie is a long-lived session cookie from open.spotify.com.
 * It can be grabbed from the browser's dev tools after logging in.
 */

let cachedToken: string | null = null;
let cachedExpiry = 0;

export async function getSpotifyInternalToken(): Promise<string | null> {
  const spDc = process.env.SPOTIFY_SP_DC;
  if (!spDc) return null;

  if (cachedToken && Date.now() < cachedExpiry - 30_000) {
    return cachedToken;
  }

  try {
    const res = await fetch(
      "https://open.spotify.com/get_access_token?reason=transport&productType=web_player",
      {
        headers: {
          Cookie: `sp_dc=${spDc}`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      }
    );

    if (!res.ok) {
      console.log(`[SpotifyLyricsToken] Failed to get internal token: ${res.status}`);
      cachedToken = null;
      return null;
    }

    const data = (await res.json()) as {
      accessToken?: string;
      accessTokenExpirationTimestampMs?: number;
      isAnonymous?: boolean;
    };

    if (!data.accessToken || data.isAnonymous) {
      console.log("[SpotifyLyricsToken] Got anonymous token — sp_dc cookie may be expired");
      cachedToken = null;
      return null;
    }

    cachedToken = data.accessToken;
    cachedExpiry = data.accessTokenExpirationTimestampMs ?? Date.now() + 3600_000;
    console.log("[SpotifyLyricsToken] ✓ Internal token obtained, expires in",
      Math.round((cachedExpiry - Date.now()) / 60_000), "min");
    return cachedToken;
  } catch (e) {
    console.log("[SpotifyLyricsToken] Error:", e);
    cachedToken = null;
    return null;
  }
}
