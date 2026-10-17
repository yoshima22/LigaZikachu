"use client";

import { useEffect, useRef, useState } from "react";
import { EffectChips } from "@/components/replay-effect-chips";

// ── Tipos de dados (preview isolado; mesma forma que um turnLog normalizado) ──
export type Combatant = {
  id: string;
  name: string;
  pokemonId: number;
  type: string;
  sprite: string;
  maxHp: number;
  side: "A" | "B";
  role?: string; // rótulo de postura (define frente/trás no campo)
};
export type ReplayTurn = {
  turn: number;
  actorId: string;
  targetId: string;
  action: "ATTACK" | "HEAL" | "DEFEND" | "ABILITY";
  attackerType?: string;
  damage: number;
  advantageApplied?: boolean;
  targetHpAfter: number; // HP absoluto do alvo após o golpe
  actorRole?: string;
  targetRole?: string;
  effect?: string;
  multiplier?: number; // multiplicador de dano (p/ "Super efetivo ×N" no log)
  abilityName?: string; // nome do golpe/habilidade exibido ao atacar
  guardianInterceptId?: string | null; // mascote que interceptou parte do dano (Guardião)
  guardianHpAfter?: number; // HP do guardião após absorver
  guardianInterceptDamage?: number; // quanto o guardião absorveu
  debuff?: boolean; // Oportunista aplicou debuff
};
export type ReplayData = { teams: Combatant[]; turns: ReplayTurn[]; bgUrl?: string; winnerName?: string | null };

// Postura → faixa do campo: "front" (perto do centro) ou "back" (perto da borda).
const FRONT_ROLES = new Set(["Defensor", "Guardião", "Atacante", "Duelista", "Provocador", "Sobrevivente"]);
const laneOf = (role?: string): "front" | "back" => (role && FRONT_ROLES.has(role) ? "front" : "back");

// Texturas de efeito por tipo (PNG/WEBP com alpha; recoloridas no canvas).
const TEX_FOR: Record<string, string> = {
  fire: "fire", water: "water", electric: "electric", ice: "ice", ghost: "shadow", dark: "shadow",
};
const TEX_FILES = ["impact", "fire", "water", "electric", "ice", "shadow", "pokeball", "pokeball-open"];

// Cores por tipo (hex p/ canvas — as classes Tailwind não servem aqui).
const TYPE_HEX: Record<string, string> = {
  normal: "#A8A878", fire: "#F08030", water: "#6890F0", grass: "#78C850",
  electric: "#F8D030", psychic: "#F85888", fighting: "#C03028", dark: "#705848",
  steel: "#B8B8D0", dragon: "#7038F8", fairy: "#EE99AC", ghost: "#705898",
  poison: "#A040A0", ground: "#E0C068", rock: "#B8A038", flying: "#A890F0",
  bug: "#A8B820", ice: "#98D8D8",
};
const hex = (t?: string) => TYPE_HEX[t ?? "normal"] ?? "#A8A878";

// Estilo de ataque por tipo: raio sustentado, projétil, ou corpo-a-corpo.
const BEAM = new Set(["electric", "water", "ice", "dragon", "psychic"]);
const ORB = new Set(["fire", "grass", "poison", "ghost", "fairy", "dark", "bug"]);
// resto (fighting/rock/ground/steel/normal/flying) = melee

type Phase = "windup" | "strike" | "recover";

