import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getAppSession } from "@/lib/session";
import { isStaff } from "@/lib/auth/permissions";

const roadRoute = unstable_cache(async (key: string) => {
  const [from, to] = key.split("|");
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${from};${to}?overview=full&geometries=geojson`, { next: { revalidate: 86400 } });
  if (!response.ok) return null;
  const data = await response.json() as { code?: string; routes?: Array<{ distance: number; geometry: { coordinates: [number, number][] } }> };
  const route = data.code === "Ok" ? data.routes?.[0] : null;
  if (!route) return null;
  const coordinates = route.geometry.coordinates;
  const stride = Math.max(1, Math.ceil(coordinates.length / 180));
  const sampled = coordinates.filter((_, index) => index % stride === 0);
  if (sampled[sampled.length - 1] !== coordinates[coordinates.length - 1]) sampled.push(coordinates[coordinates.length - 1]);
  return { distanceKm: route.distance / 1000, points: sampled.map(([lng, lat]) => ({ lat, lng })) };
}, ["delivery-road-v1"], { revalidate: 86400 });

export async function POST(request: NextRequest) {
  const session = await getAppSession().catch(() => null);
  if (!session?.user || !isStaff(session.user.role)) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  const body = await request.json().catch(() => null) as { origin?: { lat: number; lng: number }; destination?: { lat: number; lng: number } } | null;
  const a = body?.origin; const b = body?.destination;
  if (!a || !b || [a.lat, a.lng, b.lat, b.lng].some(value => !Number.isFinite(value))) return NextResponse.json({ error: "Coordenadas inválidas." }, { status: 400 });
  const key = `${a.lng.toFixed(5)},${a.lat.toFixed(5)}|${b.lng.toFixed(5)},${b.lat.toFixed(5)}`;
  const route = await roadRoute(key).catch(() => null);
  if (!route) return NextResponse.json({ error: "Não existe ligação terrestre entre estes pontos." }, { status: 422 });
  return NextResponse.json(route);
}
