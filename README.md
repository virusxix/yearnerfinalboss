# Echo & Haze

Spotify-connected, immersive listening UI focused on one line of lyrics at a time, glassmorphism, and a personal **Journal** of captured moments (with optional weather via Open-Meteo).

## Tech stack

- **Next.js 14** (App Router) + React + TypeScript  
- **Tailwind CSS** + **Framer Motion**  
- **Zustand** (journal + UI, persisted in `localStorage`)  
- **Spotify** OAuth (server) + **Web Playback SDK** (browser player) + REST for control/seek  
- **LRCLIB** (via `/api/lyrics`) for synced/plain lyrics when available; poetic mock lines otherwise  
- **Open-Meteo** (via `/api/weather`) — no API key  

## Prerequisites

- Node.js 18+  
- Spotify account with **Premium** (required for Web Playback SDK in supported markets)  
- A Spotify app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
|----------|-------------|
| `SPOTIFY_CLIENT_ID` | From your Spotify app |
| `SPOTIFY_CLIENT_SECRET` | From your Spotify app (server only) |
| `SPOTIFY_REDIRECT_URI` | Must match the redirect URI in the dashboard exactly (default in example) |
| `NEXT_PUBLIC_APP_URL` | Base URL of the app (e.g. `http://localhost:3000` for local dev) |

### Spotify dashboard setup

1. Create an app and open **Settings**.  
2. Add **Redirect URI**: `http://localhost:3000/api/auth/spotify/callback` (or your production URL + `/api/auth/spotify/callback`).  
3. Save, then copy **Client ID** and **Client Secret** into `.env.local`.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Enter the Haze** to sign in with Spotify, then open the **player** at `/player` after OAuth completes.

```bash
npm run build
npm start
```

## Folder structure

```
yearnerfinalboss/
├── .env.example
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── src/
    ├── app/
    │   ├── api/
    │   │   ├── auth/
    │   │   │   ├── logout/route.ts
    │   │   │   ├── session/route.ts
    │   │   │   └── spotify/
    │   │   │       ├── route.ts          # OAuth start
    │   │   │       └── callback/route.ts
    │   │   ├── lyrics/route.ts           # LRCLIB proxy
    │   │   ├── spotify/
    │   │   │   ├── control/route.ts      # play/pause/seek/transfer
    │   │   │   ├── current/route.ts
    │   │   │   ├── me/route.ts
    │   │   │   ├── player/route.ts
    │   │   │   └── token/route.ts        # token for Web Playback SDK
    │   │   └── weather/route.ts
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx                      # Haze landing
    │   └── player/page.tsx               # Yearning Player (auth gate)
    ├── components/
    │   ├── FilmGrain.tsx
    │   ├── HazeLanding.tsx
    │   ├── JournalPanel.tsx
    │   ├── MeshGradient.tsx              # lazy-loaded canvas mesh
    │   └── YearningPlayer.tsx
    ├── hooks/useSpotifyWebPlayer.ts
    ├── lib/
    │   ├── cookies.ts
    │   ├── extractColors.ts
    │   ├── lyricSync.ts
    │   ├── session.ts
    │   └── spotify.ts
    └── store/useEchoStore.ts
```

## Using the player

1. After login, start playback in Spotify, then choose the **Echo & Haze** web player as the active device (Spotify Connect), or use the in-page controls once the SDK device is active.  
2. **Lyrics**: One line at a time; tap the line to save a **Journal** entry (song, artist, line, position, time, optional weather).  
3. **Journal** (top-right): timeline of saved moments; **Replay here** seeks and plays on the current web device when a device ID is available.  
4. **Controls**: Hover the bottom edge of the screen for play/pause, skip, and scrub.  

## Notes

- Lyrics depend on LRCLIB coverage; many tracks fall back to the built-in mock stanzas.  
- Web Playback SDK behavior and availability follow [Spotify’s platform rules](https://developer.spotify.com/documentation/web-playback-sdk).  
- For production, use HTTPS, set `secure` cookies appropriately, and rotate secrets. Consider upgrading Next.js to a release that includes current security patches (`npm audit` / Next security advisories).

## License

MIT (adjust as needed for your project).