export function ReplayCanvas({ data }: { data: ReplayData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [currentLog, setCurrentLog] = useState(0);

  // Refs mutáveis para o loop de animação (não disparam re-render).
  const spritesRef = useRef<Record<string, HTMLImageElement>>({});
  const bgRef = useRef<HTMLImageElement | null>(null);
  const texRef = useRef<Record<string, HTMLImageElement>>({});
  const tintRef = useRef<Record<string, HTMLCanvasElement>>({});
  const stateRef = useRef<ReturnType<typeof initState> | null>(null);
  const playRef = useRef(playing);
  const speedRef = useRef(speed);
  playRef.current = playing;
  speedRef.current = speed;

  // Carrega sprites reais.
  useEffect(() => {
    const map: Record<string, HTMLImageElement> = {};
    for (const c of data.teams) {
      const img = new Image();
      img.src = c.sprite;
      map[c.id] = img;
    }
    spritesRef.current = map;
    if (data.bgUrl) {
      const bg = new Image();
      bg.src = data.bgUrl;
      bg.onload = () => { bgRef.current = bg; };
      bg.onerror = () => { bgRef.current = null; };
    } else bgRef.current = null;
    // texturas de efeito (opcional: se faltarem, cai no procedural)
    if (Object.keys(texRef.current).length === 0) {
      for (const name of TEX_FILES) {
        const img = new Image();
        img.src = `/replay-lab/fx/${name}.webp`;
        img.onload = () => { texRef.current[name] = img; };
      }
    }
  }, [data]);

  // (Re)inicializa estado quando os dados mudam ou ao reiniciar.
  const resetKey = useRef(0);
  function initState() {
    const W = 920, H = 440;
    const actors: Record<string, Actor> = {};
    // Coloca cada time em 2 colunas pela postura: "front" perto do centro,
    // "back" perto da borda — reduz sobreposição e reflete a formação.
    const place = (list: Combatant[], side: "A" | "B") => {
      const cols = {
        front: side === "A" ? W * 0.34 : W * 0.66,
        back: side === "A" ? W * 0.16 : W * 0.84,
      };
      const groups = { front: list.filter((c) => laneOf(c.role) === "front"), back: list.filter((c) => laneOf(c.role) === "back") };
      (["front", "back"] as const).forEach((lane) => {
        const g = groups[lane]; const x = cols[lane];
        g.forEach((c, i) => {
          const y = H * (i + 1) / (g.length + 1);
          actors[c.id] = {
            c, hx: x, hy: y, x, y, hp: c.maxHp, shownHp: c.maxHp,
            face: side === "A" ? -1 : 1, kx: 0, ky: 0, fainted: false, faintT: 0,
            shield: 0, flash: 0, wobble: Math.random() * Math.PI * 2,
            rtx: x, rty: y, roamCd: Math.random() * 600,
          };
        });
      });
    };
    place(data.teams.filter((c) => c.side === "A"), "A");
    place(data.teams.filter((c) => c.side === "B"), "B");
    return {
      W, H, actors, t0: performance.now(), scene: null as Scene | null,
      sceneIdx: -1, particles: [] as Particle[], pops: [] as Pop[],
      shake: 0, done: false, doneT: 0, idleGap: 500, flashCol: "#ffffff", flashA: 0,
      stepMode: false, requestPause: false,
      koBanners: [], bolt: null, ring: null, fx: [],
    } as St;
  }

  useEffect(() => {
    stateRef.current = initState();

    setCurrentLog(0);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const st = stateRef.current!;
      const dt = Math.min(48, now - last) * speedRef.current;
      last = now;
      try {
        if (playRef.current && !st.done) step(st, dt, data, (i) => setCurrentLog(i));
        if (st.requestPause) { st.requestPause = false; playRef.current = false; setPlaying(false); }
        draw(ctx, st, spritesRef.current, bgRef.current, playRef.current ? dt : 0, texRef.current, tintRef.current, data.winnerName ?? null);
      } catch (err) {
        // Nunca deixa um frame ruim matar o replay: descarta o transitório e segue.
        console.error("[replay] frame error, pulando cena", err);
        st.scene = null; st.bolt = null;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, resetKey.current]);

  const restart = () => { resetKey.current++; stateRef.current = initState(); playRef.current = true; setPlaying(true); };
  // Vai para o turno T, aplicando instantaneamente os anteriores, e ANIMA o
  // turno T, pausando ao fim (passo-a-passo). Evita snaps/dessincronia.
  const playTurn = (T: number) => {
    const n = data.turns.length;
    if (n === 0) return;
    T = Math.max(0, Math.min(n - 1, T));
    const fresh = initState();
    for (let i = 0; i < T; i++) applyInstant(fresh, data.turns[i], data);
    fresh.sceneIdx = T - 1; // próximo a animar = T
    fresh.idleGap = 0;      // sem limbo antes de animar
    fresh.stepMode = true;  // pausa automaticamente ao terminar o turno
    stateRef.current = fresh;
    setCurrentLog(T);
    playRef.current = true; setPlaying(true);
  };
  const jump = (dir: number) => {
    const st = stateRef.current; if (!st) return;
    playTurn(st.sceneIdx + dir);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-slate-700 bg-[#0b1020]">
        <canvas ref={canvasRef} width={920} height={440} className="block w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setPlaying((p) => !p)} className="rounded-lg bg-[#FFCB05] px-4 py-1.5 text-xs font-bold text-[#1A1A2E]">
          {playing ? "❚❚ Pausar" : "▶ Reproduzir"}
        </button>
        <button onClick={restart} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200">↺ Reiniciar</button>
        <button onClick={() => jump(-1)} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200">‹ Turno</button>
        <button onClick={() => jump(1)} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200">Turno ›</button>
        <div className="ml-auto flex items-center gap-1">
          {[0.5, 1, 2].map((s) => (
            <button key={s} onClick={() => setSpeed(s)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${speed === s ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/40" : "border border-slate-700 text-slate-400"}`}>{s}×</button>
          ))}
        </div>
      </div>
      <CurrentActionCaption turn={data.turns[currentLog]} teams={data.teams} />
    </div>
  );
}

// Legenda da ação atual — mesma leitura/visualização do replay clássico.
function CurrentActionCaption({ turn, teams }: { turn?: ReplayTurn; teams: Combatant[] }) {
  const name = (id: string) => teams.find((c) => c.id === id)?.name ?? "?";
  if (!turn) return <div className="min-h-[60px] rounded-xl border border-border bg-slate-900/60 px-4 py-3 text-center text-sm text-slate-500 flex items-center justify-center">Preparando batalha…</div>;
  const verb = turn.action === "ATTACK" ? " atacou " : turn.action === "HEAL" ? " curou " : turn.action === "DEFEND" ? " defendeu " : " usou habilidade em ";
  return (
    <div className="min-h-[60px] rounded-xl border border-border bg-slate-900/60 px-4 py-3 text-center flex flex-col items-center justify-center">
      <p className="text-sm text-slate-300">
        <span className="font-bold text-[#FFCB05]">{name(turn.actorId)}</span>
        {verb}
        <span className="font-bold text-[#FFCB05]">{name(turn.targetId)}</span>
      </p>
      {turn.action === "ATTACK" && (
        <p className="mt-0.5 text-xs">
          <span className="font-bold text-red-400">-{turn.damage} HP</span>
          {turn.advantageApplied && <span className="ml-1.5 text-[10px] text-green-400">Super efetivo!{turn.multiplier ? ` ×${turn.multiplier.toFixed(1)}` : ""}</span>}
        </p>
      )}
      {turn.action === "HEAL" && <p className="mt-0.5 text-xs"><span className="font-bold text-emerald-400">+{turn.damage} HP</span></p>}
      {turn.effect && <EffectChips effect={turn.effect} className="mt-1 justify-center" />}
    </div>
  );
}

// ────────────────────────── estado / animação ──────────────────────────
type Actor = {
  c: Combatant; hx: number; hy: number; x: number; y: number;
  hp: number; shownHp: number; face: 1 | -1; kx: number; ky: number;
  fainted: boolean; faintT: number; shield: number; flash: number; wobble: number;
  rtx: number; rty: number; roamCd: number; // alvo de deriva + cooldown p/ repicar
};
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; shape?: "circle" | "spark" | "leaf" | "shard" | "chunk" | "star"; g?: number; spin?: number; rot?: number };
type Pop = { x: number; y: number; text: string; color: string; life: number; vy: number };
type Scene = { turn: ReplayTurn; phase: Phase; pt: number; fired: boolean; style: "beam" | "orb" | "melee" | "heal" | "support"; ox?: number; oy?: number };
// Efeito visual transitório desenhado por cima da cena (anéis, raios, rachaduras,
// chamas, aura de habilidade, etc). `t` sobe de 0→life.
type Fx = { kind: string; x: number; y: number; t: number; life: number; color: string; seed: number; max: number; x2?: number; y2?: number; tex?: string };
type Bolt = { x: number; y: number; tx: number; ty: number; color: string; kind: string; t: number; onHit: () => void };
type St = {
  W: number; H: number; actors: Record<string, Actor>; t0: number;
  scene: Scene | null; sceneIdx: number; particles: Particle[]; pops: Pop[];
  shake: number; done: boolean; doneT: number; idleGap: number; flashCol: string; flashA: number;
  stepMode: boolean; requestPause: boolean; // passo-a-passo: anima 1 turno e pausa
  koBanners: { id: string; t: number }[];
  bolt: Bolt | null;
  ring: { x: number; y: number; r: number; max: number; color: string; life: number } | null;
  fx: Fx[];
};

const DUR = { windup: 300, strike: 340, recover: 300 };

function styleOf(t: ReplayTurn): Scene["style"] {
  if (t.action === "HEAL") return "heal";
  if (t.action === "DEFEND") return "support";
  if (t.debuff || (t.action === "ABILITY" && t.damage === 0)) return "support";
  const ty = t.attackerType ?? "normal";
  if (BEAM.has(ty)) return "beam";
  if (ORB.has(ty)) return "orb";
  return "melee";
}

function step(st: St, dt: number, data: ReplayData, onTurn: (i: number) => void) {
  // decays
  st.shake = Math.max(0, st.shake - dt * 0.02);
  for (const a of Object.values(st.actors)) {
    a.kx *= 0.82; a.ky *= 0.82; a.flash = Math.max(0, a.flash - dt * 0.003);
    if (a.shield > 0 && (!st.scene || st.scene.turn.guardianInterceptId !== a.c.id)) a.shield = Math.max(0, a.shield - dt * 0.002);
    a.shownHp += (a.hp - a.shownHp) * Math.min(1, dt * 0.01);
    a.wobble += dt * 0.004;
    if (a.fainted) a.faintT += dt;
  }
  st.particles = st.particles.filter((p) => (p.life -= dt) > 0);
  st.particles.forEach((p) => { p.x += p.vx * dt * 0.06; p.y += p.vy * dt * 0.06; p.vy += dt * 0.002 * (p.g ?? 1); if (p.spin) p.rot = (p.rot ?? 0) + p.spin * dt; });
  st.pops = st.pops.filter((p) => (p.life -= dt) > 0);
  st.pops.forEach((p) => { p.y += p.vy * dt * 0.05; });

  if (!st.scene) {
    // Intervalo entre turnos: todos vagueiam livremente pelo campo.
    roam(st, dt, null);
    if (st.idleGap > 0) { st.idleGap -= dt; return; }
    const next = st.sceneIdx + 1;
    if (next >= data.turns.length) { st.done = true; return; }
    st.sceneIdx = next;
    onTurn(next);
    st.scene = { turn: data.turns[next], phase: "windup", pt: 0, fired: false, style: styleOf(data.turns[next]) };
    st.idleGap = 420 + Math.random() * 360; // próxima pausa de movimentação
    return;
  }
  // Durante a cena, quem não participa continua andando pelo campo.
  const sc = st.scene;
  const busy = new Set([sc.turn.actorId, sc.turn.targetId, sc.turn.guardianInterceptId ?? ""]);
  roam(st, dt, busy);
  runScene(st, dt);
  // Passo-a-passo: ao terminar a cena animada, pausa automaticamente.
  if (!st.scene && st.stepMode) { st.stepMode = false; st.requestPause = true; }
}

// Deriva livre: cada ator caminha até um alvo aleatório dentro da sua metade
// do campo; ao chegar (ou expirar o cooldown) sorteia outro. `exclude` pula
// quem está animando um golpe.
function roam(st: St, dt: number, exclude: Set<string> | null) {
  const { W, H } = st;
  for (const a of Object.values(st.actors)) {
    if (a.fainted || (exclude && exclude.has(a.c.id))) continue;
    a.roamCd -= dt;
    const dx = a.rtx - a.x, dy = a.rty - a.y;
    if (a.roamCd <= 0 || dx * dx + dy * dy < 100) {
      // vagueia perto da coluna da sua postura (hx), não por toda a metade
      a.rtx = Math.max(24, Math.min(W - 24, a.hx + (Math.random() - 0.5) * 0.14 * W));
      a.rty = 0.14 * H + Math.random() * 0.72 * H;
      a.roamCd = 700 + Math.random() * 900;
    }
    a.x += (a.rtx - a.x) * Math.min(1, dt * 0.0022);
    a.y += (a.rty - a.y) * Math.min(1, dt * 0.0022);
    // sprite de frente olha p/ a esquerda por padrão: time A espelha (p/ direita), time B natural
    a.face = a.c.side === "A" ? -1 : 1;
  }
}

function runScene(st: St, dt: number) {
  const sc = st.scene!;
  const actor = st.actors[sc.turn.actorId];
  const target = st.actors[sc.turn.targetId];
  const guardian = sc.turn.guardianInterceptId ? st.actors[sc.turn.guardianInterceptId] : null;
  const hitTarget = target; // o golpe é desferido contra o ALVO (o guardião só absorve parte)
  // ator/alvo fora do lineup (ex.: reserva que entrou no meio): aplica o HP e
  // segue rápido, sem animar nem travar.
  if (!actor || !target) { applyOutcome(st, sc.turn, { instant: true }); st.scene = null; st.idleGap = 0; return; }
  if (sc.ox === undefined) {
    sc.ox = actor.x; sc.oy = actor.y; // origem ao iniciar a cena
    // atacante encara o alvo; alvo (e guardião) encaram o atacante
    // (face=-1 = espelhado = olhando p/ a direita)
    actor.face = hitTarget.x >= actor.x ? -1 : 1;
    hitTarget.face = actor.x >= hitTarget.x ? -1 : 1;
    if (target !== hitTarget) target.face = actor.x >= target.x ? -1 : 1;
  }
  sc.pt += dt;

  if (sc.phase === "windup") {
    if (sc.style === "melee") {
      // investe a partir de onde estava, parando junto ao alvo
      const p = Math.min(1, sc.pt / DUR.windup);
      actor.x = sc.ox! + (hitTarget.x - sc.ox!) * 0.78 * ease(p);
      actor.y = sc.oy! + (hitTarget.y - sc.oy!) * 0.78 * ease(p);
      actor.face = hitTarget.x >= actor.x ? -1 : 1;
    } else if (sc.style === "heal" || sc.style === "support") {
      const p = Math.min(1, sc.pt / DUR.windup);
      actor.y = sc.oy! - 8 * Math.sin(p * Math.PI);
    } else {
      // carregamento: partículas convergindo p/ o atacante
      if (Math.random() < 0.5) {
        const ang = Math.random() * Math.PI * 2, r = 40;
        st.particles.push({ x: actor.x + Math.cos(ang) * r, y: actor.y + Math.sin(ang) * r, vx: -Math.cos(ang) * 6, vy: -Math.sin(ang) * 6, life: 220, max: 220, color: hex(sc.turn.attackerType), size: 3 });
      }
    }
    if (guardian && guardian !== target) guardian.shield = 1; // Guardião ergue escudo
    if (sc.pt >= DUR.windup) { sc.phase = "strike"; sc.pt = 0; }
    return;
  }

  if (sc.phase === "strike") {
    if (!sc.fired) {
      sc.fired = true;
      fireVfx(st, sc, actor, hitTarget);
      applyOutcome(st, sc.turn, { instant: false });
    }
    if (sc.pt >= DUR.strike) { sc.phase = "recover"; sc.pt = 0; }
    return;
  }

  // recover: volta à base
  const p = Math.min(1, sc.pt / DUR.recover);
  actor.x += (actor.hx - actor.x) * Math.min(1, dt * 0.012);
  actor.y += (actor.hy - actor.y) * Math.min(1, dt * 0.012);
  if (p >= 1) st.scene = null;
}

// Parâmetros de impacto por tipo — dão "cara" a cada elemento.
type ImpactCfg = { cols: string[]; shape: Particle["shape"]; g: number; speed: number; count: number; size: [number, number]; life: number; spin?: boolean; rise?: number };
const IMPACT: Record<string, ImpactCfg> = {
  fire: { cols: ["#F08030", "#FFD070", "#FF5020"], shape: "circle", g: 0.3, speed: 5, count: 24, size: [2, 5], life: 480, rise: 2 },
  water: { cols: ["#6890F0", "#B0D0FF", "#3060C0"], shape: "circle", g: 1.5, speed: 6, count: 24, size: [2, 4], life: 520 },
  electric: { cols: ["#F8D030", "#FFF8A0", "#FFFFFF"], shape: "spark", g: 0.1, speed: 12, count: 26, size: [1.5, 3], life: 320 },
  grass: { cols: ["#78C850", "#B8E060", "#4A8020"], shape: "leaf", g: 0.25, speed: 4.5, count: 22, size: [3, 6], life: 680, spin: true, rise: 1 },
  ice: { cols: ["#A8E4E4", "#E8FBFB", "#5FB0C8"], shape: "shard", g: 0.6, speed: 7.5, count: 24, size: [3, 6], life: 460 },
  rock: { cols: ["#B8A038", "#8A7020", "#D8C060"], shape: "chunk", g: 2.2, speed: 6, count: 22, size: [3, 6], life: 540, spin: true },
  ground: { cols: ["#E0C068", "#B89040", "#F0E0A0"], shape: "chunk", g: 2.0, speed: 6, count: 22, size: [3, 6], life: 540, spin: true },
  fighting: { cols: ["#FFFFFF", "#FFE0A0", "#C03028"], shape: "star", g: 0.5, speed: 8, count: 20, size: [3, 6], life: 360 },
  normal: { cols: ["#FFFFFF", "#FFE0A0", "#A8A878"], shape: "circle", g: 0.6, speed: 7, count: 18, size: [2, 4], life: 340 },
  steel: { cols: ["#D8D8E8", "#FFFFFF", "#8080A0"], shape: "spark", g: 0.6, speed: 9, count: 22, size: [1.5, 3], life: 360 },
  psychic: { cols: ["#F85888", "#FFB0D0", "#C03070"], shape: "circle", g: 0, speed: 5, count: 24, size: [2, 4], life: 560, rise: 1 },
  ghost: { cols: ["#705898", "#B090E0", "#402868"], shape: "circle", g: -0.2, speed: 3.5, count: 22, size: [3, 6], life: 650, rise: 2 },
  fairy: { cols: ["#EE99AC", "#FFD0E0", "#FFFFFF"], shape: "circle", g: -0.1, speed: 4, count: 24, size: [1.5, 3.5], life: 600, rise: 1 },
  poison: { cols: ["#A040A0", "#D070D0", "#602060"], shape: "circle", g: -0.3, speed: 3.5, count: 22, size: [2, 5], life: 600, rise: 2 },
  dark: { cols: ["#705848", "#A08870", "#2A2030"], shape: "circle", g: 0.3, speed: 6, count: 20, size: [2, 5], life: 480 },
  dragon: { cols: ["#7038F8", "#B090FF", "#4020A0"], shape: "circle", g: 0, speed: 8, count: 28, size: [2, 4], life: 480 },
  bug: { cols: ["#A8B820", "#D0E060", "#708010"], shape: "circle", g: 0.6, speed: 6, count: 18, size: [2, 4], life: 480 },
  flying: { cols: ["#A890F0", "#D0C0FF", "#FFFFFF"], shape: "circle", g: -0.2, speed: 7, count: 18, size: [1.5, 3], life: 480, rise: 2 },
};
function emitImpact(st: St, type: string | undefined, x: number, y: number, supa: boolean) {
  const p = IMPACT[type ?? "normal"] ?? IMPACT.normal;
  const mult = supa ? 1.6 : 1;
  const n = Math.round(p.count * mult);
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = p.speed * (0.5 + Math.random()) * mult;
    // maiores e mais duradouras p/ ficarem claramente visíveis
    const size = (p.size[0] + Math.random() * (p.size[1] - p.size[0])) * 1.6;
    const life = p.life * (0.9 + Math.random() * 0.5);
    st.particles.push({
      x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - (p.rise ?? 0),
      life, max: life, color: p.cols[(Math.random() * p.cols.length) | 0],
      size, shape: p.shape, g: p.g, spin: p.spin ? (Math.random() - 0.5) * 0.02 : 0, rot: Math.random() * 6,
    });
  }
}

// Estilo do projétil por tipo (só vale p/ ataques à distância).
const PROJ: Record<string, string> = {
  fire: "comet", water: "droplet", grass: "leafspin", electric: "boltline", ice: "shardp",
  psychic: "helix", dragon: "helix", ghost: "wisp", dark: "orb", fairy: "spark", poison: "glob", bug: "orb",
};
const projKind = (type?: string) => PROJ[type ?? ""] ?? "orb";

const pushFx = (st: St, kind: string, x: number, y: number, life: number, color: string, extra: Partial<Fx> = {}) =>
  st.fx.push({ kind, x, y, t: 0, life, color, seed: Math.random() * 1000, max: 0, ...extra });

// Assinatura de impacto por elemento: efeitos desenhados por cima + partículas
// extras, além das faíscas base de emitImpact().
function emitSignature(st: St, type: string | undefined, x: number, y: number, supa: boolean) {
  const t = type ?? "normal";
  const big = supa ? 1.4 : 1;
  const col = hex(t);
  // textura "herói" (glow central recolorido pelo tipo) — complementa o procedural
  pushFx(st, "tex", x, y, 560, col, { tex: TEX_FOR[t] ?? "impact", max: supa ? 1.5 : 1 });
  switch (t) {
    case "fire":
      pushFx(st, "flame", x, y, 460 * big, "#ff7a18");
      for (let i = 0; i < 10; i++) st.particles.push({ x: x + (Math.random() - 0.5) * 24, y, vx: (Math.random() - 0.5) * 2, vy: -2 - Math.random() * 2, life: 700, max: 700, color: "rgba(60,40,40,0.7)", size: 4 + Math.random() * 4, g: -0.3 });
      break;
    case "water":
      pushFx(st, "ripple", x, y + 10, 460, "#6fb0ff");
      for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8; const sp = 4 + Math.random() * 5; st.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 560, max: 560, color: ["#9fd0ff", "#dff0ff"][(Math.random() * 2) | 0], size: 2 + Math.random() * 2.5, g: 1.6 }); }
      break;
    case "grass":
      pushFx(st, "petalring", x, y, 440, "#8fe060");
      break;
    case "electric":
      pushFx(st, "bolts", x, y, 300 * big, "#ffe14d");
      pushFx(st, "ring", x, y, 260, col, { max: supa ? 82 : 52 });
      break;
    case "ice":
      pushFx(st, "frost", x, y, 500, "#bfefff");
      pushFx(st, "star", x, y, 360, "#eaffff");
      break;
    case "rock": case "ground":
      pushFx(st, "crack", x, y + 12, 540, t === "ground" ? "#e0c068" : "#caa94e");
      for (let i = 0; i < 12; i++) st.particles.push({ x, y: y + 6, vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 1.5, life: 600, max: 600, color: "rgba(120,100,70,0.6)", size: 3 + Math.random() * 3, g: -0.1 });
      break;
    case "psychic":
      pushFx(st, "ring", x, y, 340, col, { max: supa ? 90 : 60 });
      pushFx(st, "runes", x, y, 540, "#ff79b0");
      break;
    case "ghost":
      pushFx(st, "tendrils", x, y, 580, "#b090e0");
      break;
    case "dark":
      pushFx(st, "implode", x, y, 440, "#2a1838");
      break;
    case "fairy":
      pushFx(st, "sparkstar", x, y, 480, "#ffd6ef");
      break;
    case "dragon":
      pushFx(st, "ring", x, y, 380, col, { max: supa ? 96 : 64 });
      pushFx(st, "ring", x, y, 300, "#ffffff", { max: supa ? 70 : 46 });
      break;
    case "poison":
      pushFx(st, "ripple", x, y + 8, 440, "#b060c0");
      for (let i = 0; i < 12; i++) st.particles.push({ x: x + (Math.random() - 0.5) * 26, y, vx: (Math.random() - 0.5) * 1.5, vy: -2 - Math.random() * 2, life: 680, max: 680, color: ["#c879d8", "#8a3c9a"][(Math.random() * 2) | 0], size: 3 + Math.random() * 3, g: -0.3 });
      break;
    default:
      pushFx(st, "ring", x, y, 300, col, { max: supa ? 70 : 46 });
  }
}

// Efeito especial de CONJURAÇÃO de habilidade (no próprio mascote).
function castAbility(st: St, a: Actor, color: string) {
  pushFx(st, "aura", a.x, a.y - 4, 620, color);
  pushFx(st, "beamcol", a.x, a.y - 4, 520, color);
  pushFx(st, "tex", a.x, a.y - 4, 640, color, { tex: "impact", max: 1.3 });
  for (let i = 0; i < 22; i++) { const ang = Math.random() * Math.PI * 2, r = 20 + Math.random() * 14; st.particles.push({ x: a.x + Math.cos(ang) * r, y: a.y + 6 + Math.random() * 10, vx: -Math.cos(ang) * 1.2, vy: -3 - Math.random() * 2.5, life: 620, max: 620, color: ["#ffffff", color][(Math.random() * 2) | 0], size: 2 + Math.random() * 2, g: -0.15 }); }
  st.flashCol = color; st.flashA = 0.22;
  a.flash = 0.8;
}

// Efeito de "resistiu ao golpe fatal" (Sobrevivente / Dramático sobrevive com 1 HP).
function lastStand(st: St, a: Actor, color: string, label: string) {
  st.shake = 15; st.flashCol = color; st.flashA = 0.3; a.flash = 1; a.shield = 1;
  pushFx(st, "ring", a.x, a.y - 4, 440, color, { max: 92 });
  pushFx(st, "aura", a.x, a.y - 4, 640, color);
  pushFx(st, "tex", a.x, a.y - 4, 580, color, { tex: "impact", max: 1.5 });
  for (let i = 0; i < 26; i++) { const ang = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 5; st.particles.push({ x: a.x, y: a.y - 4, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2, life: 640, max: 640, color: ["#ffffff", color][(Math.random() * 2) | 0], size: 2 + Math.random() * 2.5, g: -0.12 }); }
  st.pops.push({ x: a.x, y: a.y - 60, text: label, color, life: 1300, vy: -0.55 });
  st.pops.push({ x: a.x, y: a.y - 40, text: "AGUENTOU COM 1 HP!", color: "#ffffff", life: 1150, vy: -0.45 });
}

function fireVfx(st: St, sc: Scene, actor: Actor, target: Actor) {
  const color = hex(sc.turn.attackerType);
  const supa = !!sc.turn.advantageApplied;
  const ability = sc.turn.abilityName;
  // Conjuração de habilidade ganha destaque próprio no atacante.
  if (sc.turn.action === "ABILITY") castAbility(st, actor, color);
  // Nome da habilidade/golpe sobe a partir do atacante ao conjurar.
  if (ability) st.pops.push({ x: actor.x, y: actor.y - 54, text: ability, color: color, life: 1100, vy: -0.5 });
  if (sc.style === "heal") {
    pushFx(st, "healring", target.x, target.y, 520, "#22c55e");
    pushFx(st, "tex", target.x, target.y, 520, "#22c55e", { tex: "impact", max: 1 });
    for (let i = 0; i < 28; i++) st.particles.push({ x: target.x + (Math.random() - 0.5) * 46, y: target.y + 24, vx: (Math.random() - 0.5) * 2, vy: -4 - Math.random() * 3, life: 620, max: 620, color: ["#4ade80", "#bbf7d0", "#16a34a"][(Math.random() * 3) | 0], size: 2 + Math.random() * 2.5, g: -0.25 });
    st.pops.push({ x: target.x, y: target.y - 44, text: `+${sc.turn.damage}`, color: "#4ade80", life: 950, vy: -0.8 });
    target.flash = 0.6;
    return;
  }
  if (sc.style === "support") {
    // Debuff/defesa: aura roxa descendo sobre o alvo.
    pushFx(st, "runes", target.x, target.y, 520, "#c084fc");
    for (let i = 0; i < 22; i++) st.particles.push({ x: target.x + (Math.random() - 0.5) * 40, y: target.y - 34 - Math.random() * 22, vx: (Math.random() - 0.5) * 1.5, vy: 3 + Math.random() * 2.5, life: 680, max: 680, color: ["#c084fc", "#a855f7", "#e9d5ff"][(Math.random() * 3) | 0], size: 2 + Math.random() * 3, g: 0.2 });
    st.pops.push({ x: target.x, y: target.y - 44, text: ability ?? "DEBUFF", color: "#c084fc", life: 1050, vy: -0.6 });
    return;
  }
  // golpes ofensivos → impacto no alvo
  const settle = () => {
    const dx = Math.sign(target.x - actor.x) || target.face * -1;
    target.kx += dx * (supa ? 18 : 12);
    target.flash = 1;
    emitImpact(st, sc.turn.attackerType, target.x, target.y, supa); // faíscas por tipo
    emitSignature(st, sc.turn.attackerType, target.x, target.y, supa); // assinatura elemental
    st.pops.push({ x: target.x, y: target.y - 40, text: `${sc.turn.damage}`, color: supa ? "#fbbf24" : "#fff", life: 850, vy: -0.9 });
    if (supa) { st.shake = 15; st.flashCol = color; st.flashA = 0.18; st.pops.push({ x: target.x, y: target.y - 62, text: "SUPER EFICAZ!", color: "#fbbf24", life: 1000, vy: -0.7 }); }
    else st.shake = 6;
    // Último ato / Sobrevivente: resistiu a um golpe fatal (ficou com 1 HP).
    const eff = sc.turn.effect ?? "";
    if (/resistiu ao golpe fatal/i.test(eff)) lastStand(st, target, "#ffd166", "✦ SOBREVIVENTE");
    else if (/último ato|ultimo ato|sobreviveu com 1 hp/i.test(eff)) lastStand(st, target, "#ff6ad5", "🎭 ÚLTIMO ATO");
    // Guardião: escudo + número absorvido sobre o PRÓPRIO guardião.
    if (sc.turn.guardianInterceptId) {
      const g = st.actors[sc.turn.guardianInterceptId];
      if (g) {
        g.shield = 1; g.flash = 0.8;
        pushFx(st, "ring", g.x, g.y - 6, 300, "#38bdf8", { max: 40 });
        st.pops.push({ x: g.x, y: g.y - 40, text: `🛡 ${sc.turn.guardianInterceptDamage ?? 0}`, color: "#38bdf8", life: 1050, vy: -0.6 });
      }
    }
  };
  if (sc.style === "melee") {
    settle();
  } else {
    // projétil elemental viajando; impacto agendado ao chegar
    st.bolt = { x: actor.x, y: actor.y, tx: target.x, ty: target.y, color, kind: projKind(sc.turn.attackerType), t: 0, onHit: settle };
  }
}

// aplica dano/cura ao estado de HP (visual).
function applyOutcome(st: St, t: ReplayTurn, _o: { instant: boolean }) {
  const ko = (victim: Actor | undefined) => {
    if (!victim || victim.hp > 0 || victim.fainted) return;
    victim.fainted = true; victim.faintT = 0; victim.shield = 0;
    if (!_o.instant) { st.shake = 12; st.pops.push({ x: victim.x, y: victim.y - 50, text: "NOCAUTE!", color: "#ff5252", life: 1100, vy: -0.6 }); st.koBanners.push({ id: victim.c.id, t: 0 }); }
  };
  if (t.action === "HEAL") { const tgt = st.actors[t.targetId]; if (tgt) tgt.hp = t.targetHpAfter; return; }
  if (t.action === "ABILITY" && t.debuff) return; // debuff não altera HP
  if (t.action === "DEFEND") return;
  // O ALVO leva o dano (já reduzido pela absorção); o GUARDIÃO perde o que absorveu.
  const target = st.actors[t.targetId];
  if (target) { target.hp = Math.max(0, t.targetHpAfter); ko(target); }
  if (t.guardianInterceptId && t.guardianHpAfter !== undefined) {
    const g = st.actors[t.guardianInterceptId];
    if (g) { g.hp = Math.max(0, t.guardianHpAfter); ko(g); }
  }
}

// pulo imediato (seek por turno): sem animação, só estado final.
function applyInstant(st: St, t: ReplayTurn, _data: ReplayData) {
  applyOutcome(st, t, { instant: true });
  for (const a of Object.values(st.actors)) { if (a.fainted) a.faintT = RECALL_MS; a.shownHp = a.hp; }
}

const ease = (p: number) => 1 - Math.pow(1 - p, 3);

// ────────────────────────── desenho ──────────────────────────
function draw(ctx: CanvasRenderingContext2D, st: St, sprites: Record<string, HTMLImageElement>, bg: HTMLImageElement | null, dt: number, tex: Record<string, HTMLImageElement>, tintCache: Record<string, HTMLCanvasElement>, winnerName: string | null) {
  const { W, H } = st;
  ctx.save();
  if (st.shake > 0) ctx.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake);

  if (bg && bg.complete && bg.naturalWidth > 0) {
    // imagem de arena cobrindo o canvas (cover)
    const s = Math.max((W + 40) / bg.naturalWidth, (H + 40) / bg.naturalHeight);
    const iw = bg.naturalWidth * s, ih = bg.naturalHeight * s;
    ctx.drawImage(bg, (W - iw) / 2, (H - ih) / 2, iw, ih);
    ctx.fillStyle = "rgba(7,11,24,0.28)"; ctx.fillRect(-20, -20, W + 40, H + 40); // leve escurecida p/ contraste
  } else {
    // fallback: arena procedural
    const g = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, "#152044"); g.addColorStop(1, "#070b18");
    ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.strokeStyle = "rgba(120,160,255,0.12)"; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 46) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 46) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = "rgba(255,203,5,0.18)"; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
  }

  // bolt (projétil elemental) em voo
  if (st.bolt) {
    const b = st.bolt; b.t += dt * (b.kind === "boltline" ? 0.011 : 0.006);
    const p = Math.min(1, b.t);
    const cx = b.x + (b.tx - b.x) * ease(p);
    const cy = b.y + (b.ty - b.y) * ease(p);
    drawBolt(ctx, st, b, cx, cy);
    if (b.t >= 1) { b.onHit(); st.bolt = null; }
  }

  // efeitos elementais (anéis, raios, rachaduras, chamas, aura de habilidade…)
  st.fx = st.fx.filter((f) => f.t < f.life);
  for (const f of st.fx) {
    if (f.kind === "tex") drawTex(ctx, f, tex, tintCache);
    else drawFx(ctx, f);
    f.t += dt;
  }

  // anel de impacto simples (quando usado diretamente)
  if (st.ring) {
    const r = st.ring; r.r += (r.max - r.r) * 0.2; r.life -= dt;
    const al = Math.max(0, r.life / 320);
    ctx.save(); ctx.shadowBlur = 16; ctx.shadowColor = r.color;
    ctx.globalAlpha = al; ctx.strokeStyle = r.color; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = al * 0.8; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r * 0.72, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    if (r.life <= 0) st.ring = null;
  }

  // partículas (forma varia por tipo de efeito)
  for (const p of st.particles) {
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max)); ctx.fillStyle = p.color;
    ctx.shadowBlur = 12; ctx.shadowColor = p.color;
    const vang = Math.atan2(p.vy, p.vx);
    if (p.shape === "spark") {
      // risco na direção do movimento (faísca elétrica / metálica)
      const len = 3 + p.size * 2;
      const n = Math.hypot(p.vx, p.vy) || 1;
      ctx.strokeStyle = p.color; ctx.lineCap = "round"; ctx.lineWidth = Math.max(1, p.size * 0.6);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - (p.vx / n) * len, p.y - (p.vy / n) * len); ctx.stroke();
    } else if (p.shape === "leaf") {
      // folha: elipse pontuda girando e seguindo o movimento
      ctx.translate(p.x, p.y); ctx.rotate(vang + (p.rot ?? 0));
      ctx.beginPath(); ctx.ellipse(0, 0, p.size * 1.6, p.size * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-p.size * 1.5, 0); ctx.lineTo(p.size * 1.5, 0); ctx.stroke();
    } else if (p.shape === "shard") {
      // estilhaço de gelo: losango fino alinhado ao movimento
      ctx.translate(p.x, p.y); ctx.rotate(vang);
      ctx.beginPath(); ctx.moveTo(p.size * 2, 0); ctx.lineTo(0, p.size * 0.75); ctx.lineTo(-p.size * 1.3, 0); ctx.lineTo(0, -p.size * 0.75); ctx.closePath(); ctx.fill();
    } else if (p.shape === "chunk") {
      // fragmento de rocha: pentágono irregular girando
      ctx.translate(p.x, p.y); ctx.rotate(p.rot ?? 0);
      const s = p.size;
      ctx.beginPath(); ctx.moveTo(-s, -s * 0.8); ctx.lineTo(s * 0.9, -s); ctx.lineTo(s, s * 0.6); ctx.lineTo(0, s); ctx.lineTo(-s * 0.9, s * 0.5); ctx.closePath(); ctx.fill();
    } else if (p.shape === "star") {
      // faísca de impacto físico: estrela de 4 pontas
      ctx.translate(p.x, p.y); ctx.rotate(p.rot ?? 0);
      const s = p.size;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.4 : s * 1.6; const a2 = (i / 8) * Math.PI * 2; ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r); }
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // atores
  const ordered = Object.values(st.actors).sort((a, b) => a.y - b.y);
  for (const a of ordered) drawActor(ctx, a, sprites[a.c.id], tex);

  // pops de dano/cura
  ctx.textAlign = "center"; ctx.font = "bold 20px 'Jost', system-ui, sans-serif";
  for (const p of st.pops) {
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 400)); ctx.fillStyle = p.color;
    ctx.shadowBlur = 6; ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.fillText(p.text, p.x, p.y); ctx.restore();
  }

  // barras de NOCAUTE no topo (sprite + nome), empilhadas e temporárias
  const KO_LIFE = 2100;
  st.koBanners = st.koBanners.filter((k) => k.t < KO_LIFE);
  const visibleKo = st.koBanners.slice(-3);
  visibleKo.forEach((k, idx) => {
    const a = st.actors[k.id];
    if (a) drawKoBanner(ctx, W, a.c, sprites[k.id], k.t, KO_LIFE, idx);
  });
  st.koBanners.forEach((k) => { k.t += dt; });

  // banner animado do vencedor ao fim do combate
  if (st.done) {
    st.doneT += dt;
    if (winnerName) drawWinnerBanner(ctx, W, H, winnerName, st.doneT);
  }

  // flash de tela (super-eficaz / conjuração de habilidade)
  if (st.flashA > 0.01) {
    ctx.save(); ctx.globalAlpha = st.flashA; ctx.fillStyle = st.flashCol; ctx.fillRect(-20, -20, W + 40, H + 40); ctx.restore();
    st.flashA *= Math.pow(0.9, dt / 16);
  }
  ctx.restore();
}

