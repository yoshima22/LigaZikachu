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
} from "lucide-react";
import styles from "./delivery-map-prototype.module.css";

type MascotOption = {
  id: string;
  name: string;
  species: string;
  level: number;
  agility: number;
  force: number;
  instinct: number;
  vitality: number;
  spriteUrl: string;
};

type Place = { id: string; name: string; state: string; lat: number; lng: number };
type TripStatus = "READY" | "RUNNING" | "PAUSED" | "DELIVERED";

const PLACES: Place[] = [
  { id: "manaus", name: "Manaus", state: "AM", lat: -3.119, lng: -60.0217 },
  { id: "belem", name: "Belém", state: "PA", lat: -1.4558, lng: -48.4902 },
  { id: "fortaleza", name: "Fortaleza", state: "CE", lat: -3.7319, lng: -38.5267 },
  { id: "recife", name: "Recife", state: "PE", lat: -8.0476, lng: -34.877 },
  { id: "salvador", name: "Salvador", state: "BA", lat: -12.9777, lng: -38.5016 },
  { id: "brasilia", name: "Brasília", state: "DF", lat: -15.7939, lng: -47.8828 },
  { id: "bh", name: "Belo Horizonte", state: "MG", lat: -19.9167, lng: -43.9345 },
  { id: "rio", name: "Rio de Janeiro", state: "RJ", lat: -22.9068, lng: -43.1729 },
  { id: "sp", name: "São Paulo", state: "SP", lat: -23.5505, lng: -46.6333 },
  { id: "curitiba", name: "Curitiba", state: "PR", lat: -25.4284, lng: -49.2733 },
  { id: "florianopolis", name: "Florianópolis", state: "SC", lat: -27.5949, lng: -48.5482 },
  { id: "portoalegre", name: "Porto Alegre", state: "RS", lat: -30.0346, lng: -51.2177 },
];

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

