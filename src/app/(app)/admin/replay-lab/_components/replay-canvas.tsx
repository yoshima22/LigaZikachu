"use client";

import { useEffect, useRef, useState } from "react";

// ── Tipos de dados (preview isolado; mesma forma que um turnLog normalizado) ──
export type Combatant = {
  id: string;
  name: string;
  pokemonId: number;
  type: string;
  sprite: string;
  maxHp: number;
  side: "A" | "B";
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
  abilityName?: string; // nome do golpe/habilidade exibido ao atacar
  guardianInterceptId?: string | null; // mascote que interceptou (Guardião)
  debuff?: boolean; // Oportunista aplicou debuff
};
export type ReplayData = { teams: Combatant[]; turns: ReplayTurn[]; bgUrl?: string };

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
  }, [data]);

  // (Re)inicializa estado quando os dados mudam ou ao reiniciar.
  const resetKey = useRef(0);
  function initState() {
    const W = 920, H = 440;
    const actors: Record<string, Actor> = {};
    const left = data.teams.filter((c) => c.side === "A");
    const right = data.teams.filter((c) => c.side === "B");
    const place = (list: Combatant[], x: number) =>
      list.forEach((c, i) => {
        const y = H * (i + 1) / (list.length + 1);
        actors[c.id] = {
          c, hx: x, hy: y, x, y, hp: c.maxHp, shownHp: c.maxHp,
          face: x < W / 2 ? 1 : -1, kx: 0, ky: 0, fainted: false, faintT: 0,
          shield: 0, flash: 0, wobble: Math.random() * Math.PI * 2,
          rtx: x, rty: y, roamCd: Math.random() * 600,
        };
      });
    place(left, W * 0.2);
    place(right, W * 0.8);
    return {
      W, H, actors, t0: performance.now(), scene: null as Scene | null,
      sceneIdx: -1, particles: [] as Particle[], pops: [] as Pop[],
      shake: 0, done: false, idleGap: 500, bolt: null, ring: null,
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
      if (playRef.current && !st.done) step(st, dt, data, (i) => setCurrentLog(i));
      draw(ctx, st, spritesRef.current, bgRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, resetKey.current]);

  const restart = () => { resetKey.current++; stateRef.current = initState(); setPlaying(true); };
  const jump = (dir: number) => {
    const st = stateRef.current;
    if (!st) return;
    const target = Math.max(0, Math.min(data.turns.length - 1, st.sceneIdx + dir));
    // Avança/retrocede reconstruindo até o turno alvo (barato p/ preview).
    const fresh = initState();
    for (let i = 0; i <= target; i++) applyInstant(fresh, data.turns[i], data);
    fresh.sceneIdx = target;
    stateRef.current = fresh;
    setCurrentLog(target);
    setPlaying(false);
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
      <TurnLogList turns={data.turns} teams={data.teams} current={currentLog} onPick={(i) => jump(i - (stateRef.current?.sceneIdx ?? 0))} />
    </div>
  );
}