// Barra de NOCAUTE no topo: desliza, mostra sprite + nome, e some.
function drawKoBanner(ctx: CanvasRenderingContext2D, W: number, c: Combatant, img: HTMLImageElement | undefined, t: number, life: number, idx: number) {
  const p = t / life;
  const slide = Math.min(1, t / 220);          // entrada deslizando
  const out = Math.max(0, (p - 0.78) / 0.22);  // saída
  const alpha = Math.min(1, slide) * (1 - out);
  if (alpha <= 0) return;
  const bw = 230, bh = 40;
  const x = (W - bw) / 2;
  const y = 10 + idx * (bh + 6) - (1 - slide) * 16;
  ctx.save();
  ctx.globalAlpha = alpha;
  // fundo vermelho arredondado
  ctx.fillStyle = "rgba(180,25,25,0.92)"; roundRect(ctx, x, y, bw, bh, 8); ctx.fill();
  ctx.strokeStyle = "rgba(255,120,120,0.8)"; ctx.lineWidth = 1.5; roundRect(ctx, x, y, bw, bh, 8); ctx.stroke();
  // sprite do mascote nocauteado (em cinza/vermelho)
  const s = 34;
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.save(); ctx.globalAlpha = alpha * 0.95; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x + 4, y + (bh - s) / 2, s, s); ctx.restore();
  }
  // textos
  ctx.textAlign = "left"; ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 4;
  const tx = x + s + 12;
  const avail = x + bw - 10 - tx; // largura útil p/ o texto
  ctx.fillStyle = "#ffd7d7"; ctx.font = "bold 10px 'Jost', system-ui, sans-serif";
  ctx.fillText("✖ NOCAUTE", tx, y + 16);
  // nome: reduz a fonte até caber; trunca com reticências se ainda passar
  ctx.fillStyle = "#ffffff";
  let fs = 15;
  ctx.font = `bold ${fs}px 'Jost', system-ui, sans-serif`;
  while (ctx.measureText(c.name).width > avail && fs > 9) { fs -= 1; ctx.font = `bold ${fs}px 'Jost', system-ui, sans-serif`; }
  let label = c.name;
  if (ctx.measureText(label).width > avail) {
    while (label.length > 1 && ctx.measureText(label + "…").width > avail) label = label.slice(0, -1);
    label += "…";
  }
  ctx.fillText(label, tx, y + 31);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Banner animado anunciando o treinador vencedor.