export function DeliveryMapPrototype({ mascots }: { mascots: MascotOption[] }) {
  const [mascotId, setMascotId] = useState(mascots[0]?.id ?? "");
  const [originId, setOriginId] = useState("sp");
  const [destinationId, setDestinationId] = useState("rio");
  const [cargoKg, setCargoKg] = useState(5);
  const [status, setStatus] = useState<TripStatus>("READY");
  const [progress, setProgress] = useState(0);
  const [debugSpeed, setDebugSpeed] = useState(1);
  const [simulatedAgility, setSimulatedAgility] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const courierMarkerRef = useRef<Marker | null>(null);
  const routeRef = useRef<Polyline | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const progressRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);

  const mascot = mascots.find((item) => item.id === mascotId) ?? mascots[0];
  const origin = PLACES.find((item) => item.id === originId) ?? PLACES[8];
  const destination = PLACES.find((item) => item.id === destinationId) ?? PLACES[7];
  const agility = clamp(simulatedAgility ?? mascot?.agility ?? 0, 0, 250);
  const distanceKm = useMemo(() => haversineKm(origin, destination), [origin, destination]);
  const agilityRatio = agility / 250;
  const loadPenalty = clamp((cargoKg - Math.min(30, (mascot?.force ?? 0) * 0.22)) / 100, 0, 0.32);
  const effectiveSpeed = 60 + agilityRatio * 60;
  const realHours = distanceKm / effectiveSpeed * (1 + loadPenalty);
  const debugDuration = clamp(12 + distanceKm / 150 - agilityRatio * 5 + loadPenalty * 10, 8, 35);
  const remainingDebug = debugDuration * (1 - progress);

  useEffect(() => { progressRef.current = progress; }, [progress]);

  const rebuildRoute = useCallback(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    routeRef.current?.remove();
    courierMarkerRef.current?.remove();
    map.eachLayer((layer) => {
      if ((layer as { options?: { pane?: string } }).options?.pane === "markerPane") map.removeLayer(layer);
    });

    const line = L.polyline([[origin.lat, origin.lng], [destination.lat, destination.lng]], {
      color: "#22d3ee", weight: 4, opacity: 0.9, dashArray: "10 12",
    }).addTo(map);
    routeRef.current = line;

    const cityIcon = L.divIcon({
      className: "delivery-city-icon",
      html: '<div class="delivery-city-pin"><span>●</span></div>',
      iconSize: [28, 28], iconAnchor: [14, 25],
    });
    L.marker([origin.lat, origin.lng], { icon: cityIcon }).addTo(map).bindTooltip(`Origem: ${origin.name}`, { direction: "top" });
    L.marker([destination.lat, destination.lng], { icon: cityIcon }).addTo(map).bindTooltip(`Destino: ${destination.name}`, { direction: "top" });

    if (mascot) {
      const courierIcon = L.divIcon({
        className: "delivery-mascot-icon",
        html: `<div class="delivery-mascot-frame"><img src="${escapeHtml(mascot.spriteUrl)}" alt="" /></div>`,
        iconSize: [58, 58], iconAnchor: [29, 38],
      });
      const lat = origin.lat + (destination.lat - origin.lat) * progressRef.current;
      const lng = origin.lng + (destination.lng - origin.lng) * progressRef.current;
      courierMarkerRef.current = L.marker([lat, lng], { icon: courierIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindTooltip(`${mascot.name} · ${(progressRef.current * 100).toFixed(0)}%`, { direction: "top", offset: [0, -28] });
    }
    map.fitBounds(line.getBounds().pad(0.42), { animate: true, maxZoom: 6 });
  }, [destination, mascot, origin]);

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
    marker.setLatLng([
      origin.lat + (destination.lat - origin.lat) * progress,
      origin.lng + (destination.lng - origin.lng) * progress,
    ]);
    marker.setTooltipContent(`${mascot?.name ?? "Mascote"} · ${(progress * 100).toFixed(0)}%`);
  }, [destination, mascot?.name, origin, progress]);

  function reset() {
    progressRef.current = 0;
    setProgress(0);
    setStatus("READY");
    lastFrameRef.current = null;
  }

  function swapRoute() {
    setOriginId(destinationId);
    setDestinationId(originId);
    reset();
  }

  const routeInvalid = origin.id === destination.id;

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
              Escolha um mascote e acompanhe uma entrega entre cidades reais. A Agilidade altera a velocidade; Força reduz a penalidade de cargas pesadas. Esta simulação não consome mascotes, não entrega recompensas e não grava resultados.
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
            <div><label className="mb-1 block text-[9px] font-bold uppercase text-slate-500">Origem</label><select value={originId} onChange={(e) => { setOriginId(e.target.value); reset(); }} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2 py-2 text-xs">{PLACES.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></div>
            <button type="button" onClick={swapRoute} className="mb-0.5 rounded-xl border border-slate-700 p-2 text-cyan-300 hover:bg-cyan-400/10" title="Inverter rota"><Route size={16} /></button>
            <div><label className="mb-1 block text-[9px] font-bold uppercase text-slate-500">Destino</label><select value={destinationId} onChange={(e) => { setDestinationId(e.target.value); reset(); }} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2 py-2 text-xs">{PLACES.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></div>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/5 bg-slate-900/60 p-3">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Ferramentas de simulação</label>
            <div><div className="mb-1 flex justify-between text-[10px]"><span>Carga</span><b>{cargoKg} kg</b></div><input type="range" min={1} max={100} value={cargoKg} onChange={(e) => setCargoKg(Number(e.target.value))} className="w-full accent-yellow-400" /></div>
            <div><div className="mb-1 flex justify-between text-[10px]"><span>Agilidade simulada</span><b>{simulatedAgility ?? "Real"}</b></div><input type="range" min={0} max={250} value={simulatedAgility ?? mascot?.agility ?? 0} onChange={(e) => setSimulatedAgility(Number(e.target.value))} className="w-full accent-cyan-400" /><button type="button" onClick={() => setSimulatedAgility(null)} className="mt-1 text-[9px] text-cyan-300 hover:underline">Usar atributo real</button></div>
            <div className="grid grid-cols-3 gap-1.5">{[1, 4, 20].map(speed => <button type="button" key={speed} onClick={() => setDebugSpeed(speed)} className={`rounded-lg border px-2 py-1.5 text-[10px] font-black ${debugSpeed === speed ? "border-yellow-400 bg-yellow-400/15 text-yellow-300" : "border-slate-700 text-slate-400"}`}>{speed}x</button>)}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {status === "RUNNING" ? <button type="button" onClick={() => setStatus("PAUSED")} className="flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-3 py-2.5 text-xs font-black text-slate-950"><Pause size={15} /> Pausar</button> : <button type="button" disabled={!mascot || routeInvalid || status === "DELIVERED"} onClick={() => setStatus("RUNNING")} className="flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-3 py-2.5 text-xs font-black text-slate-950 disabled:opacity-40"><Play size={15} /> {status === "PAUSED" ? "Continuar" : "Despachar"}</button>}
            <button type="button" onClick={reset} className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 py-2.5 text-xs font-bold text-slate-300"><RotateCcw size={15} /> Reiniciar</button>
            <button type="button" disabled={status === "READY" || status === "DELIVERED"} onClick={() => { const next = clamp(progressRef.current + 0.25); progressRef.current = next; setProgress(next); if (next >= 1) setStatus("DELIVERED"); }} className="flex items-center justify-center gap-2 rounded-xl border border-purple-400/30 bg-purple-400/10 px-3 py-2 text-[10px] font-bold text-purple-200 disabled:opacity-40"><StepForward size={14} /> +25%</button>
            <button type="button" disabled={status === "READY" || status === "DELIVERED"} onClick={() => { progressRef.current = 1; setProgress(1); setStatus("DELIVERED"); }} className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[10px] font-bold text-emerald-200 disabled:opacity-40"><Sparkles size={14} /> Concluir</button>
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Metric icon={Navigation} label="Distância real" value={`${distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km`} />
            <Metric icon={Gauge} label="Velocidade calculada" value={`${effectiveSpeed.toFixed(0)} km/h`} detail={loadPenalty ? `Carga: +${(loadPenalty * 100).toFixed(0)}% no tempo` : "Sem penalidade de carga"} />
            <Metric icon={Clock3} label="Tempo no jogo" value={formatDuration(realHours)} detail="Estimativa de produção" />
            <Metric icon={Zap} label="Debug restante" value={formatDebugSeconds(remainingDebug / debugSpeed)} detail={`Execução em ${debugSpeed}x`} />
          </div>

          <div className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-slate-950 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2"><MapPin size={16} className="text-cyan-300" /><div><p className="text-xs font-black text-white">{origin.name} → {destination.name}</p><p className="text-[9px] text-slate-500">Rota geográfica demonstrativa em mapa real</p></div></div>
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
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Box; label: string; value: string; detail?: string }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-slate-500"><Icon size={13} className="text-cyan-300" />{label}</div><p className="mt-2 text-lg font-black text-white">{value}</p>{detail && <p className="mt-0.5 text-[9px] text-slate-500">{detail}</p>}</div>;
}
