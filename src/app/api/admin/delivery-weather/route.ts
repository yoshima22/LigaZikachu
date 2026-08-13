import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getAppSession } from "@/lib/session";
import { isStaff } from "@/lib/auth/permissions";

type WeatherPoint = { lat: number; lng: number };

const getWeather = unstable_cache(async (coordinateKey: string) => {
  const points = coordinateKey.split("|").map((pair) => pair.split(",").map(Number));
  const latitude = points.map(([lat]) => lat).join(",");
  const longitude = points.map(([, lng]) => lng).join(",");
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day",
    wind_speed_unit: "kmh",
    timezone: "auto",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    next: { revalidate: 900 },
  });
  if (!response.ok) throw new Error(`Clima indisponível (${response.status}).`);
  const payload = await response.json() as unknown;
  return Array.isArray(payload) ? payload : [payload];
}, ["delivery-weather-v1"], { revalidate: 900 });

export async function POST(request: NextRequest) {
  const session = await getAppSession().catch(() => null);
  if (!session?.user || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { points?: WeatherPoint[] } | null;
  const points = body?.points?.slice(0, 6) ?? [];
  if (!points.length || points.some((point) => !Number.isFinite(point.lat) || !Number.isFinite(point.lng) || Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180)) {
    return NextResponse.json({ error: "Coordenadas inválidas." }, { status: 400 });
  }
  const key = points.map((point) => `${point.lat.toFixed(2)},${point.lng.toFixed(2)}`).join("|");
  try {
    return NextResponse.json({ weather: await getWeather(key), cachedForSeconds: 900 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Clima indisponível." }, { status: 502 });
  }
}
