import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(
      "https://api.spotify.com/v1/me/playlists?limit=50",
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: await res.text() },
        { status: res.status }
      );
    }

    const data = (await res.json()) as {
      items: ({
        id: string;
        name: string;
        description: string | null;
        images: { url: string }[] | null;
        tracks: { total: number } | null;
        uri: string;
        owner: { display_name: string } | null;
      } | null)[];
    };

    const playlists = (data.items ?? [])
      .filter((p): p is NonNullable<typeof p> => p != null && !!p.id)
      .map((p) => {
        // Dev-mode Spotify may rename "tracks" to "items" inside playlist objects
        const tracksMeta = p.tracks ?? (p as Record<string, unknown>).items;
        const total =
          typeof tracksMeta === "object" && tracksMeta !== null
            ? (tracksMeta as { total?: number }).total ?? 0
            : 0;
        return {
          id: p.id,
          name: p.name ?? "Untitled",
          description: p.description,
          image: p.images?.[0]?.url ?? null,
          trackCount: total,
          uri: p.uri,
          owner: p.owner?.display_name ?? "Unknown",
        };
      });

    return NextResponse.json({ playlists });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
