"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { TraceRouteType } from "@prisma/client";
import {
  createTraceRoomAction,
  joinTraceRoomAction,
  makeTraceMoveAction,
  leaveTraceRoomAction,
  useSinalizadorAction,
  adminGrantGoldenPawsAction,
  adminSimulateRoomAction,
  adminSeedTraceShopItemsAction,
  buyGoldenPawItemAction,
} from "../actions";
import { GOLDEN_PAW_SHOP, TRACE_EVENTS } from "../constants";

// ── Types (matching server return shape) ───────────────────────────────────

type Mascot = {
  id: string;
  pokemonId: number;
  nickname: string | null;
  level: number;
  statInstinct: number;
  statAgility: number;
  statVitality: number;
  statForce: number;
  statCharisma: number;
};

type TraceMove = { id: string; step: number; direction: string; correct: boolean };
type TraceRoomEvent = { id: string; eventCode: string; step: number };
type TraceRoom = {
  id: string;
  hiderId: string;
  hiderMascotId: string;
  hunterId: string | null;
  hunterMascotId: string | null;
  routeType: TraceRouteType;
  focusPoints: number;
  maxFocus: number;
  currentStep: number;
  status: string;
  lastHunterMoveAt: string | null;
  sinalizadorUsed: boolean;
  skipNextMove: boolean;
  hintDirection: string | null;
  isAdminSim: boolean;
  expiresAt: string;
  hider: { displayName: string };
  hiderMascot: { pokemonId: number; nickname: string | null };
  hunter: { displayName: string } | null;
  hunterMascot: { pokemonId: number; nickname: string | null } | null;
  moves: TraceMove[];
  randomEvents: TraceRoomEvent[];
};

type InventoryItem = {
  id: string;
  quantity: number;
  item: { type: string; name: string };
};

type HistoryEntry = { id: string; description: string; playerName: string; createdAt: string };

type PageData = {
  player: { id: string; displayName: string; goldenPaws: number };
  myRooms: TraceRoom[];
  openRooms: TraceRoom[];
  globalHistory: HistoryEntry[];
  myInventory: InventoryItem[];
  availableMascots: Mascot[];
};

// ── Constants ──────────────────────────────────────────────────────────────

const ROUTE_LABELS: Record<TraceRouteType, string> = {
  SHORT: "Curta (4 passos)",
  MEDIUM: "Media (6 passos)",
  LONG: "Longa (8 passos)",
  WEEKLY: "Semanal (10 passos)",
};

const ROUTE_STEPS: Record<TraceRouteType, number> = {
  SHORT: 4,
  MEDIUM: 6,
  LONG: 8,
  WEEKLY: 10,
};

const ROUTE_EXPIRY_LABELS: Record<TraceRouteType, string> = {
  SHORT: "6h",
  MEDIUM: "12h",
  LONG: "24h",
  WEEKLY: "7d",
};

const DIRECTIONS = ["N", "S", "L", "O"] as const;
const DIRECTION_LABELS: Record<string, string> = { N: "Norte ↑", S: "Sul ↓", L: "Leste →", O: "Oeste ←" };
const MAP_ITEM_FOR_ROUTE: Record<TraceRouteType, string> = {
  SHORT: "TRACE_MAP_SHORT",
  MEDIUM: "TRACE_MAP_MEDIUM",
  LONG: "TRACE_MAP_LONG",
  WEEKLY: "TRACE_MAP_WEEKLY",
};

function pokeImgUrl(id: number) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