function drawWinnerBanner(ctx: CanvasRenderingContext2D, W: number, H: number, name: string, t: number) {
  const inp = Math.min(1, t / 520); // entrada
  const e = 1 - Math.pow(1 - inp, 3);
  const cy = H / 2;
  ctx.save();
  // escurece o fundo
  ctx.globalAlpha = 0.5 * inp; ctx.fillStyle = "#05070f"; ctx.fillRect(-20, -20, W + 40, H + 40);
  // faixa dourada
  ctx.globalAlpha = inp; ctx.translate(W / 2, cy);
  const bw = Math.min(W - 40, 560) * e, bh = 108;
  const grad = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
  grad.addColorStop(0, "rgba(255,203,5,0)"); grad.addColorStop(0.5, "rgba(255,203,5,0.18)"); grad.addColorStop(1, "rgba(255,203,5,0)");
  ctx.fillStyle = grad; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.strokeStyle = "rgba(255,203,5,0.6)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-bw / 2, -bh / 2); ctx.lineTo(bw / 2, -bh / 2); ctx.moveTo(-bw / 2, bh / 2); ctx.lineTo(bw / 2, bh / 2); ctx.stroke();
  // raios girando atrás
  ctx.save(); ctx.globalAlpha = 0.25 * inp; ctx.rotate(t * 0.0006); ctx.strokeStyle = "#FFCB05"; ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(60, 0); ctx.lineTo(260, 0); ctx.stroke(); }
  ctx.restore();
  // textos
  const pulse = 1 + Math.sin(t * 0.006) * 0.03;
  ctx.textAlign = "center"; ctx.shadowColor = "#FFCB05"; ctx.shadowBlur = 18 * inp;
  ctx.fillStyle = "#FFCB05"; ctx.font = "bold 13px 'Jost', system-ui, sans-serif";
  ctx.fillText("🏆  V E N C E D O R", 0, -24);
  ctx.save(); ctx.scale(pulse, pulse);
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 34px 'Jost', system-ui, sans-serif";
  ctx.fillText(name, 0, 18 / pulse);
  ctx.restore();
  ctx.restore();
}

