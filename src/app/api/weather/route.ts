import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Open-Meteo current weather — no API key */
export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lon = req.nextUrl.searchParams.get("lon");
  const latitude = lat ? parseFloat(lat) : 40.7128;
  const longitude = lon ? parseFloat(lon) : -74.006;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m&timezone=auto`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) {
      return NextResponse.json({ summary: "unknown" });
    }
    const data = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        relative_humidity_2m?: number;
      };
    };
    const c = data.current;
    if (!c) return NextResponse.json({ summary: "unknown" });

    const codes: Record<number, string> = {
      0: "clear",
      1: "mainly clear",
      2: "partly cloudy",
      3: "overcast",
      45: "fog",
      48: "fog",
      51: "light drizzle",
      53: "drizzle",
      55: "heavy drizzle",
      61: "light rain",
      63: "rain",
      65: "heavy rain",
      71: "snow",
      73: "snow",
      75: "heavy snow",
      80: "rain showers",
      81: "rain showers",
      82: "violent rain showers",
      95: "thunderstorm",
    };
    const w = c.weather_code ?? -1;
    const label = codes[w] ?? "mixed";
    const summary = `${label}, ${Math.round(c.temperature_2m ?? 0)}°C`;
    return NextResponse.json({ summary, raw: c });
  } catch {
    return NextResponse.json({ summary: "unknown" });
  }
}