function mascotLabel(m: { pokemonId: number; nickname: string | null }) {
  return m.nickname ? `${m.nickname} (#${m.pokemonId})` : `#${m.pokemonId}`;
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function MascotAvatar({ pokemonId, size = 40 }: { pokemonId: number; size?: number }) {
  return (
    <Image
      src={pokeImgUrl(pokemonId)}
      alt={`#${pokemonId}`}
      width={size}
      height={size}
      className="pixelated"
      unoptimized
    />
  );
}

function FocusBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.max(0, (current / max) * 100) : 0;
  const color = pct > 60 ? "bg-green-500" : pct > 30 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>Foco</span>
        <span>{current}/{max}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-700">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CountdownTimer({ until }: { until: string | null }) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!until) return;
    const tick = () => setRemaining(Math.max(0, new Date(until).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);

  if (!until || remaining <= 0) return null;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return <span className="text-[10px] text-orange-400">⏱ {mins}m{secs.toString().padStart(2, "0")}s</span>;
}

// ── Active Room View ───────────────────────────────────────────────────────

function ActiveRoomView({ room, playerId, refresh }: { room: TraceRoom; playerId: string; refresh: () => void }) {
  const [pending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<{
    tone: "success" | "warning" | "danger";
    title: string;
    message: string;
  } | null>(null);

  const isHider = room.hiderId === playerId;
  const isHunter = room.hunterId === playerId;
  const isAdminDuel = room.isAdminSim && isHider && isHunter;
  const totalSteps = ROUTE_STEPS[room.routeType] + (room.sinalizadorUsed ? 1 : 0);
  const nextMoveAt = room.lastHunterMoveAt
    ? new Date(new Date(room.lastHunterMoveAt).getTime() + 3 * 60 * 1000).toISOString()
    : null;
  const canMoveNow = room.isAdminSim || !nextMoveAt || new Date(nextMoveAt) <= new Date();

  const move = (dir: string) => {
    startTransition(async () => {
      const res = await makeTraceMoveAction(room.id, dir as "N" | "S" | "L" | "O");
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      if (res.skipped) {
        setLastResult({ tone: "warning", title: "Movimento bloqueado", message: res.message });
        toast.warning(res.message);
        refresh();
        return;
      }
      if (res.correct) {
        if (res.isFound) {
          setLastResult({ tone: "success", title: "Esconderijo encontrado", message: "A rota foi concluida e as Pegadas Douradas foram distribuidas." });
          toast.success("Voce encontrou o esconderijo! Pegadas Douradas ganhas.");
        } else {
          setLastResult({ tone: "success", title: "Direcao correta", message: "Voce avancou 1 passo na trilha. Continue seguindo os rastros." });
          toast.success("Direcao correta! Continue avancando.");
        }
      } else if (res.isEscaped) {
        setLastResult({ tone: "danger", title: "O escondido fugiu", message: "O foco acabou. A sala foi encerrada e as recompensas foram distribuidas." });
        toast.error("Foco esgotado. O escondido fugiu!");
      } else {
        setLastResult({ tone: "danger", title: "Direcao errada", message: "O foco caiu em 1 ponto. Tente ler melhor a rota antes do proximo movimento." });
        toast.error("Direcao errada. Foco reduzido.");
      }
      if (res.event) toast.info(`${res.event.label}: ${res.event.description}`);
      refresh();
    });
  };

  const flare = () => {
    startTransition(async () => {
      const res = await useSinalizadorAction(room.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setLastResult({ tone: "warning", title: "Sinalizador usado", message: "A rota ganhou +1 seta secreta. O cacador precisara acertar um passo extra." });
      toast.success("Sinalizador usado! O caminho ganhou +1 seta secreta.");
      refresh();
    });
  };

  const leave = () => {
    if (!confirm("Abandonar esta cacada? Nenhum Foco ou recompensa sera ganho.")) return;
    startTransition(async () => {
      const res = await leaveTraceRoomAction(room.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Voce saiu da cacada.");
      refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-slate-900/60 p-4 space-y-4 shadow-lg shadow-black/10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <MascotAvatar pokemonId={room.hiderMascot.pokemonId} />
          <div>
            <p className="text-xs font-bold text-slate-100">{mascotLabel(room.hiderMascot)}</p>
            <p className="text-[10px] text-slate-400">Escondido por {room.hider.displayName}</p>
            {room.hunter && <p className="text-[10px] text-cyan-300">Cacado por {room.hunter.displayName}</p>}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1 text-right">
          <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold text-orange-300">
            {ROUTE_LABELS[room.routeType]}
          </span>
          {room.isAdminSim && (
            <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300">SIM</span>
          )}
          <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
            {room.status === "HUNTING" ? "Em andamento" : room.status}
          </span>
        </div>
      </div>

      {isAdminDuel && (
        <div className="rounded-xl border border-purple-500/25 bg-purple-500/10 px-3 py-2 text-xs text-purple-200">
          <strong>Simulacao admin:</strong> voce controla os dois lados. Use as direcoes para testar o cacador e o sinalizador para testar o escondido.
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-3">
        <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Objetivo do cacador</p>
          <p className="text-xs text-slate-300">Acertar {totalSteps} direcoes antes do Foco acabar.</p>
        </div>
        <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Objetivo do escondido</p>
          <p className="text-xs text-slate-300">Fazer o cacador errar ate zerar o Foco.</p>
        </div>
        <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Proximo clique</p>
          <p className="text-xs text-slate-300">{canMoveNow ? "Escolha uma direcao abaixo." : "Aguarde o cooldown do movimento."}</p>
        </div>
      </div>

      <FocusBar current={room.focusPoints} max={room.maxFocus} />

      <div className="space-y-1">
        <div className="flex items-center gap-1">
          {Array.from({ length: totalSteps }, (_, i) => {
            const move = room.moves.find((m) => m.step === i);
            return (
              <div
                key={i}
                className={`h-2.5 flex-1 rounded-full transition-all ${
                  i < room.currentStep
                    ? "bg-green-500 shadow-sm shadow-green-500/40"
                    : i === room.currentStep
                    ? "bg-yellow-400 animate-pulse"
                    : "bg-slate-700"
                }`}
                title={move ? `${move.direction} (${move.correct ? "certo" : "errado"})` : undefined}
              />
            );
          })}
          <span className="ml-2 text-[10px] text-slate-400">{room.currentStep}/{totalSteps}</span>
        </div>
        <p className="text-[10px] text-slate-500">Cada barra representa uma direcao secreta da rota.</p>
      </div>

      {lastResult && (
        <div className={`rounded-xl border px-3 py-2 text-xs ${
          lastResult.tone === "success"
            ? "border-green-500/30 bg-green-500/10 text-green-200"
            : lastResult.tone === "warning"
            ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-200"
            : "border-red-500/30 bg-red-500/10 text-red-200"
        }`}>
          <p className="font-bold">{lastResult.title}</p>
          <p className="mt-0.5 opacity-90">{lastResult.message}</p>
        </div>
      )}

      {room.hintDirection && isHunter && (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-300">
          Dica: a proxima direcao correta e <strong>{DIRECTION_LABELS[room.hintDirection]}</strong>
        </div>
      )}

      {isHunter && room.status === "HUNTING" && (
        <div className="space-y-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
          <p className="text-[11px] text-cyan-200 font-semibold">Controles do cacador</p>
          <p className="text-[10px] text-slate-400">Clique em uma direcao. Acerto avanca, erro reduz o Foco. Na simulacao admin nao ha cooldown.</p>
          <div className="grid grid-cols-2 gap-2">
            {DIRECTIONS.map((dir) => (
              <button
                key={dir}
                onClick={() => move(dir)}
                disabled={pending || (!canMoveNow && !room.isAdminSim)}
                className="rounded-xl border border-border bg-slate-800 py-2 text-xs font-semibold text-slate-200 hover:border-yellow-500/50 hover:text-yellow-300 disabled:opacity-40 transition-colors"
              >
                {DIRECTION_LABELS[dir]}
              </button>
            ))}
          </div>
          {!canMoveNow && !room.isAdminSim && (
            <div className="text-center">
              <CountdownTimer until={nextMoveAt} />
            </div>
          )}
        </div>
      )}

      {isHider && room.status === "HUNTING" && (
        <div className="space-y-2 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3">
          <p className="text-[11px] text-yellow-200 font-semibold">Controles do escondido</p>
          <p className="text-[10px] text-slate-400">O sinalizador adiciona uma direcao secreta na rota. Use uma vez por sala.</p>
          <button
            onClick={flare}
            disabled={pending || room.sinalizadorUsed}
            className="w-full rounded-xl border border-yellow-500/30 bg-yellow-500/10 py-2 text-xs font-semibold text-yellow-300 hover:bg-yellow-500/20 disabled:opacity-40 transition-colors"
          >
            {room.sinalizadorUsed ? "Sinalizador usado" : "Usar Sinalizador Gratuito"}
          </button>
        </div>
      )}

      {room.randomEvents.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-slate-500">Eventos nesta sala:</p>
          {room.randomEvents.slice(-3).map((ev) => {
            const info = TRACE_EVENTS.find((e) => e.code === ev.eventCode);
            return (
              <div key={ev.id} className="rounded-lg bg-slate-800/50 px-2 py-1 text-[10px] text-slate-400">
                {info?.label ?? ev.eventCode} (passo {ev.step + 1})
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={leave}
        disabled={pending}
        className="w-full rounded-xl border border-red-500/20 bg-red-500/10 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
      >
        Abandonar Cacada
      </button>
    </div>
  );
}

// Active Room View end

function HideTab({ data, refresh }: { data: PageData; refresh: () => void }) {
  const [pending, startTransition] = useTransition();
  const [mascotId, setMascotId] = useState("");
  const [routeType, setRouteType] = useState<TraceRouteType>("SHORT");

  const hasMap = data.myInventory.some(
    (i) => i.item.type === MAP_ITEM_FOR_ROUTE[routeType] && i.quantity > 0,
  );

  const myActiveRooms = data.myRooms.filter((r) => r.hiderId === data.player.id);

  const submit = () => {
    if (!mascotId) { toast.error("Selecione um mascote"); return; }
    startTransition(async () => {
      const res = await createTraceRoomAction(mascotId, routeType, !hasMap);
      if ("error" in res && !res.success) { toast.error(res.error ?? "Erro"); return; }
      toast.success("🗺️ Esconderijo aberto! Aguardando caçador...");
      refresh();
    });
  };

  if (myActiveRooms.length >= 3) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-300">
          Voce ja possui 3 esconderijos ativos. Resolva um antes de criar outro.
        </div>
        {myActiveRooms.map((room) => <ActiveRoomView key={room.id} room={room} playerId={data.player.id} refresh={refresh} />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {myActiveRooms.length > 0 && (
        <div className="space-y-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-300">
            Voce tem {myActiveRooms.length}/3 esconderijo(s) ativo(s). Ainda pode abrir mais testes.
          </div>
          {myActiveRooms.map((room) => <ActiveRoomView key={room.id} room={room} playerId={data.player.id} refresh={refresh} />)}
        </div>
      )}

      <p className="text-sm text-slate-400">Escolha um mascote e o tipo de rota para se esconder. O caçador tentará te encontrar!</p>

      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-slate-400">Mascote</label>
        <select
          value={mascotId}
          onChange={(e) => setMascotId(e.target.value)}
          className="w-full rounded-xl border border-border bg-slate-800 px-3 py-2 text-xs text-slate-200"
        >
          <option value="">Selecione um mascote...</option>
          {data.availableMascots.map((m) => (
            <option key={m.id} value={m.id}>
              #{m.pokemonId} {m.nickname ? `(${m.nickname})` : ""} — Nv.{m.level} | Vit:{m.statVitality} Inst:{m.statInstinct}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-slate-400">Tipo de Rota</label>
        <div className="grid grid-cols-2 gap-2">
          {(["SHORT", "MEDIUM", "LONG", "WEEKLY"] as TraceRouteType[]).map((r) => {
            const hasThisMap = data.myInventory.some((i) => i.item.type === MAP_ITEM_FOR_ROUTE[r] && i.quantity > 0);
            return (
              <button
                key={r}
                onClick={() => setRouteType(r)}
                className={`rounded-xl border py-2.5 text-xs font-semibold transition-colors ${
                  routeType === r
                    ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-300"
                    : "border-border bg-slate-800 text-slate-400 hover:border-slate-600"
                }`}
              >
                {ROUTE_LABELS[r]}
                <span className="ml-1 text-[9px] opacity-70">({ROUTE_EXPIRY_LABELS[r]})</span>
                {hasThisMap ? (
                  <span className="ml-1 text-[9px] text-green-400">✓ Mapa</span>
                ) : (
                  <span className="ml-1 text-[9px] text-orange-400">Admin</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!hasMap && (
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-[11px] text-orange-300">
          Você não possui o Mapa para esta rota. Como admin, o item será ignorado.
        </div>
      )}

      <button
        onClick={submit}
        disabled={pending || !mascotId}
        className="w-full rounded-xl bg-yellow-500/20 border border-yellow-500/30 py-2.5 text-sm font-bold text-yellow-300 hover:bg-yellow-500/30 disabled:opacity-40 transition-colors"
      >
        {pending ? "Abrindo esconderijo..." : "🗺️ Abrir Esconderijo"}
      </button>
    </div>
  );
}

// ── Hunt Tab ───────────────────────────────────────────────────────────────

function HuntTab({ data, refresh }: { data: PageData; refresh: () => void }) {
  const [pending, startTransition] = useTransition();
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [mascotId, setMascotId] = useState("");

  const myHuntRoom = data.myRooms.find((r) => r.hunterId === data.player.id && r.status === "HUNTING");

  const hasTicket = data.myInventory.some(
    (i) => (i.item.type === "TRACE_HUNT_TICKET" || i.item.type === "TRACE_GOLDEN_TICKET") && i.quantity > 0,
  );

  const join = () => {
    if (!selectedRoom || !mascotId) { toast.error("Selecione sala e mascote"); return; }
    startTransition(async () => {
      const res = await joinTraceRoomAction(selectedRoom, mascotId, !hasTicket);
      if ("error" in res && !res.success) { toast.error(res.error ?? "Erro"); return; }
      toast.success("🔍 Entrou na caçada! Boa sorte!");
      refresh();
    });
  };

  if (myHuntRoom) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm text-green-300">
          Você está ativamente caçando. Faça seus movimentos!
        </div>
        <ActiveRoomView room={myHuntRoom} playerId={data.player.id} refresh={refresh} />
      </div>
    );
  }

  if (data.openRooms.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-slate-500">
        Nenhum esconderijo aberto no momento. Volte mais tarde ou seja o escondido!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Esconderijos disponíveis para caçar:</p>

      <div className="space-y-2">
        {data.openRooms.map((room) => (
          <button
            key={room.id}
            onClick={() => setSelectedRoom(room.id === selectedRoom ? null : room.id)}
            className={`w-full rounded-xl border p-3 text-left transition-colors ${
              selectedRoom === room.id
                ? "border-yellow-500/50 bg-yellow-500/10"
                : "border-border bg-slate-900/60 hover:border-slate-600"
            }`}
          >
            <div className="flex items-center gap-3">
              <MascotAvatar pokemonId={room.hiderMascot.pokemonId} size={36} />
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-200">{room.hider.displayName}</p>
                <p className="text-[10px] text-slate-400">
                  {mascotLabel(room.hiderMascot)} · {ROUTE_LABELS[room.routeType]}
                </p>
              </div>
              <span className="text-[10px] text-slate-500">
                {new Date(room.expiresAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </button>
        ))}
      </div>

      {selectedRoom && (
        <div className="space-y-2 rounded-xl border border-border bg-slate-900/60 p-3">
          <label className="text-[11px] font-semibold text-slate-400">Seu mascote</label>
          <select
            value={mascotId}
            onChange={(e) => setMascotId(e.target.value)}
            className="w-full rounded-xl border border-border bg-slate-800 px-3 py-2 text-xs text-slate-200"
          >
            <option value="">Selecione...</option>
            {data.availableMascots.map((m) => (
              <option key={m.id} value={m.id}>
                #{m.pokemonId} {m.nickname ?? ""} — Nv.{m.level} | Inst:{m.statInstinct}
              </option>
            ))}
          </select>

          {!hasTicket && (
            <p className="text-[10px] text-orange-300">Sem ticket — entrada como admin (bypass).</p>
          )}

          <button
            onClick={join}
            disabled={pending || !mascotId}
            className="w-full rounded-xl bg-green-500/20 border border-green-500/30 py-2 text-sm font-bold text-green-300 hover:bg-green-500/30 disabled:opacity-40 transition-colors"
          >
            {pending ? "Entrando..." : "🔍 Entrar na Caçada"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── History Tab ────────────────────────────────────────────────────────────

function HistoryTab({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return <div className="py-10 text-center text-sm text-slate-500">Nenhum evento registrado ainda.</div>;
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Últimos 10 eventos globais de Caçada de Rastros:</p>
      {history.map((entry) => (
        <div key={entry.id} className="flex gap-3 rounded-xl border border-border bg-slate-900/60 px-3 py-2">
          <span className="mt-0.5 text-sm">🐾</span>
          <div className="flex-1">
            <p className="text-xs text-slate-200">{entry.description}</p>
            <p className="text-[10px] text-slate-500">
              {new Date(entry.createdAt).toLocaleString("pt-BR")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Golden Paw Shop ────────────────────────────────────────────────────────

function GoldenShopTab({ goldenPaws, refresh }: { goldenPaws: number; refresh: () => void }) {
  const [pending, startTransition] = useTransition();

  const buy = (type: string) => {
    startTransition(async () => {
      const res = await buyGoldenPawItemAction(type);
      if ("error" in res && !res.success) { toast.error(res.error ?? "Erro"); return; }
      toast.success("Item adquirido! Verifique seu inventário.");
      refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">Gaste suas Pegadas Douradas:</p>
        <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-sm font-bold text-yellow-300">
          🐾 {goldenPaws}
        </span>
      </div>

      <div className="grid gap-2">
        {GOLDEN_PAW_SHOP.map((item) => (
          <div key={item.type} className="flex items-center justify-between rounded-xl border border-border bg-slate-900/60 px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold text-slate-200">{item.name}</p>
              <p className="text-[10px] text-slate-400">{item.description}</p>
            </div>
            <button
              onClick={() => buy(item.type)}
              disabled={pending || goldenPaws < item.cost}
              className="ml-3 shrink-0 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs font-bold text-yellow-300 hover:bg-yellow-500/20 disabled:opacity-40 transition-colors"
            >
              🐾 {item.cost}
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3 text-[10px] text-slate-500 space-y-1">
        <p className="font-semibold text-slate-400">Como ganhar Pegadas Douradas</p>
        <p>• Caçador vence: +20 🐾 (base) · Escondido perde: +8 🐾</p>
        <p>• Escondido foge: +25 🐾 (base) · Caçador perde: +5 🐾</p>
        <p>• Bônus por rota: Curta ×1 · Média ×1.25 · Longa ×1.5 · Semanal ×2</p>
      </div>
    </div>
  );
}

// ── Admin Panel ────────────────────────────────────────────────────────────

function AdminPanel({ data, refresh, onSimulationCreated }: { data: PageData; refresh: () => void; onSimulationCreated: () => void }) {
  const [pending, startTransition] = useTransition();
  const [hiderMascotId, setHiderMascotId] = useState("");
  const [hunterMascotId, setHunterMascotId] = useState("");
  const [simRoute, setSimRoute] = useState<TraceRouteType>("SHORT");
  const [grantPlayerId, setGrantPlayerId] = useState("");
  const [grantAmount, setGrantAmount] = useState("50");

  const seedItems = () => {
    startTransition(async () => {
      const res = await adminSeedTraceShopItemsAction();
      if ("error" in res && !res.success) { toast.error(res.error ?? "Erro"); return; }
      toast.success(`Seed concluído! ${res.created ?? 0} itens criados.`);
    });
  };

  const simulate = () => {
    if (!hiderMascotId || !hunterMascotId) { toast.error("Selecione os dois mascotes"); return; }
    startTransition(async () => {
      const res = await adminSimulateRoomAction(hiderMascotId, hunterMascotId, simRoute);
      if ("error" in res && !res.success) { toast.error(res.error ?? "Erro"); return; }
      toast.success("Sala de simulação criada! Vá para a aba Esconder ou Caçar.");
      refresh();
      onSimulationCreated();
    });
  };

  const grantPaws = () => {
    if (!grantPlayerId) { toast.error("Informe o ID do jogador"); return; }
    startTransition(async () => {
      const res = await adminGrantGoldenPawsAction(grantPlayerId, parseInt(grantAmount, 10));
      if ("error" in res && !res.success) { toast.error(res.error ?? "Erro"); return; }
      toast.success(`+${grantAmount} 🐾 concedido!`);
      refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Seed shop items */}
      <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
        <p className="text-xs font-bold text-purple-300">Seed — Itens da Loja (desabilitados)</p>
        <p className="text-[10px] text-slate-400">Cria todos os itens de Caçada de Rastros no banco. Devem ser ativados manualmente no painel Admin.</p>
        <button
          onClick={seedItems}
          disabled={pending}
          className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-300 hover:bg-purple-500/20 disabled:opacity-40 transition-colors"
        >
          {pending ? "Criando..." : "Criar Itens (Desabilitados)"}
        </button>
      </div>

      {/* Simulation */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
        <p className="text-xs font-bold text-blue-300">Simulação — Criar Sala de Teste</p>
        <p className="text-[10px] text-slate-400">Cria uma sala onde você é ao mesmo tempo hider e hunter (sem cooldown). Útil para testar o fluxo completo.</p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500">Mascote Escondido</label>
            <select
              value={hiderMascotId}
              onChange={(e) => setHiderMascotId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-slate-800 px-2 py-1.5 text-[11px] text-slate-200"
            >
              <option value="">Selecione...</option>
              {data.availableMascots.map((m) => (
                <option key={m.id} value={m.id}>#{m.pokemonId} {m.nickname ?? ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Mascote Caçador</label>
            <select
              value={hunterMascotId}
              onChange={(e) => setHunterMascotId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-slate-800 px-2 py-1.5 text-[11px] text-slate-200"
            >
              <option value="">Selecione...</option>
              {data.availableMascots.filter((m) => m.id !== hiderMascotId).map((m) => (
                <option key={m.id} value={m.id}>#{m.pokemonId} {m.nickname ?? ""}</option>
              ))}
            </select>
          </div>
        </div>

        <select
          value={simRoute}
          onChange={(e) => setSimRoute(e.target.value as TraceRouteType)}
          className="w-full rounded-lg border border-border bg-slate-800 px-2 py-1.5 text-[11px] text-slate-200"
        >
          {(["SHORT", "MEDIUM", "LONG", "WEEKLY"] as TraceRouteType[]).map((r) => (
            <option key={r} value={r}>{ROUTE_LABELS[r]}</option>
          ))}
        </select>

        <button
          onClick={simulate}
          disabled={pending}
          className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-300 hover:bg-blue-500/20 disabled:opacity-40 transition-colors"
        >
          {pending ? "Criando..." : "Criar Simulação"}
        </button>
      </div>

      {/* Grant golden paws */}
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-3">
        <p className="text-xs font-bold text-yellow-300">Conceder Pegadas Douradas</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="ID do jogador"
            value={grantPlayerId}
            onChange={(e) => setGrantPlayerId(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-slate-800 px-3 py-1.5 text-xs text-slate-200"
          />
          <input
            type="number"
            value={grantAmount}
            onChange={(e) => setGrantAmount(e.target.value)}
            className="w-20 rounded-lg border border-border bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
          />
          <button
            onClick={grantPaws}
            disabled={pending}
            className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs font-bold text-yellow-300 hover:bg-yellow-500/20 disabled:opacity-40 transition-colors"
          >
            Conceder
          </button>
        </div>
      </div>

      {/* Event catalog */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 space-y-2">
        <p className="text-xs font-bold text-slate-300">Catálogo de Eventos ({TRACE_EVENTS.length})</p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {TRACE_EVENTS.map((ev) => (
            <div key={ev.code} className="flex items-start gap-2 text-[10px]">
              <span className={ev.positiveForHider ? "text-green-400" : "text-red-400"}>
                {ev.positiveForHider ? "▲" : "▼"}
              </span>
              <div>
                <span className="font-semibold text-slate-300">{ev.label}</span>
                <span className="ml-1 text-slate-500">— {ev.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Economy review */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 space-y-2 text-[10px] text-slate-400">
        <p className="font-semibold text-slate-300">Revisão de Economia</p>
        <div className="space-y-1">
          <p className="text-slate-500 font-semibold">Mapas (ZikaCoins):</p>
          <p>• Mapa Curta: 150 ZC (= 0.75× ovo comum) — entrada acessível</p>
          <p>• Mapa Média: 300 ZC (= 1.5× ovo comum) — moderado</p>
          <p>• Mapa Longa: 600 ZC (= 1.2× ovo raro) — alto risco/recompensa</p>
          <p>• Mapa Semanal: 1.200 ZC (= 1× ovo especial) — investimento premium</p>
          <p>• Ticket de Caçada: 120 ZC — baixo, incentiva caçadores</p>
          <p className="text-slate-500 font-semibold mt-2">Pegadas Douradas — ganho por sessão:</p>
          <p>• Caçador vence rota curta: 20 🐾 · semanal: 40 🐾</p>
          <p>• Escondido foge rota curta: 25 🐾 · semanal: 50 🐾</p>
          <p>• Item mais barato (Isca Falsa): 15 🐾 = ~1 caçada</p>
          <p>• Ticket Dourado: 100 🐾 = ~5 vitórias (vale 120 ZC = razoável)</p>
          <p>• Mapa Especial: 80 🐾 = ~4 vitórias (vale 600 ZC = excelente troca)</p>
          <p className="text-slate-500 font-semibold mt-2">Referência ZC existente:</p>
          <p>• Ovo Comum 200 ZC · Raro 500 ZC · Especial 1.200 ZC</p>
          <p>• Vacation Ticket ~600 ZC · XP Share ~2.500 ZC</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

type Tab = "esconder" | "cacar" | "historico" | "loja" | "admin";

export function TraceClient({ initialData }: { initialData: PageData }) {
  const [tab, setTab] = useState<Tab>("esconder");
  const [data, setData] = useState(initialData);
  const [refreshing, startRefresh] = useTransition();

  const refresh = () => {
    startRefresh(async () => {
      // Re-fetch via server action
      const { getTracePageDataAction } = await import("../actions");
      const res = await getTracePageDataAction();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!("error" in res)) setData(res as unknown as PageData);
    });
  };

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "esconder", label: "Esconder", emoji: "🗺️" },
    { id: "cacar", label: "Caçar", emoji: "🔍" },
    { id: "historico", label: "Histórico", emoji: "📜" },
    { id: "loja", label: "Loja 🐾", emoji: "🛒" },
    { id: "admin", label: "Admin", emoji: "⚙️" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">🐾 Caçada de Rastros</h1>
          <p className="text-xs text-slate-400">Modo oculto · Apenas administradores</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-sm font-bold text-yellow-300">
            🐾 {data.player.goldenPaws}
          </span>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="rounded-xl border border-border bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors"
          >
            {refreshing ? "..." : "↻ Atualizar"}
          </button>
        </div>
      </div>

      {/* My active rooms banner */}
      {data.myRooms.length > 0 && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-2 text-xs text-blue-300">
          Você tem {data.myRooms.length} sala(s) ativa(s). Acesse as abas Esconder/Caçar para gerenciá-las.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map(({ id, label, emoji }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === id
                ? "bg-yellow-500/20 text-yellow-300"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {emoji} {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === "esconder" && <HideTab data={data} refresh={refresh} />}
        {tab === "cacar" && <HuntTab data={data} refresh={refresh} />}
        {tab === "historico" && <HistoryTab history={data.globalHistory} />}
        {tab === "loja" && <GoldenShopTab goldenPaws={data.player.goldenPaws} refresh={refresh} />}
        {tab === "admin" && <AdminPanel data={data} refresh={refresh} onSimulationCreated={() => setTab("cacar")} />}
      </div>
    </div>
  );
}
