"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, Polyline } from "leaflet";
import {
  Box,
  Bug,
  Clock3,
  Gauge,
  MapPin,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  Route,
  Sparkles,
  StepForward,
  Zap,
  Plane,
  Waves,
  Mountain,
  Home,
  Landmark,
  LocateFixed,
  X,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import styles from "./delivery-map-prototype.module.css";
import { DELIVERY_POIS, type DeliveryPoi, type DeliveryPoiType } from "./delivery-pois";

type MascotOption = {
  id: string;
  name: string;
  species: string;
  level: number;
  agility: number;
  force: number;
  instinct: number;
  vitality: number;
  types: string[];
  spriteUrl: string;
};

type Place = { id: string; name: string; state: string; country: string; region: string; lat: number; lng: number; port?: boolean };
type TripStatus = "READY" | "RUNNING" | "PAUSED" | "DELIVERED";
type RouteMode = "AIR" | "WATER" | "LAND";
type WeatherSnapshot = { current?: { temperature_2m: number; apparent_temperature: number; precipitation: number; weather_code: number; wind_speed_10m: number; wind_gusts_10m: number; is_day: number } };

const PLACES: Place[] = [
  { id: "manaus", name: "Manaus", state: "AM", country: "Brasil", region: "América do Sul", lat: -3.119, lng: -60.0217, port: true },
  { id: "belem", name: "Belém", state: "PA", country: "Brasil", region: "América do Sul", lat: -1.4558, lng: -48.4902, port: true },
  { id: "recife", name: "Recife", state: "PE", country: "Brasil", region: "América do Sul", lat: -8.0476, lng: -34.877, port: true },
  { id: "brasilia", name: "Brasília", state: "DF", country: "Brasil", region: "América do Sul", lat: -15.7939, lng: -47.8828 },
  { id: "rio", name: "Rio de Janeiro", state: "RJ", country: "Brasil", region: "América do Sul", lat: -22.9068, lng: -43.1729, port: true },
  { id: "sp", name: "São Paulo", state: "SP", country: "Brasil", region: "América do Sul", lat: -23.5505, lng: -46.6333 },
  { id: "buenosaires", name: "Buenos Aires", state: "", country: "Argentina", region: "América do Sul", lat: -34.6037, lng: -58.3816, port: true },
  { id: "santiago", name: "Santiago", state: "", country: "Chile", region: "América do Sul", lat: -33.4489, lng: -70.6693 },
  { id: "lima", name: "Lima", state: "", country: "Peru", region: "América do Sul", lat: -12.0464, lng: -77.0428, port: true },
  { id: "bogota", name: "Bogotá", state: "", country: "Colômbia", region: "América do Sul", lat: 4.711, lng: -74.0721 },
  { id: "mexico", name: "Cidade do México", state: "", country: "México", region: "América do Norte", lat: 19.4326, lng: -99.1332 },
  { id: "miami", name: "Miami", state: "FL", country: "EUA", region: "América do Norte", lat: 25.7617, lng: -80.1918, port: true },
  { id: "newyork", name: "Nova York", state: "NY", country: "EUA", region: "América do Norte", lat: 40.7128, lng: -74.006, port: true },
  { id: "losangeles", name: "Los Angeles", state: "CA", country: "EUA", region: "América do Norte", lat: 34.0522, lng: -118.2437, port: true },
  { id: "vancouver", name: "Vancouver", state: "BC", country: "Canadá", region: "América do Norte", lat: 49.2827, lng: -123.1207, port: true },
  { id: "lisbon", name: "Lisboa", state: "", country: "Portugal", region: "Europa", lat: 38.7223, lng: -9.1393, port: true },
  { id: "london", name: "Londres", state: "", country: "Reino Unido", region: "Europa", lat: 51.5072, lng: -0.1276 },
  { id: "paris", name: "Paris", state: "", country: "França", region: "Europa", lat: 48.8566, lng: 2.3522 },
  { id: "rome", name: "Roma", state: "", country: "Itália", region: "Europa", lat: 41.9028, lng: 12.4964 },
  { id: "cairo", name: "Cairo", state: "", country: "Egito", region: "África", lat: 30.0444, lng: 31.2357 },
  { id: "capetown", name: "Cidade do Cabo", state: "", country: "África do Sul", region: "África", lat: -33.9249, lng: 18.4241, port: true },
  { id: "nairobi", name: "Nairóbi", state: "", country: "Quênia", region: "África", lat: -1.2921, lng: 36.8219 },
  { id: "dubai", name: "Dubai", state: "", country: "Emirados Árabes", region: "Ásia", lat: 25.2048, lng: 55.2708, port: true },
  { id: "mumbai", name: "Mumbai", state: "", country: "Índia", region: "Ásia", lat: 19.076, lng: 72.8777, port: true },
  { id: "singapore", name: "Singapura", state: "", country: "Singapura", region: "Ásia", lat: 1.3521, lng: 103.8198, port: true },
  { id: "tokyo", name: "Tóquio", state: "", country: "Japão", region: "Ásia", lat: 35.6762, lng: 139.6503, port: true },
  { id: "seoul", name: "Seul", state: "", country: "Coreia do Sul", region: "Ásia", lat: 37.5665, lng: 126.978 },
  { id: "sydney", name: "Sydney", state: "NSW", country: "Austrália", region: "Oceania", lat: -33.8688, lng: 151.2093, port: true },
  { id: "auckland", name: "Auckland", state: "", country: "Nova Zelândia", region: "Oceania", lat: -36.8509, lng: 174.7645, port: true },
];

const REST_HUBS: Place[] = [
  { id: "rest-azores", name: "Ninho dos Açores", state: "", country: "Portugal", region: "Atlântico", lat: 37.7412, lng: -25.6756, port: true },
  { id: "rest-capeverde", name: "Pouso de Cabo Verde", state: "", country: "Cabo Verde", region: "Atlântico", lat: 14.933, lng: -23.5133, port: true },
  { id: "rest-canary", name: "Abrigo das Canárias", state: "", country: "Espanha", region: "Atlântico", lat: 28.2916, lng: -16.6291, port: true },
  { id: "rest-hawaii", name: "Estação de Honolulu", state: "HI", country: "EUA", region: "Pacífico", lat: 21.3099, lng: -157.8581, port: true },
  { id: "rest-fiji", name: "Refúgio de Fiji", state: "", country: "Fiji", region: "Pacífico", lat: -18.1248, lng: 178.4501, port: true },
  { id: "rest-panama", name: "Parada do Panamá", state: "", country: "Panamá", region: "América Central", lat: 8.9824, lng: -79.5199, port: true },
  { id: "rest-reykjavik", name: "Pouso de Reykjavik", state: "", country: "Islândia", region: "Atlântico Norte", lat: 64.1466, lng: -21.9426, port: true },
  { id: "rest-dakar", name: "Porto de Dakar", state: "", country: "Senegal", region: "África", lat: 14.7167, lng: -17.4677, port: true },
  { id: "rest-mauritius", name: "Abrigo de Maurício", state: "", country: "Maurício", region: "Índico", lat: -20.3484, lng: 57.5522, port: true },
  { id: "rest-colombo", name: "Estação de Colombo", state: "", country: "Sri Lanka", region: "Índico", lat: 6.9271, lng: 79.8612, port: true },
  { id: "rest-alaska", name: "Refúgio do Alasca", state: "AK", country: "EUA", region: "Pacífico Norte", lat: 61.2181, lng: -149.9003, port: true },
  { id: "rest-guam", name: "Pouso de Guam", state: "", country: "Guam", region: "Pacífico", lat: 13.4443, lng: 144.7937, port: true },
  { id: "rest-amazon", name: "Base Amazônica", state: "AM", country: "Brasil", region: "América do Sul", lat: -3.4653, lng: -62.2159, port: true },
  { id: "rest-andes", name: "Abrigo dos Andes", state: "", country: "Peru", region: "América do Sul", lat: -13.532, lng: -71.9675 },
  { id: "rest-patagonia", name: "Refúgio da Patagônia", state: "", country: "Argentina", region: "América do Sul", lat: -41.1335, lng: -71.3103 },
  { id: "rest-rockies", name: "Base das Montanhas Rochosas", state: "CO", country: "EUA", region: "América do Norte", lat: 39.7392, lng: -104.9903 },
  { id: "rest-yucatan", name: "Pouso de Yucatán", state: "", country: "México", region: "América do Norte", lat: 20.9674, lng: -89.5926, port: true },
  { id: "rest-greenland", name: "Abrigo da Groenlândia", state: "", country: "Groenlândia", region: "Atlântico Norte", lat: 64.1835, lng: -51.7216, port: true },
  { id: "rest-alps", name: "Estação dos Alpes", state: "", country: "Suíça", region: "Europa", lat: 46.8182, lng: 8.2275 },
  { id: "rest-balkans", name: "Pouso dos Bálcãs", state: "", country: "Croácia", region: "Europa", lat: 45.1, lng: 15.2, port: true },
  { id: "rest-sahara", name: "Oásis do Saara", state: "", country: "Argélia", region: "África", lat: 25.0, lng: 8.0 },
  { id: "rest-kilimanjaro", name: "Base Kilimanjaro", state: "", country: "Tanzânia", region: "África", lat: -3.0674, lng: 37.3556 },
  { id: "rest-madagascar", name: "Refúgio de Madagascar", state: "", country: "Madagascar", region: "Índico", lat: -18.8792, lng: 47.5079, port: true },
  { id: "rest-himalaya", name: "Abrigo do Himalaia", state: "", country: "Nepal", region: "Ásia", lat: 27.7172, lng: 85.324 },
  { id: "rest-borneo", name: "Estação de Bornéu", state: "", country: "Malásia", region: "Ásia", lat: 1.5535, lng: 110.3593, port: true },
  { id: "rest-okinawa", name: "Pouso de Okinawa", state: "", country: "Japão", region: "Pacífico", lat: 26.2124, lng: 127.6809, port: true },
  { id: "rest-perth", name: "Porto de Perth", state: "WA", country: "Austrália", region: "Oceania", lat: -31.9523, lng: 115.8613, port: true },
  { id: "rest-tasmania", name: "Refúgio da Tasmânia", state: "TAS", country: "Austrália", region: "Oceania", lat: -42.8821, lng: 147.3272, port: true },
];
const ALL_REST_HUBS: Place[] = [...REST_HUBS, ...DELIVERY_POIS.filter(poi => poi.type === "REST_POINT").map(poi => ({ id: poi.id, name: poi.name, state: "", country: poi.region, region: poi.region, lat: poi.lat, lng: poi.lng }))];

const ROUTE_INFO: Record<RouteMode, { label: string; icon: typeof Plane; types: string[]; bonus: number; color: string; description: string }> = {
  AIR: { label: "Rota aérea", icon: Plane, types: ["flying"], bonus: 0.22, color: "#a78bfa", description: "Voo direto entre origem e destino. Exclusiva para o tipo Voador; Agilidade aumenta a velocidade e vento, chuva ou tempestade podem atrasar o voo." },
  WATER: { label: "Rota marítima", icon: Waves, types: ["water"], bonus: 0.28, color: "#38bdf8", description: "Segue portos, ilhas e bases costeiras. Todos podem embarcar, mas somente Água recebe velocidade no mar; Gelo reduz parte da fadiga." },
  LAND: { label: "Rota terrestre", icon: Mountain, types: ["ground", "rock", "fighting", "grass", "normal"], bonus: 0.14, color: "#84cc16", description: "Procura ruas e estradas reais, evitando oceanos. Terra e Pedra são os mais rápidos; Lutador, Grama e Normal recebem bônus menor." },
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

function haversineKm(a: Place, b: Place) {
  const toRad = (value: number) => value * Math.PI / 180;
  const radius = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function selectRestStops(origin: Place, destination: Place, mode: RouteMode, directDistance: number) {
  if (mode === "AIR" || directDistance < 900) return [];
  const wanted = mode === "LAND" ? Math.min(3, Math.ceil(directDistance / 2800)) : Math.min(2, Math.ceil(directDistance / 4500));
  const candidates = mode === "WATER" ? ALL_REST_HUBS.filter((hub) => hub.port) : ALL_REST_HUBS;
  const selected: Place[] = [];
  for (let index = 1; index <= wanted; index += 1) {
    const ratio = index / (wanted + 1);
    const target: Place = { ...origin, id: "target", name: "", state: "", country: "", region: "", lat: origin.lat + (destination.lat - origin.lat) * ratio, lng: origin.lng + (destination.lng - origin.lng) * ratio };
    const best = candidates
      .filter((hub) => !selected.some((item) => item.id === hub.id))
      .map((hub) => ({ hub, score: haversineKm(target, hub) + (haversineKm(origin, hub) + haversineKm(hub, destination) - directDistance) * 0.35 }))
      .sort((a, b) => a.score - b.score)[0]?.hub;
    if (best) selected.push(best);
  }
  return selected.sort((a, b) => haversineKm(origin, a) - haversineKm(origin, b));
}

function pointAlongPath(path: Place[], ratio: number) {
  const segments = path.slice(0, -1).map((point, index) => ({ from: point, to: path[index + 1], distance: haversineKm(point, path[index + 1]) }));
  const total = segments.reduce((sum, segment) => sum + segment.distance, 0);
  let remaining = total * clamp(ratio);
  for (const segment of segments) {
    if (remaining <= segment.distance) {
      const local = segment.distance ? remaining / segment.distance : 0;
      return { lat: segment.from.lat + (segment.to.lat - segment.from.lat) * local, lng: segment.from.lng + (segment.to.lng - segment.from.lng) * local };
    }
    remaining -= segment.distance;
  }
  const last = path[path.length - 1];
  return { lat: last.lat, lng: last.lng };
}

function weatherLabel(code = 0) {
  if (code === 0) return "Céu limpo";
  if (code <= 3) return "Parcialmente nublado";
  if ([45, 48].includes(code)) return "Neblina";
  if (code >= 95) return "Tempestade";
  if (code >= 71 && code <= 86) return "Neve";
  if (code >= 51) return "Chuva";
  return "Tempo variável";
}

function formatDuration(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return `${whole}h${minutes ? ` ${minutes}min` : ""}`;
}

function formatDebugSeconds(seconds: number) {
  if (seconds <= 0) return "Concluída";
  return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
}

export function DeliveryMapPrototype({ mascots, initialHome }: { mascots: MascotOption[]; initialHome: { label: string; lat: number; lng: number } | null }) {
  const [mascotId, setMascotId] = useState(mascots[0]?.id ?? "");
  const [originId, setOriginId] = useState("sp");
  const [destinationId, setDestinationId] = useState("rio");
  const [cargoKg, setCargoKg] = useState(5);
  const [status, setStatus] = useState<TripStatus>("READY");
  const [progress, setProgress] = useState(0);
  const [debugSpeed, setDebugSpeed] = useState(1);
  const [simulatedAgility, setSimulatedAgility] = useState<number | null>(null);
  const [routeMode, setRouteMode] = useState<RouteMode>("LAND");
  const [home, setHome] = useState(initialHome);
  const [homeLabel, setHomeLabel] = useState(initialHome?.label ?? "Minha casa");
  const [homeSaving, setHomeSaving] = useState(false);
  const [roadRoute, setRoadRoute] = useState<{ points: Array<{ lat: number; lng: number }>; distanceKm: number } | null>(null);
  const [roadError, setRoadError] = useState<string | null>(null);
  const [roadLoading, setRoadLoading] = useState(false);
  const [poiVisibility, setPoiVisibility] = useState<Record<DeliveryPoiType, boolean>>({ LANDMARK: true, REST_POINT: true, MIAUVADAO_BRANCH: true, TRAPACA_HIDEOUT: false, SPECIAL_POI: false });
  const [selectedPoi, setSelectedPoi] = useState<DeliveryPoi | null>(null);
  const [mapZoom, setMapZoom] = useState(4);
  const [weatherEnabled, setWeatherEnabled] = useState(true);
  const [weather, setWeather] = useState<WeatherSnapshot[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const courierMarkerRef = useRef<Marker | null>(null);
  const routeRef = useRef<Polyline | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const progressRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const suppressNextFitRef = useRef(false);

  const mascot = mascots.find((item) => item.id === mascotId) ?? mascots[0];
  const availablePlaces = useMemo(() => home ? [...PLACES, { id: "home", name: home.label, state: "", country: "Casa do jogador", region: "Pessoal", lat: home.lat, lng: home.lng }] : PLACES, [home]);
  const origin = availablePlaces.find((item) => item.id === originId) ?? PLACES[5];
  const destination = availablePlaces.find((item) => item.id === destinationId) ?? PLACES[4];
  const agility = clamp(simulatedAgility ?? mascot?.agility ?? 0, 0, 250);
  const directDistance = useMemo(() => haversineKm(origin, destination), [origin, destination]);
  const restStops = useMemo(() => selectRestStops(origin, destination, routeMode, directDistance), [directDistance, destination, origin, routeMode]);
  const logicalRoutePoints = useMemo(() => routeMode === "AIR" ? [origin, destination] : [origin, ...restStops, destination], [destination, origin, restStops, routeMode]);
  const routePoints = useMemo(() => routeMode === "LAND" && roadRoute?.points?.length ? roadRoute.points.map((point, index) => ({ ...point, id: `road-${index}`, name: "Estrada", state: "", country: "", region: "Terrestre" })) : logicalRoutePoints, [logicalRoutePoints, roadRoute, routeMode]);
  const distanceKm = routeMode === "LAND" && roadRoute ? roadRoute.distanceKm : logicalRoutePoints.slice(0, -1).reduce((sum, point, index) => sum + haversineKm(point, logicalRoutePoints[index + 1]), 0);
  const agilityRatio = agility / 250;
  const loadPenalty = clamp((cargoKg - Math.min(30, (mascot?.force ?? 0) * 0.22)) / 100, 0, 0.32);
  const routeInfo = ROUTE_INFO[routeMode];
  const normalizedTypes = (mascot?.types ?? []).map((type) => type.toLowerCase());
  const routeAllowed = routeMode !== "AIR" || normalizedTypes.includes("flying");
  const hasAffinity = normalizedTypes.some((type) => routeInfo.types.includes(type));
  const landTypeBonus = normalizedTypes.some(type => ["ground", "rock"].includes(type)) ? 0.2 : normalizedTypes.some(type => ["fighting", "grass", "normal"].includes(type)) ? 0.1 : 0;
  const routeBonus = routeMode === "LAND" ? landTypeBonus : hasAffinity ? routeInfo.bonus : 0;
  const averageWeather = weather.length ? weather.reduce((sum, item) => sum + (item.current?.wind_speed_10m ?? 0), 0) / weather.length : 0;
  const precipitation = weather.length ? weather.reduce((sum, item) => sum + (item.current?.precipitation ?? 0), 0) / weather.length : 0;
  const worstCode = weather.reduce((value, item) => Math.max(value, item.current?.weather_code ?? 0), 0);
  const weatherEffects = useMemo(() => {
    const effects: Array<{ label: string; value: number }> = [];
    if (!weatherEnabled || !weather.length) return effects;
    if (averageWeather >= 35) effects.push({ label: routeMode === "AIR" ? "Vento forte contra o voo" : "Vento forte no trajeto", value: routeMode === "AIR" ? 0.16 : 0.07 });
    if (precipitation > 0) effects.push({ label: routeMode === "WATER" && normalizedTypes.includes("water") ? "Chuva favorece mascote de Água" : "Pista/visibilidade molhada", value: routeMode === "WATER" && normalizedTypes.includes("water") ? -0.05 : 0.08 });
    if (worstCode >= 95) effects.push({ label: "Tempestade exige cautela", value: routeMode === "AIR" ? 0.22 : 0.12 });
    if (worstCode >= 71 && worstCode <= 86) effects.push({ label: normalizedTypes.includes("ice") ? "Gelo resiste à neve" : "Neve reduz a velocidade", value: normalizedTypes.includes("ice") ? 0 : 0.1 });
    if ([45, 48].includes(worstCode)) effects.push({ label: "Neblina reduz a visibilidade", value: 0.08 });
    return effects;
  }, [averageWeather, normalizedTypes, precipitation, routeMode, weather, weatherEnabled, worstCode]);
  const weatherModifier = weatherEffects.reduce((sum, effect) => sum + effect.value, 0);
  const fatigueBase = clamp((distanceKm / 9000) * (1 - (mascot?.vitality ?? 0) / 330), 0, 0.3);
  const fatiguePenalty = clamp(fatigueBase - restStops.length * 0.05, 0, 0.3);
  const baseSpeed = routeMode === "AIR" ? 115 : routeMode === "WATER" ? 65 : 48;
  const effectiveSpeed = (baseSpeed + agilityRatio * (routeMode === "AIR" ? 85 : routeMode === "WATER" ? 55 : 45)) * (1 + routeBonus);
  const restHours = restStops.length * (routeMode === "LAND" ? 0.6 : 0.4);
  const realHours = distanceKm / effectiveSpeed * (1 + loadPenalty + weatherModifier + fatiguePenalty) + restHours;
  const debugDuration = clamp(12 + distanceKm / 150 - agilityRatio * 5 + loadPenalty * 10, 8, 35);
  const remainingDebug = debugDuration * (1 - progress);

  useEffect(() => { progressRef.current = progress; }, [progress]);

  const loadWeather = useCallback(async () => {
    if (!weatherEnabled) { setWeather([]); setWeatherError(null); return; }
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const response = await fetch("/api/admin/delivery-weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: logicalRoutePoints.map((point) => ({ lat: point.lat, lng: point.lng })) }),
      });
      const payload = await response.json() as { weather?: WeatherSnapshot[]; error?: string };
      if (!response.ok || !payload.weather) throw new Error(payload.error || "Clima indisponível.");
      setWeather(payload.weather);
    } catch (error) {
      setWeather([]);
      setWeatherError(error instanceof Error ? error.message : "Clima indisponível; rota usando condições neutras.");
    } finally {
      setWeatherLoading(false);
    }
  }, [logicalRoutePoints, weatherEnabled]);

  useEffect(() => {
    if (routeMode !== "LAND" || origin.id === destination.id) { setRoadRoute(null); setRoadError(null); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setRoadLoading(true); setRoadError(null);
      try {
        const response = await fetch("/api/admin/delivery-route", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ origin, destination }) });
        const payload = await response.json() as { points?: Array<{ lat: number; lng: number }>; distanceKm?: number; error?: string };
        if (!response.ok || !payload.points || !payload.distanceKm) throw new Error(payload.error || "Rota terrestre indisponível.");
        setRoadRoute({ points: payload.points, distanceKm: payload.distanceKm });
      } catch (error) {
        if ((error as Error).name !== "AbortError") { setRoadRoute(null); setRoadError(error instanceof Error ? error.message : "Rota terrestre indisponível."); }
      } finally { setRoadLoading(false); }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [destination.id, destination.lat, destination.lng, origin.id, origin.lat, origin.lng, routeMode]);

  useEffect(() => {
    if (status !== "READY") return;
    const timer = window.setTimeout(() => { void loadWeather(); }, 350);
    return () => window.clearTimeout(timer);
  }, [loadWeather, status]);

  const rebuildRoute = useCallback(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    routeRef.current?.remove();
    courierMarkerRef.current?.remove();
    map.eachLayer((layer) => {
      if ((layer as { options?: { pane?: string } }).options?.pane === "markerPane") map.removeLayer(layer);
    });

    const line = L.polyline(routePoints.map((point) => [point.lat, point.lng]), {
      color: routeInfo.color, weight: 4, opacity: 0.9, dashArray: "10 12",
    }).addTo(map);
    routeRef.current = line;

    const cityIcon = L.divIcon({
      className: "delivery-city-icon",
      html: '<div class="delivery-city-pin"><span>●</span></div>',
      iconSize: [28, 28], iconAnchor: [14, 25],
    });
    L.marker([origin.lat, origin.lng], { icon: cityIcon }).addTo(map).bindTooltip(`Origem: ${origin.name}`, { direction: "top" });
    L.marker([destination.lat, destination.lng], { icon: cityIcon }).addTo(map).bindTooltip(`Destino: ${destination.name}`, { direction: "top" });
    const restIcon = L.divIcon({ className: "delivery-rest-icon", html: '<div class="delivery-rest-pin">⛺</div>', iconSize: [34, 34], iconAnchor: [17, 17] });
    if (poiVisibility.REST_POINT) restStops.forEach((stop, index) => {
      const condition = weather[index + 1]?.current;
      L.marker([stop.lat, stop.lng], { icon: restIcon }).addTo(map).bindTooltip(
        `${stop.name} · descanso ${condition ? `· ${weatherLabel(condition.weather_code)} ${condition.temperature_2m}°C` : ""}`,
        { direction: "top" },
      );
    });
    const poiMeta: Record<DeliveryPoiType, { className: string; html: string; label: string }> = {
      LANDMARK: { className: "delivery-tourist-icon", html: '<div class="delivery-tourist-pin">★</div>', label: "Ponto turístico" },
      REST_POINT: { className: "delivery-rest-icon", html: '<div class="delivery-rest-pin">⛺</div>', label: "Descanso" },
      MIAUVADAO_BRANCH: { className: "delivery-miau-icon", html: '<div class="delivery-miau-pin">📦</div>', label: "Filial do Miauvadão" },
      TRAPACA_HIDEOUT: { className: "delivery-trapaca-icon", html: '<div class="delivery-trapaca-pin">☠</div>', label: "Esconderijo da Ordem" },
      SPECIAL_POI: { className: "delivery-special-icon", html: '<div class="delivery-special-pin">!</div>', label: "Evento especial" },
    };
    DELIVERY_POIS.filter((poi) => {
      const zoomVisible = poi.visibility === "LOCAL" ? mapZoom >= 7 : poi.visibility === "REGIONAL" ? mapZoom >= 5 : true;
      return zoomVisible && poiVisibility[poi.type] && !(poi.type === "REST_POINT" && restStops.some(stop => stop.id === poi.id));
    }).forEach((poi) => {
      const meta = poiMeta[poi.type];
      const icon = L.divIcon({ className: meta.className, html: meta.html, iconSize: [30, 30], iconAnchor: [15, 15] });
      L.marker([poi.lat, poi.lng], { icon }).addTo(map)
        .bindTooltip(`<b>${poi.name}</b><br>${meta.label} · ${poi.region}${poi.description ? `<br>${poi.description}` : ""}`, { direction: "top" })
        .on("click", () => setSelectedPoi(poi));
    });

    if (mascot) {
      const courierIcon = L.divIcon({
        className: "delivery-mascot-icon",
        html: `<div class="delivery-mascot-frame"><img src="${escapeHtml(mascot.spriteUrl)}" alt="" /></div>`,
        iconSize: [58, 58], iconAnchor: [29, 38],
      });
      const position = pointAlongPath(routePoints, progressRef.current);
      courierMarkerRef.current = L.marker([position.lat, position.lng], { icon: courierIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindTooltip(`${mascot.name} · ${(progressRef.current * 100).toFixed(0)}%`, { direction: "top", offset: [0, -28] });
    }
    if (suppressNextFitRef.current) suppressNextFitRef.current = false;
    else map.fitBounds(line.getBounds().pad(0.42), { animate: true, maxZoom: 6 });
  }, [destination, mapZoom, mascot, origin, poiVisibility, restStops, routeInfo.color, routePoints, weather]);

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((module) => {
      if (cancelled || !mapNodeRef.current || mapRef.current) return;
      const L = module.default ?? module;
      leafletRef.current = L;
      const map = L.map(mapNodeRef.current, { zoomControl: true, minZoom: 3 }).setView([-15.7, -48], 4);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);
      mapRef.current = map;
      map.on("zoomend", () => {
        const nextZoom = map.getZoom();
        suppressNextFitRef.current = true;
        setMapZoom(nextZoom);
      });
      setMapReady(true);
      window.setTimeout(() => map.invalidateSize(), 100);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mapReady) rebuildRoute();
  }, [mapReady, rebuildRoute]);

  useEffect(() => {
    if (status !== "RUNNING") {
      lastFrameRef.current = null;
      return;
    }
    let frame = 0;
    const tick = (now: number) => {
      const previous = lastFrameRef.current ?? now;
      lastFrameRef.current = now;
      const next = clamp(progressRef.current + ((now - previous) / 1000) * debugSpeed / debugDuration);
      progressRef.current = next;
      setProgress(next);
      if (next >= 1) {
        setStatus("DELIVERED");
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [debugDuration, debugSpeed, status]);

  useEffect(() => {
    const marker = courierMarkerRef.current;
    if (!marker) return;
    const position = pointAlongPath(routePoints, progress);
    marker.setLatLng([position.lat, position.lng]);
    marker.setTooltipContent(`${mascot?.name ?? "Mascote"} · ${(progress * 100).toFixed(0)}%`);
  }, [mascot?.name, progress, routePoints]);

  function reset() {
    progressRef.current = 0;
    setProgress(0);
    setStatus("READY");
    setWeatherError(null);
    lastFrameRef.current = null;
  }

  function swapRoute() {
    setOriginId(destinationId);
    setDestinationId(originId);
    reset();
  }

  function registerCurrentLocation() {
    if (!navigator.geolocation) { setWeatherError("Este navegador não oferece localização."); return; }
    setHomeSaving(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch("/api/delivery-home", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: homeLabel, lat: coords.latitude, lng: coords.longitude }) });
        const payload = await response.json() as { home?: { label: string; lat: number; lng: number }; error?: string };
        if (!response.ok || !payload.home) throw new Error(payload.error || "Não foi possível salvar.");
        setHome(payload.home); setDestinationId("home"); reset();
      } catch (error) { setWeatherError(error instanceof Error ? error.message : "Não foi possível salvar sua casa."); }
      finally { setHomeSaving(false); }
    }, () => { setHomeSaving(false); setWeatherError("Permissão de localização negada."); }, { enableHighAccuracy: false, timeout: 12000 });
  }

  const routeInvalid = origin.id === destination.id || !routeAllowed || (routeMode === "LAND" && Boolean(roadError));

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-slate-950 to-yellow-400/5 p-5 shadow-2xl sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-red-400/25 bg-red-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-red-300">Somente admin</span>
              <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200">Protótipo local</span>
            </div>
            <h1 className="font-pixel text-base text-[#FFCB05] sm:text-xl">Entregas pelo Mundo</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
              Viaje entre pontos reais do mundo, escolha uma escola de trajeto e use estações de descanso. Agilidade define velocidade; tipos concedem afinidade de rota; Força sustenta a carga; Vitalidade controla fadiga e o clima real modifica a estimativa.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3">
            <Bug size={18} className="text-yellow-300" />
            <div><p className="text-[9px] font-black uppercase tracking-widest text-yellow-300">Debug ativo</p><p className="text-xs text-yellow-50">Tempo comprimido</p></div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/70 p-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">Mascote entregador</label>
            <select value={mascotId} onChange={(event) => { setMascotId(event.target.value); reset(); }} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white">
              {mascots.map((item) => <option key={item.id} value={item.id}>{item.name} · Nv.{item.level} · AGI {item.agility}</option>)}
            </select>
          </div>

          {mascot ? (
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mascot.spriteUrl} alt={mascot.name} className="h-16 w-16 object-contain [image-rendering:pixelated]" />
                <div className="min-w-0"><p className="truncate font-bold text-white">{mascot.name}</p><p className="text-[10px] text-slate-400">{mascot.species} · Nível {mascot.level}</p></div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                {[['AGI', agility], ['FOR', mascot.force], ['INS', mascot.instinct], ['VIT', mascot.vitality]].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-950/60 px-1 py-2"><p className="text-[8px] text-slate-500">{label}</p><p className="text-xs font-black text-cyan-200">{value}</p></div>
                ))}
              </div>
            </div>
          ) : <p className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">A conta admin não possui mascotes livres para simular.</p>}

          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div><label className="mb-1 block text-[9px] font-bold uppercase text-slate-500">Origem</label><select value={originId} onChange={(e) => { setOriginId(e.target.value); reset(); }} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2 py-2 text-xs">{availablePlaces.map(p => <option value={p.id} key={p.id}>{p.name} · {p.country}</option>)}</select></div>
            <button type="button" onClick={swapRoute} className="mb-0.5 rounded-xl border border-slate-700 p-2 text-cyan-300 hover:bg-cyan-400/10" title="Inverter rota"><Route size={16} /></button>
            <div><label className="mb-1 block text-[9px] font-bold uppercase text-slate-500">Destino</label><select value={destinationId} onChange={(e) => { setDestinationId(e.target.value); reset(); }} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2 py-2 text-xs">{availablePlaces.map(p => <option value={p.id} key={p.id}>{p.name} · {p.country}</option>)}</select></div>
          </div>

          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-3">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-300"><Home size={14} /> Entregar na minha casa</div>
            <p className="mt-1 text-[9px] leading-relaxed text-slate-400">O endereço não é solicitado: guardamos apenas coordenadas aproximadas fornecidas pelo navegador e um apelido escolhido por você.</p>
            <div className="mt-2 flex gap-2"><input value={homeLabel} onChange={event => setHomeLabel(event.target.value)} maxLength={60} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs" placeholder="Ex.: Casa do Luiz" /><button type="button" disabled={homeSaving} onClick={registerCurrentLocation} className="flex items-center gap-1 rounded-lg bg-emerald-400 px-2.5 py-1.5 text-[9px] font-black text-slate-950 disabled:opacity-50"><LocateFixed size={13} />{homeSaving ? "Salvando" : "Registrar"}</button></div>
            {home && <button type="button" onClick={() => { setDestinationId("home"); reset(); }} className="mt-2 text-[9px] font-bold text-emerald-300 hover:underline">Usar “{home.label}” como destino</button>}
          </div>

          <div className="space-y-2 rounded-2xl border border-white/5 bg-slate-900/60 p-3">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Escola de trajeto</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(ROUTE_INFO) as [RouteMode, typeof ROUTE_INFO[RouteMode]][]).map(([mode, info]) => {
                const Icon = info.icon;
                const locked = mode === "AIR" && !normalizedTypes.includes("flying");
                return <button key={mode} type="button" disabled={locked} title={locked ? "Somente mascotes do tipo Voador podem escolher esta rota." : info.description} onClick={() => { setRouteMode(mode); reset(); }} className={`rounded-xl border p-2 text-left transition disabled:cursor-not-allowed disabled:opacity-35 ${routeMode === mode ? "border-cyan-300 bg-cyan-400/10" : "border-slate-700 bg-slate-950/40 hover:border-slate-500"}`}><span className="flex items-center gap-1.5 text-[10px] font-black text-white"><Icon size={13} style={{ color: info.color }} />{info.label}</span><span className="mt-1 block text-[8px] leading-relaxed text-slate-500">{locked ? "BLOQUEADA · EXIGE VOADOR" : info.types.map(type => type.toUpperCase()).join(" · ")}</span></button>;
              })}
            </div>
            <p className="text-[9px] leading-relaxed text-slate-400">{routeInfo.description}</p>
            <p className={`text-[9px] font-bold ${hasAffinity ? "text-emerald-300" : "text-slate-500"}`}>{hasAffinity ? `Afinidade ativa: +${(routeBonus * 100).toFixed(0)}% de velocidade.` : "Este mascote não possui afinidade com esta rota."}</p>
            {roadLoading && <p className="animate-pulse text-[9px] text-lime-300">Procurando o caminho com mais chão possível…</p>}
            {roadError && <p className="text-[9px] font-bold text-red-300">{roadError} Escolha ar ou mar.</p>}
          </div>

          <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-3">
            <div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clima real</p><p className="mt-0.5 text-[8px] text-slate-500">Open-Meteo · cache de 15 minutos</p></div><button type="button" onClick={() => { setWeatherEnabled(value => !value); reset(); }} className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${weatherEnabled ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" : "border-slate-700 text-slate-500"}`}>{weatherEnabled ? "ATIVO" : "DESLIGADO"}</button></div>
            {weatherLoading ? <p className="mt-2 animate-pulse text-[9px] text-cyan-300">Consultando condições da rota…</p> : weatherError ? <p className="mt-2 text-[9px] text-amber-300">{weatherError}</p> : weather[0]?.current ? <div className="mt-2 space-y-1.5 text-[9px]"><div className="grid grid-cols-2 gap-1.5"><span className="rounded-lg bg-slate-950/60 p-2">🌡️ {weather[0].current!.temperature_2m}°C</span><span className="rounded-lg bg-slate-950/60 p-2">💨 {weather[0].current!.wind_speed_10m} km/h</span></div>{weatherEffects.length ? weatherEffects.map(effect => <div key={effect.label} className="flex justify-between rounded-lg bg-slate-950/60 p-2"><span>{effect.label}</span><b className={effect.value > 0 ? "text-amber-300" : "text-emerald-300"}>{effect.value > 0 ? "+" : ""}{(effect.value * 100).toFixed(0)}% no tempo</b></div>) : <div className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300">Condições neutras: nenhum ajuste climático.</div>}<div className="flex justify-between border-t border-white/5 pt-1.5 font-black"><span>Total climático</span><span>{weatherModifier > 0 ? "+" : ""}{(weatherModifier * 100).toFixed(0)}%</span></div></div> : null}
          </div>

          <div className="space-y-3 rounded-2xl border border-white/5 bg-slate-900/60 p-3">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Ferramentas de simulação</label>
            <div><div className="mb-1 flex justify-between text-[10px]"><span>Carga</span><b>{cargoKg} kg</b></div><input type="range" min={1} max={100} value={cargoKg} onChange={(e) => setCargoKg(Number(e.target.value))} className="w-full accent-yellow-400" /></div>
            <div><div className="mb-1 flex justify-between text-[10px]"><span>Agilidade simulada</span><b>{simulatedAgility ?? "Real"}</b></div><input type="range" min={0} max={250} value={simulatedAgility ?? mascot?.agility ?? 0} onChange={(e) => setSimulatedAgility(Number(e.target.value))} className="w-full accent-cyan-400" /><button type="button" onClick={() => setSimulatedAgility(null)} className="mt-1 text-[9px] text-cyan-300 hover:underline">Usar atributo real</button></div>
            <div className="grid grid-cols-3 gap-1.5">{[1, 4, 20].map(speed => <button type="button" key={speed} onClick={() => setDebugSpeed(speed)} className={`rounded-lg border px-2 py-1.5 text-[10px] font-black ${debugSpeed === speed ? "border-yellow-400 bg-yellow-400/15 text-yellow-300" : "border-slate-700 text-slate-400"}`}>{speed}x</button>)}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {status === "RUNNING" ? <button type="button" onClick={() => setStatus("PAUSED")} className="flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-3 py-2.5 text-xs font-black text-slate-950"><Pause size={15} /> Pausar</button> : <button type="button" disabled={!mascot || routeInvalid || roadLoading || status === "DELIVERED"} onClick={() => setStatus("RUNNING")} className="flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-3 py-2.5 text-xs font-black text-slate-950 disabled:opacity-40"><Play size={15} /> {status === "PAUSED" ? "Continuar" : "Despachar"}</button>}
            <button type="button" onClick={reset} className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 py-2.5 text-xs font-bold text-slate-300"><RotateCcw size={15} /> Reiniciar</button>
            <button type="button" disabled={status === "READY" || status === "DELIVERED"} onClick={() => { const next = clamp(progressRef.current + 0.25); progressRef.current = next; setProgress(next); if (next >= 1) setStatus("DELIVERED"); }} className="flex items-center justify-center gap-2 rounded-xl border border-purple-400/30 bg-purple-400/10 px-3 py-2 text-[10px] font-bold text-purple-200 disabled:opacity-40"><StepForward size={14} /> +25%</button>
            <button type="button" disabled={status === "READY" || status === "DELIVERED"} onClick={() => { progressRef.current = 1; setProgress(1); setStatus("DELIVERED"); }} className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[10px] font-bold text-emerald-200 disabled:opacity-40"><Sparkles size={14} /> Concluir</button>
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Metric icon={Navigation} label="Distância real" value={`${distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km`} />
            <Metric icon={Gauge} label="Velocidade calculada" value={`${effectiveSpeed.toFixed(0)} km/h`} detail={hasAffinity ? `Afinidade ${routeInfo.label}: +${(routeBonus * 100).toFixed(0)}%` : "Sem afinidade de trajeto"} />
            <Metric icon={Clock3} label="Tempo no jogo" value={formatDuration(realHours)} detail={`${restStops.length} descanso(s) · fadiga +${(fatiguePenalty * 100).toFixed(0)}%`} />
            <Metric icon={Zap} label="Debug restante" value={formatDebugSeconds(remainingDebug / debugSpeed)} detail={`Execução em ${debugSpeed}x`} />
          </div>
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-[10px] md:grid-cols-5">
            <div><span className="text-slate-500">Base da modalidade</span><b className="mt-1 block text-white">{baseSpeed} km/h</b></div>
            <div><span className="text-slate-500">Agilidade ({agility}/250)</span><b className="mt-1 block text-cyan-200">+{(effectiveSpeed / (1 + routeBonus) - baseSpeed).toFixed(0)} km/h</b></div>
            <div><span className="text-slate-500">Afinidade de tipo</span><b className="mt-1 block text-emerald-300">{routeBonus ? `+${(routeBonus * 100).toFixed(0)}% velocidade` : "Sem bônus"}</b></div>
            <div><span className="text-slate-500">Penalidades</span><b className="mt-1 block text-amber-300">Carga +{(loadPenalty * 100).toFixed(0)}% · clima {weatherModifier > 0 ? "+" : ""}{(weatherModifier * 100).toFixed(0)}%</b></div>
            <div><span className="text-slate-500">Descanso e fadiga</span><b className="mt-1 block text-purple-200">+{formatDuration(restHours)} · fadiga +{(fatiguePenalty * 100).toFixed(0)}%</b></div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
            <div className="mb-2 flex items-center gap-2"><Landmark size={14} className="text-yellow-300" /><p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Visibilidade do mapa</p><span className="text-[9px] text-slate-500">Ative somente as camadas que deseja consultar</span></div>
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
              {([
                ["LANDMARK", "★ Turismo", "border-yellow-400/30 bg-yellow-400/10 text-yellow-200"],
                ["REST_POINT", "⛺ Descanso", "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"],
                ["MIAUVADAO_BRANCH", "📦 Miauvadão", "border-orange-400/30 bg-orange-400/10 text-orange-200"],
                ["TRAPACA_HIDEOUT", "☠ Ordem da Trapaça", "border-purple-400/30 bg-purple-400/10 text-purple-200"],
              ] as Array<[DeliveryPoiType, string, string]>).map(([type, label, activeClass]) => {
                const count = DELIVERY_POIS.filter(poi => poi.type === type).length;
                return <button type="button" key={type} aria-pressed={poiVisibility[type]} onClick={() => setPoiVisibility(current => ({ ...current, [type]: !current[type] }))} className={`rounded-xl border px-2.5 py-2 text-left text-[9px] font-black transition ${poiVisibility[type] ? activeClass : "border-slate-700 bg-slate-900 text-slate-500"}`}><span className="flex items-center justify-between"><span>{label}</span><span>{count}</span></span><span className="mt-0.5 block text-[8px] font-normal opacity-70">{poiVisibility[type] ? "Visível" : "Oculto"}</span></button>;
              })}
            </div>
            <p className="mt-2 text-[8px] text-slate-500">Zoom atual: {mapZoom}. Hubs mundiais aparecem sempre; pontos regionais surgem no zoom 5 e locais no zoom 7. Os esconderijos continuam dependendo do filtro administrativo.</p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-slate-950 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2"><MapPin size={16} className="text-cyan-300" /><div><p className="text-xs font-black text-white">{origin.name}, {origin.country} → {destination.name}, {destination.country}</p><p className="text-[9px] text-slate-500">{routeInfo.label} · {routeMode === "LAND" ? "traçado rodoviário real" : routeMode === "AIR" ? "linha direta pelo ar" : "corredor por portos e ilhas"} · {restStops.length ? restStops.map(stop => stop.name).join(" → ") : "sem paradas"}</p></div></div>
              <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest ${status === "DELIVERED" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : status === "RUNNING" ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" : "border-slate-600 bg-slate-800 text-slate-300"}`}>{status === "READY" ? "Aguardando despacho" : status === "RUNNING" ? "Em trânsito" : status === "PAUSED" ? "Simulação pausada" : "Entrega concluída"}</span>
            </div>
            <div className="relative h-[530px] max-h-[68vh] min-h-[420px]">
              <div ref={mapNodeRef} className={`absolute inset-0 ${styles.mapShell}`} />
              {!mapReady && <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950"><p className="animate-pulse text-sm text-cyan-200">Carregando mapa real…</p></div>}
              {status === "DELIVERED" && <div className="pointer-events-none absolute inset-x-5 top-5 z-[500] rounded-2xl border border-emerald-300/35 bg-emerald-950/90 p-4 text-center shadow-[0_0_40px_rgba(16,185,129,.35)] backdrop-blur"><p className="font-pixel text-xs text-emerald-300">ENTREGA CONCLUÍDA!</p><p className="mt-2 text-xs text-emerald-50">{mascot?.name} chegou a {destination.name}. Nenhuma recompensa foi gerada neste protótipo.</p></div>}
            </div>
            <div className="border-t border-white/10 p-4">
              <div className="mb-2 flex justify-between text-[10px]"><span className="text-slate-400">Progresso da rota</span><b className="text-cyan-200">{(progress * 100).toFixed(1)}%</b></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-yellow-400 transition-[width] duration-100" style={{ width: `${progress * 100}%` }} /></div>
            </div>
          </div>
        </section>
      </div>
      {selectedPoi && <PoiDetailsModal poi={selectedPoi} onClose={() => setSelectedPoi(null)} />}
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Box; label: string; value: string; detail?: string }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-slate-500"><Icon size={13} className="text-cyan-300" />{label}</div><p className="mt-2 text-lg font-black text-white">{value}</p>{detail && <p className="mt-0.5 text-[9px] text-slate-500">{detail}</p>}</div>;
}

type WikiPoiInfo = { title: string; extract: string; thumbnail?: string; pageUrl?: string };

function PoiDetailsModal({ poi, onClose }: { poi: DeliveryPoi; onClose: () => void }) {
  const [info, setInfo] = useState<WikiPoiInfo | null>(null);
  const [loading, setLoading] = useState(poi.type === "LANDMARK" || poi.type === "REST_POINT");
  const realPlace = poi.type === "LANDMARK" || poi.type === "REST_POINT";
  useEffect(() => {
    if (!realPlace) return;
    const cacheKey = `delivery-poi-wiki-v1:${poi.id}`;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null") as { savedAt: number; value: WikiPoiInfo } | null;
      if (cached && Date.now() - cached.savedAt < 7 * 86400000) { setInfo(cached.value); setLoading(false); return; }
    } catch { /* cache inválido é ignorado */ }
    const params = new URLSearchParams({ action: "query", format: "json", origin: "*", generator: "geosearch", ggscoord: `${poi.lat}|${poi.lng}`, ggsradius: "5000", ggslimit: "8", prop: "extracts|pageimages|info", exintro: "1", explaintext: "1", piprop: "thumbnail", pithumbsize: "900", inprop: "url" });
    void fetch(`https://pt.wikipedia.org/w/api.php?${params}`).then(response => response.json()).then((data: { query?: { pages?: Record<string, { title: string; extract?: string; thumbnail?: { source: string }; fullurl?: string }> } }) => {
      const pages = Object.values(data.query?.pages ?? {});
      const words = poi.name.toLocaleLowerCase("pt-BR").split(/\s+/).filter(word => word.length > 3);
      const page = pages.sort((a, b) => words.filter(word => b.title.toLocaleLowerCase("pt-BR").includes(word)).length - words.filter(word => a.title.toLocaleLowerCase("pt-BR").includes(word)).length)[0];
      if (!page) return;
      const value = { title: page.title, extract: (page.extract || "").slice(0, 900), thumbnail: page.thumbnail?.source, pageUrl: page.fullurl };
      setInfo(value);
      try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), value })); } catch { /* quota local indisponível */ }
    }).catch(() => null).finally(() => setLoading(false));
  }, [poi, realPlace]);
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(`${poi.lat},${poi.lng}`)}`;
  const typeLabel: Record<DeliveryPoiType, string> = { LANDMARK: "Ponto turístico", REST_POINT: "Ponto de descanso", MIAUVADAO_BRANCH: "Filial do Miauvadão", TRAPACA_HIDEOUT: "Esconderijo da Ordem da Trapaça", SPECIAL_POI: "Local especial" };
  const gameText = poi.description || (poi.type === "MIAUVADAO_BRANCH" ? "Ponto mundial de coleta, entrega e transferência de encomendas do Miauvadão." : poi.type === "REST_POINT" ? "Uma parada segura para recuperar o fôlego e reduzir a fadiga da viagem." : poi.type === "TRAPACA_HIDEOUT" ? "Local clandestino. Sua presença poderá gerar interceptações e missões especiais." : "Um lugar real que pode ser registrado no diário do mensageiro.");
  return <div className="fixed inset-0 z-[2000] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <article className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-cyan-400/25 bg-slate-950 shadow-[0_0_60px_rgba(34,211,238,.18)]">
      <div className="relative min-h-48 overflow-hidden bg-gradient-to-br from-cyan-950 via-slate-900 to-purple-950">
        {info?.thumbnail ? <img src={info.thumbnail} alt={poi.name} className="h-64 w-full object-cover" referrerPolicy="no-referrer" /> : <div className="grid h-52 place-items-center text-center"><Landmark size={42} className="text-cyan-300" /><p className="mt-2 text-xs text-slate-400">{loading ? "Buscando foto livre na Wikipedia…" : "Imagem real não encontrada; usando apresentação do jogo."}</p></div>}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 to-transparent px-5 pb-4 pt-14"><span className="rounded-full border border-white/20 bg-slate-950/75 px-2 py-1 text-[9px] font-black uppercase text-cyan-200">{typeLabel[poi.type]}</span><h2 className="mt-2 text-2xl font-black text-white">{poi.name}</h2><p className="text-xs text-slate-300">{poi.region}</p></div>
        <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-full border border-white/15 bg-slate-950/75 p-2 text-white"><X size={17} /></button>
      </div>
      <div className="space-y-4 p-5">
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"><p className="text-[9px] font-black uppercase tracking-widest text-yellow-300">Na Liga Zikachu</p><p className="mt-2 text-sm leading-relaxed text-slate-200">{gameText}</p></section>
        {info?.extract && <section><div className="flex items-center gap-2 text-xs font-black text-cyan-200"><BookOpen size={15} /> Sobre o local</div><p className="mt-2 text-xs leading-relaxed text-slate-300">{info.extract}</p></section>}
        <div className="flex flex-wrap gap-2">
          {realPlace && <a href={streetViewUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950"><ExternalLink size={14} /> Abrir Street View</a>}
          {info?.pageUrl && <a href={info.pageUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200"><ExternalLink size={14} /> Ler na Wikipedia</a>}
        </div>
        {info && <p className="border-t border-white/5 pt-3 text-[9px] leading-relaxed text-slate-500">Texto e imagem carregados diretamente da Wikipedia/Wikimedia. Clique na fonte para consultar o artigo, autoria e licença. A Liga não hospeda nem retransmite essa mídia.</p>}
      </div>
    </article>
  </div>;
}