// ── projétil por tipo ──
function drawBolt(ctx: CanvasRenderingContext2D, st: St, b: Bolt, cx: number, cy: number) {
  const ang = Math.atan2(b.ty - b.y, b.tx - b.x);
  ctx.save(); ctx.shadowBlur = 18; ctx.shadowColor = b.color; ctx.lineCap = "round";
  if (b.kind === "boltline") {
    // raio quebrado da origem ao alvo, com flicker
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? "#ffffff" : b.color; ctx.lineWidth = pass ? 2 : 6; ctx.globalAlpha = pass ? 1 : 0.85;
      ctx.beginPath(); ctx.moveTo(b.x, b.y);
      const seg = 7;
      for (let i = 1; i <= seg; i++) { const t = i / seg; const lx = b.x + (b.tx - b.x) * t, ly = b.y + (b.ty - b.y) * t; const off = (i === seg ? 0 : (Math.random() - 0.5) * 26); ctx.lineTo(lx - Math.sin(ang) * off, ly + Math.cos(ang) * off); }
      ctx.stroke();
    }
  } else if (b.kind === "comet") {
    for (let i = 0; i < 2; i++) st.particles.push({ x: cx + (Math.random() - 0.5) * 6, y: cy + (Math.random() - 0.5) * 6, vx: -Math.cos(ang) * 2, vy: -Math.sin(ang) * 2 - 0.5, life: 360, max: 360, color: ["#ff7a18", "#ffd070"][(Math.random() * 2) | 0], size: 2 + Math.random() * 2, g: -0.1 });
    ctx.fillStyle = "#ffd070"; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff6d0"; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
  } else if (b.kind === "droplet" || b.kind === "glob") {
    const c = b.kind === "glob" ? "#b060c0" : b.color;
    ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(-2, 6, -10, 0); ctx.quadraticCurveTo(-2, -6, 10, 0); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.beginPath(); ctx.arc(2, -1.5, 2, 0, Math.PI * 2); ctx.fill();
  } else if (b.kind === "leafspin") {
    ctx.translate(cx, cy); ctx.rotate(b.t * 16);
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
  } else if (b.kind === "shardp") {
    ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-4, 5); ctx.lineTo(-9, 0); ctx.lineTo(-4, -5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(-2, -1, 8, 2);
  } else if (b.kind === "helix") {
    for (let s = -1; s <= 1; s += 2) { const off = Math.sin(b.t * 30) * 10 * s; const px = cx - Math.sin(ang) * off, py = cy + Math.cos(ang) * off; ctx.fillStyle = s < 0 ? b.color : "#ffffff"; ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill(); }
  } else if (b.kind === "wisp") {
    const wob = Math.sin(b.t * 24) * 8; const px = cx - Math.sin(ang) * wob, py = cy + Math.cos(ang) * wob;
    ctx.globalAlpha = 0.85; ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.5; ctx.fillStyle = "#e9d5ff"; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
  } else if (b.kind === "spark") {
    drawStarPath(ctx, cx, cy, 10, 4, b.t * 10); ctx.fillStyle = b.color; ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawStarPath(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const r = i % 2 ? inner : outer; const a = rot + (i / 8) * Math.PI * 2; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath();
}

// Recolore uma textura (preservando o alpha) e guarda em cache por cor.
function getTinted(tex: Record<string, HTMLImageElement>, cache: Record<string, HTMLCanvasElement>, name: string, color: string): HTMLCanvasElement | null {
  const key = `${name}|${color}`;
  if (cache[key]) return cache[key];
  const img = tex[name];
  if (!img || !img.complete || !img.naturalWidth) return null;
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d"); if (!g) return null;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  cache[key] = c;
  return c;
}

// Desenha a textura "herói" em blend aditivo: núcleo branco + brilho na cor do tipo.
function drawTex(ctx: CanvasRenderingContext2D, f: Fx, tex: Record<string, HTMLImageElement>, tintCache: Record<string, HTMLCanvasElement>) {
  const img = tex[f.tex ?? ""]; if (!img || !img.complete || !img.naturalWidth) return; // ainda carregando → procedural cobre
  const p = Math.min(1, f.t / f.life);
  const alpha = Math.sin(Math.min(1, p / 0.25) * Math.PI / 2) * (1 - Math.max(0, (p - 0.4) / 0.6)); // sobe rápido, desce suave
  const scale = (0.45 + ease(p) * 0.5) * (f.max || 1);
  const w = 78 * scale, h = 78 * scale;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(f.x, f.y);
  ctx.globalAlpha = Math.max(0, alpha) * 0.55; // núcleo branco
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  const tinted = getTinted(tex, tintCache, f.tex!, f.color);
  if (tinted) { ctx.globalAlpha = Math.max(0, alpha) * 0.95; ctx.drawImage(tinted, -w / 2, -h / 2, w, h); }
  ctx.restore();
}

// ── efeitos elementais desenhados por cima ──
function drawFx(ctx: CanvasRenderingContext2D, f: Fx) {
  const p = Math.min(1, f.t / f.life);
  const fade = 1 - p;
  ctx.save(); ctx.shadowBlur = 14; ctx.shadowColor = f.color;
  if (f.kind === "ring" || f.kind === "healring") {
    const r = (f.max || 50) * ease(p);
    ctx.globalAlpha = fade; ctx.strokeStyle = f.color; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = fade * 0.8; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(f.x, f.y, r * 0.72, 0, Math.PI * 2); ctx.stroke();
  } else if (f.kind === "ripple") {
    ctx.globalAlpha = fade * 0.9; ctx.strokeStyle = f.color; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const rr = (18 + i * 16) + p * 46; ctx.globalAlpha = fade * (0.9 - i * 0.25); ctx.beginPath(); ctx.ellipse(f.x, f.y, rr, rr * 0.4, 0, 0, Math.PI * 2); ctx.stroke(); }
  } else if (f.kind === "flame") {
    ctx.globalAlpha = fade; const h = 40 + p * 30;
    for (let i = 0; i < 5; i++) { const fx = f.x + (i - 2) * 9; const fh = h * (0.6 + Math.random() * 0.4); ctx.fillStyle = ["#ff5020", "#ff9030", "#ffd050"][i % 3]; ctx.beginPath(); ctx.moveTo(fx - 6, f.y + 6); ctx.quadraticCurveTo(fx, f.y - fh, fx + 6, f.y + 6); ctx.fill(); }
  } else if (f.kind === "bolts") {
    ctx.globalAlpha = fade; ctx.strokeStyle = f.color; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + f.seed; ctx.beginPath(); ctx.moveTo(f.x, f.y); let lx = f.x, ly = f.y; for (let j = 1; j <= 3; j++) { lx += Math.cos(a) * 14 + (Math.random() - 0.5) * 10; ly += Math.sin(a) * 14 + (Math.random() - 0.5) * 10; ctx.lineTo(lx, ly); } ctx.stroke(); }
  } else if (f.kind === "frost") {
    ctx.globalAlpha = fade; ctx.strokeStyle = "#dffbff"; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + f.seed; const len = 14 + p * 22; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(a) * len, f.y + Math.sin(a) * len); ctx.stroke(); const mx = f.x + Math.cos(a) * len * 0.6, my = f.y + Math.sin(a) * len * 0.6; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a + 0.6) * 6, my + Math.sin(a + 0.6) * 6); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a - 0.6) * 6, my + Math.sin(a - 0.6) * 6); ctx.stroke(); }
  } else if (f.kind === "star") {
    ctx.globalAlpha = fade; ctx.fillStyle = f.color; drawStarPath(ctx, f.x, f.y, 10 + p * 24, 5 + p * 10, f.seed); ctx.fill();
  } else if (f.kind === "crack") {
    ctx.globalAlpha = fade; ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + f.seed; const len = (20 + p * 34); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(a) * len, f.y + Math.sin(a) * len * 0.5); ctx.stroke(); }
  } else if (f.kind === "runes") {
    ctx.globalAlpha = fade * 0.9; ctx.strokeStyle = f.color; ctx.lineWidth = 2;
    const r = 30 + Math.sin(p * Math.PI) * 10;
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(f.x, f.y, r * 0.65, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 - f.t * 0.004; const px = f.x + Math.cos(a) * r, py = f.y + Math.sin(a) * r; ctx.fillStyle = f.color; ctx.fillRect(px - 2, py - 2, 4, 4); }
  } else if (f.kind === "tendrils") {
    ctx.globalAlpha = fade * 0.85; ctx.strokeStyle = f.color; ctx.lineWidth = 5; ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) { const base = f.x + (i - 2) * 10; ctx.beginPath(); ctx.moveTo(base, f.y + 8); const sway = Math.sin(f.t * 0.01 + i) * 10; ctx.quadraticCurveTo(base + sway, f.y - 10 - p * 20, base + sway * 1.5, f.y - 30 - p * 36); ctx.stroke(); }
  } else if (f.kind === "implode") {
    const r = (60) * (1 - ease(p));
    ctx.globalAlpha = fade; ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(2, r), 0, Math.PI * 2); ctx.stroke();
    if (p > 0.7) { ctx.fillStyle = "#1e1030"; ctx.globalAlpha = (p - 0.7) / 0.3; ctx.beginPath(); ctx.arc(f.x, f.y, 24 * ((p - 0.7) / 0.3), 0, Math.PI * 2); ctx.fill(); }
  } else if (f.kind === "sparkstar") {
    ctx.globalAlpha = fade;
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + f.seed; const d = 10 + p * 30; ctx.fillStyle = i % 2 ? "#ffffff" : f.color; drawStarPath(ctx, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 5, 2, f.t * 0.01 + i); ctx.fill(); }
  } else if (f.kind === "petalring") {
    ctx.globalAlpha = fade; const r = 16 + p * 32;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + f.t * 0.004; const px = f.x + Math.cos(a) * r, py = f.y + Math.sin(a) * r; ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.fillStyle = f.color; ctx.beginPath(); ctx.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  } else if (f.kind === "aura") {
    // conjuração: anéis concêntricos subindo + brilho
    ctx.globalAlpha = fade; ctx.strokeStyle = f.color; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const rr = 14 + i * 12 + p * 20; ctx.globalAlpha = fade * (0.9 - i * 0.2); ctx.beginPath(); ctx.ellipse(f.x, f.y + 20 - p * 24, rr, rr * 0.4, 0, 0, Math.PI * 2); ctx.stroke(); }
  } else if (f.kind === "beamcol") {
    // coluna de luz vertical no conjurador
    ctx.globalAlpha = fade * 0.55; const g = ctx.createLinearGradient(f.x, f.y - 80, f.x, f.y + 20);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, f.color);
    ctx.fillStyle = g; const w = 26 + Math.sin(p * Math.PI) * 10; ctx.fillRect(f.x - w / 2, f.y - 80, w, 100);
  }
  ctx.restore();
}