function TurnLogList({ turns, teams, current, onPick }: { turns: ReplayTurn[]; teams: Combatant[]; current: number; onPick: (i: number) => void }) {
  const name = (id: string) => teams.find((c) => c.id === id)?.name ?? "?";
  const desc = (t: ReplayTurn) => {
    if (t.action === "HEAL") return `${name(t.actorId)} cura ${name(t.targetId)} (+${t.damage})`;
    if (t.guardianInterceptId) return `${name(t.guardianInterceptId)} intercepta o golpe em ${name(t.targetId)}`;
    if (t.debuff) return `${name(t.actorId)} debilita ${name(t.targetId)} (Oportunista)`;
    return `${name(t.actorId)} → ${name(t.targetId)} • ${t.damage}${t.advantageApplied ? " ✦ super-eficaz" : ""}`;
  };
  return (
    <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/60 p-2 text-xs">
      {turns.map((t, i) => (
        <button key={i} onClick={() => onPick(i)} className={`block w-full rounded px-2 py-1 text-left ${i === current ? "bg-cyan-500/15 text-cyan-100" : "text-slate-400 hover:bg-slate-800/60"}`}>
          <span className="text-slate-600">T{t.turn}</span> {desc(t)}
        </button>
      ))}
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
type St = {
  W: number; H: number; actors: Record<string, Actor>; t0: number;
  scene: Scene | null; sceneIdx: number; particles: Particle[]; pops: Pop[];
  shake: number; done: boolean; idleGap: number;
  bolt: { x: number; y: number; tx: number; ty: number; color: string; beam: boolean; t: number; onHit: () => void } | null;
  ring: { x: number; y: number; r: number; max: number; color: string; life: number } | null;
};

const DUR = { windup: 260, strike: 320, recover: 300 };

function styleOf(t: ReplayTurn): Scene["style"] {
  if (t.action === "HEAL") return "heal";
  if (t.debuff || t.action === "ABILITY") return "support";
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
      const left = a.c.side === "A";
      a.rtx = (left ? 0.10 : 0.58) * W + Math.random() * 0.32 * W;
      a.rty = 0.16 * H + Math.random() * 0.68 * H;
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
  const hitTarget = guardian ?? target; // quem efetivamente recebe o VFX
  if (!actor || !target) { st.scene = null; return; }
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

function fireVfx(st: St, sc: Scene, actor: Actor, target: Actor) {
  const color = hex(sc.turn.attackerType);
  const supa = !!sc.turn.advantageApplied;
  const ability = sc.turn.abilityName;
  // Nome da habilidade/golpe sobe a partir do atacante ao conjurar.
  if (ability) st.pops.push({ x: actor.x, y: actor.y - 54, text: ability, color: color, life: 1100, vy: -0.5 });
  if (sc.style === "heal") {
    for (let i = 0; i < 24; i++) st.particles.push({ x: target.x + (Math.random() - 0.5) * 44, y: target.y + 22, vx: (Math.random() - 0.5) * 2, vy: -4 - Math.random() * 3, life: 560, max: 560, color: ["#4ade80", "#bbf7d0", "#16a34a"][(Math.random() * 3) | 0], size: 2 + Math.random() * 2, g: -0.2 });
    st.pops.push({ x: target.x, y: target.y - 44, text: `+${sc.turn.damage}`, color: "#4ade80", life: 950, vy: -0.8 });
    target.flash = 0.6;
    return;
  }
  if (sc.style === "support") {
    // Oportunista: aura roxa descendo sobre o alvo (debuff).
    for (let i = 0; i < 20; i++) st.particles.push({ x: target.x + (Math.random() - 0.5) * 40, y: target.y - 34 - Math.random() * 22, vx: (Math.random() - 0.5) * 1.5, vy: 3 + Math.random() * 2.5, life: 650, max: 650, color: ["#c084fc", "#a855f7", "#e9d5ff"][(Math.random() * 3) | 0], size: 2 + Math.random() * 3, g: 0.2 });
    st.pops.push({ x: target.x, y: target.y - 44, text: ability ?? "DEBUFF", color: "#c084fc", life: 1050, vy: -0.6 });
    return;
  }
  // golpes ofensivos → impacto no alvo
  const settle = () => {
    // knockback
    const dx = Math.sign(target.x - actor.x) || target.face * -1;
    target.kx += dx * (supa ? 18 : 12);
    target.flash = 1;
    emitImpact(st, sc.turn.attackerType, target.x, target.y, supa); // faíscas por tipo
    st.ring = { x: target.x, y: target.y, r: 6, max: supa ? 74 : 46, color, life: 320 };
    st.pops.push({ x: target.x, y: target.y - 40, text: `${sc.turn.damage}`, color: supa ? "#fbbf24" : "#fff", life: 850, vy: -0.9 });
    if (supa) { st.shake = 15; st.pops.push({ x: target.x, y: target.y - 62, text: "SUPER EFICAZ!", color: "#fbbf24", life: 1000, vy: -0.7 }); }
    else st.shake = 6;
    if (sc.turn.guardianInterceptId) { st.pops.push({ x: target.x, y: target.y + 30, text: "🛡 GUARDIÃO", color: "#38bdf8", life: 1050, vy: -0.4 }); target.shield = 1; }
  };
  if (sc.style === "melee") {
    settle();
  } else {
    // projétil/raio: cria bala viajando; impacto agendado ao chegar
    st.bolt = { x: actor.x, y: actor.y, tx: target.x, ty: target.y, color, beam: sc.style === "beam", t: 0, onHit: settle };
  }
}

// aplica dano/cura ao estado de HP (visual).
function applyOutcome(st: St, t: ReplayTurn, _o: { instant: boolean }) {
  if (t.action === "HEAL") { const tgt = st.actors[t.targetId]; if (tgt) tgt.hp = t.targetHpAfter; return; }
  if (t.action === "ABILITY" && t.debuff) return; // debuff não altera HP
  // Se houve interceptação, quem perde HP é o Guardião; senão o alvo.
  const victim = st.actors[t.guardianInterceptId ?? t.targetId];
  if (!victim) return;
  victim.hp = Math.max(0, t.targetHpAfter);
  if (victim.hp <= 0 && !victim.fainted) {
    victim.fainted = true; victim.faintT = 0; victim.shield = 0;
    if (!_o.instant) { st.shake = 12; st.pops.push({ x: victim.x, y: victim.y - 50, text: "NOCAUTE!", color: "#ff5252", life: 1100, vy: -0.6 }); }
  }
}

// pulo imediato (seek por turno): sem animação, só estado final.
function applyInstant(st: St, t: ReplayTurn, _data: ReplayData) {
  applyOutcome(st, t, { instant: true });
  for (const a of Object.values(st.actors)) { if (a.fainted) a.faintT = RECALL_MS; a.shownHp = a.hp; }
}

const ease = (p: number) => 1 - Math.pow(1 - p, 3);

// ────────────────────────── desenho ──────────────────────────
function draw(ctx: CanvasRenderingContext2D, st: St, sprites: Record<string, HTMLImageElement>, bg: HTMLImageElement | null) {
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

  // bolt (projétil/raio) em voo
  if (st.bolt) {
    const b = st.bolt; b.t += 0.08;
    const cx = b.x + (b.tx - b.x) * ease(Math.min(1, b.t));
    const cy = b.y + (b.ty - b.y) * ease(Math.min(1, b.t));
    ctx.save(); ctx.shadowBlur = 18; ctx.shadowColor = b.color;
    if (b.beam) {
      ctx.strokeStyle = b.color; ctx.lineWidth = 7; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(cx, cy); ctx.stroke();
    } else {
      ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (b.t >= 1) { b.onHit(); st.bolt = null; }
  }

  // anel de impacto (onda de choque na cor do tipo + flash branco interno)
  if (st.ring) {
    const r = st.ring; r.r += (r.max - r.r) * 0.2; r.life -= 16;
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
  for (const a of ordered) drawActor(ctx, a, sprites[a.c.id]);

  // pops de dano/cura
  ctx.textAlign = "center"; ctx.font = "bold 20px 'Jost', system-ui, sans-serif";
  for (const p of st.pops) {
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 400)); ctx.fillStyle = p.color;
    ctx.shadowBlur = 6; ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.fillText(p.text, p.x, p.y); ctx.restore();
  }
  ctx.restore();
}

const ARENA_W = 920;
const ARENA_H = 440;
const RECALL_MS = 760; // duração do retorno à Pokébola

function drawActor(ctx: CanvasRenderingContext2D, a: Actor, img?: HTMLImageElement) {
  // escala por profundidade: quem está mais à frente (y maior) aparece maior
  const dz = 0.82 + (a.y / ARENA_H) * 0.26;
  const S = 72 * dz;

  // ── Retorno à Pokébola (derrotado): feixe vermelho + silhueta sugada ──
  if (a.fainted) {
    const p = Math.min(1, a.faintT / RECALL_MS);
    if (p >= 1) return; // já recolhido — não desenha mais
    const ex = a.c.side === "A" ? 40 : ARENA_W - 40; // "treinador"/Pokébola na borda do time
    const ey = a.hy - 6;
    const beamIn = Math.min(1, p / 0.22);       // feixe surge primeiro
    const pull = Math.max(0, (p - 0.22) / 0.78); // depois a energia é puxada p/ a borda
    const cx = a.x + (ex - a.x) * ease(pull);
    const cy = (a.y - 6) + (ey - (a.y - 6)) * ease(pull);
    // feixe de luz
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.9; ctx.strokeStyle = "#ff3b3b"; ctx.lineWidth = 6;
    ctx.shadowBlur = 20; ctx.shadowColor = "#ff3b3b";
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(cx, cy); ctx.stroke();
    ctx.strokeStyle = "#ffd0d0"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(cx, cy); ctx.stroke();
    ctx.restore();
    // silhueta vermelha encolhendo
    const scale = Math.max(0, 1 - pull) * (0.6 + 0.4 * beamIn);
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(scale * (a.face === -1 ? -1 : 1), scale);
    ctx.globalAlpha = 1 - pull * 0.3;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -S / 2, -S / 2, S, S);
      ctx.globalAlpha = 0.65 + 0.35 * beamIn; ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = "#ff2d2d"; ctx.fillRect(-S / 2, -S / 2, S, S);
    } else {
      ctx.fillStyle = "#ff2d2d"; ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // brilho na ponta + fagulhas vermelhas
    ctx.save(); ctx.globalAlpha = 1 - pull; ctx.fillStyle = "#ffdede"; ctx.shadowBlur = 14; ctx.shadowColor = "#ff3b3b";
    ctx.beginPath(); ctx.arc(cx, cy, 5 + 4 * Math.sin(a.faintT * 0.02), 0, Math.PI * 2); ctx.fill(); ctx.restore();
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