const ARENA_W = 920;
const ARENA_H = 440;
const RECALL_MS = 820; // duração do retorno à Pokébola

// Desenha uma Pokébola (fechada ou abrindo). `open` 0..1 levanta a tampa e
// acende a "boca" voltada para `dir` (+1 direita, -1 esquerda).
function drawPokeball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, open: number, dir: number, wob: number) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(wob);
  // metade de baixo (branca) e band/aro
  ctx.fillStyle = "#f4f4f4"; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  // metade de cima (vermelha) — recua conforme abre
  ctx.save();
  ctx.beginPath(); ctx.rect(-r - 2, -r - 2 - open * r * 1.4, (r + 2) * 2, r + 2); ctx.clip();
  ctx.fillStyle = "#e23b3b"; ctx.beginPath(); ctx.arc(0, -open * r * 1.4, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // aro central + botão
  ctx.strokeStyle = "#1c1c22"; ctx.lineWidth = r * 0.22; ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
  ctx.fillStyle = "#1c1c22"; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f4f4f4"; ctx.beginPath(); ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2); ctx.fill();
  // boca de luz (quando aberta) voltada p/ o alvo
  if (open > 0.1) {
    ctx.globalAlpha = open; ctx.fillStyle = "#fff4d6"; ctx.shadowBlur = 14; ctx.shadowColor = "#ff5a5a";
    ctx.beginPath(); ctx.ellipse(dir * r * 0.5, -open * r * 0.6, r * 0.5, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawRecall(ctx: CanvasRenderingContext2D, a: Actor, img: HTMLImageElement | undefined, S: number, tex: Record<string, HTMLImageElement>) {
  const p = Math.min(1, a.faintT / RECALL_MS);
  const bx = a.c.side === "A" ? 46 : ARENA_W - 46; // Pokébola na borda do time
  const by = a.hy + 20;
  const dir = a.x >= bx ? 1 : -1;
  const sx = a.x, sy = a.y - 6; // posição do mascote
  // fases
  const open = Math.min(1, p / 0.16) * (p < 0.82 ? 1 : Math.max(0, 1 - (p - 0.82) / 0.18));
  const absorb = Math.max(0, Math.min(1, (p - 0.14) / 0.64)); // 0→1 enquanto é sugado
  const closing = Math.max(0, (p - 0.82) / 0.18);
  const wob = closing > 0 ? Math.sin(closing * Math.PI * 3) * 0.25 : 0;

  // ponto atual da energia (do mascote em direção à bola)
  const cx = sx + (bx - sx) * ease(absorb);
  const cy = sy + (by - sy) * ease(absorb);

  // feixe de luz bola → energia
  if (open > 0.1 && absorb < 1) {
    ctx.save();
    ctx.globalAlpha = 0.85 * open * (1 - absorb * 0.4); ctx.lineCap = "round";
    ctx.strokeStyle = "#ff5a5a"; ctx.lineWidth = 7; ctx.shadowBlur = 18; ctx.shadowColor = "#ff5a5a";
    ctx.beginPath(); ctx.moveTo(bx + dir * 6, by - 4); ctx.lineTo(cx, cy); ctx.stroke();
    ctx.strokeStyle = "#fff0f0"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(bx + dir * 6, by - 4); ctx.lineTo(cx, cy); ctx.stroke();
    ctx.restore();
  }

  // mascote virando energia vermelha e encolhendo em direção à bola
  if (p < 0.9) {
    const scale = Math.max(0.05, 1 - absorb) ;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(scale * (a.face === -1 ? -1 : 1), scale);
    ctx.globalAlpha = 1 - absorb * 0.6;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -S / 2, -S / 2, S, S);
      ctx.globalAlpha = (0.5 + absorb * 0.5) * (1 - absorb * 0.3); ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = "#ff2d2d"; ctx.fillRect(-S / 2, -S / 2, S, S);
    } else { ctx.fillStyle = "#ff2d2d"; ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // fluxo de energia fluindo para a bola (determinístico pelo tempo)
  if (open > 0.1 && absorb > 0 && absorb < 1) {
    ctx.save(); ctx.shadowBlur = 8; ctx.shadowColor = "#ff5a5a";
    for (let k = 0; k < 7; k++) {
      const frac = ((a.faintT * 0.0016 + k / 7) % 1);
      const px = sx + (bx - sx) * frac, py = sy + (by - sy) * frac - Math.sin(frac * Math.PI) * 10;
      ctx.globalAlpha = (1 - frac) * 0.9; ctx.fillStyle = k % 2 ? "#ffd6d6" : "#ff5a5a";
      ctx.beginPath(); ctx.arc(px, py, 3.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // flash ao fechar
  if (closing > 0 && closing < 0.6) {
    ctx.save(); ctx.globalAlpha = (0.6 - closing) ; ctx.fillStyle = "#fff"; ctx.shadowBlur = 20; ctx.shadowColor = "#fff";
    ctx.beginPath(); ctx.arc(bx, by - 4, 10 + closing * 16, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  // a Pokébola por cima de tudo — textura se disponível, senão procedural
  const ballImg = open > 0.35 ? tex["pokeball-open"] : tex["pokeball"];
  if (ballImg && ballImg.complete && ballImg.naturalWidth > 0) {
    const d = 34;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(wob);
    if (dir < 0) ctx.scale(-1, 1); // espelha p/ a "boca" apontar ao centro
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ballImg, -d / 2, -d / 2, d, d);
    ctx.restore();
  } else {
    drawPokeball(ctx, bx, by, 13, open, dir, wob);
  }
}

function drawActor(ctx: CanvasRenderingContext2D, a: Actor, img: HTMLImageElement | undefined, tex: Record<string, HTMLImageElement>) {
  // escala por profundidade: quem está mais à frente (y maior) aparece maior
  const dz = 0.82 + (a.y / ARENA_H) * 0.26;
  const S = 72 * dz;

  // ── Retorno à Pokébola (derrotado) ──
  if (a.fainted) {
    const p = Math.min(1, a.faintT / RECALL_MS);
    if (p >= 1) return; // já recolhido
    drawRecall(ctx, a, img, S, tex);
    return;
  }

  const x = a.x + a.kx, y = a.y + a.ky;
  const bob = Math.sin(a.wobble) * 1.3;
  const groundY = y + 30; // linha do chão sob os pés
  // sombra (ancora o sprite; encolhe quando ele "sobe" no bob)
  const lift = (bob + 1.3) / 2.6; // 0 = pisando, 1 = topo do bob
  ctx.save(); ctx.globalAlpha = 0.42 - lift * 0.12; ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.ellipse(x, groundY, (26 - lift * 4) * dz, (7.5 - lift * 1.5) * dz, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  // escudo do Guardião
  if (a.shield > 0) {
    ctx.save(); ctx.globalAlpha = 0.5 * a.shield; ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 3;
    ctx.shadowBlur = 16; ctx.shadowColor = "#38bdf8";
    ctx.beginPath(); ctx.arc(x, y - 6, 34, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }

  ctx.save();
  // os sprites têm "ar" transparente embaixo; empurra p/ baixo p/ os pés
  // visíveis encostarem na sombra (senão parecem flutuar).
  ctx.translate(x, groundY - S / 2 + S * 0.12 + bob);
  if (a.face === -1) ctx.scale(-1, 1);
  if (img && img.complete && img.naturalWidth > 0) {
    if (a.flash > 0) { ctx.shadowBlur = 20 * a.flash; ctx.shadowColor = "#fff"; }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, -S / 2, -S / 2, S, S);
    if (a.flash > 0) { ctx.globalAlpha = 0.5 * a.flash; ctx.globalCompositeOperation = "source-atop"; ctx.fillStyle = "#fff"; ctx.fillRect(-S / 2, -S / 2, S, S); }
  } else {
    // fallback: círculo com cor do tipo
    ctx.fillStyle = hex(a.c.type); ctx.beginPath(); ctx.arc(0, 0, S * 0.36, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // nome + barra de HP
  ctx.textAlign = "center";
  ctx.font = "11px 'Jost', system-ui, sans-serif"; ctx.fillStyle = "#cbd5e1";
  ctx.fillText(a.c.name, x, y - 46);
  const bw = 52, bh = 6, bx = x - bw / 2, by = y - 42;
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(bx, by, bw, bh);
  const frac = Math.max(0, a.shownHp / a.c.maxHp);
  ctx.fillStyle = frac > 0.5 ? "#4ade80" : frac > 0.2 ? "#facc15" : "#ef4444";
  ctx.fillRect(bx, by, bw * frac, bh);
  ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
}
