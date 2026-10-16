"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  guardianInterceptId?: string | null; // mascote que interceptou (Guardião)
  debuff?: boolean; // Oportunista aplicou debuff
};
export type ReplayData = { teams: Combatant[]; turns: ReplayTurn[] };

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
  const [turnIdx, setTurnIdx] = useState(0);
  const [currentLog, setCurrentLog] = useState(0);

  // Refs mutáveis para o loop de animação (não disparam re-render).
  const spritesRef = useRef<Record<string, HTMLImageElement>>({});
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
          face: x < W / 2 ? 1 : -1, kx: 0, ky: 0, fainted: false,
          shield: 0, flash: 0, wobble: Math.random() * Math.PI * 2,
        };
      });
    place(left, W * 0.2);
    place(right, W * 0.8);
    return {
      W, H, actors, t0: performance.now(), scene: null as Scene | null,
      sceneIdx: -1, particles: [] as Particle[], pops: [] as Pop[],
      shake: 0, done: false, bolt: null, ring: null,
    } as St;
  }

  useEffect(() => {
    stateRef.current = initState();
    setTurnIdx(0);
    setCurrentLog(0);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const st = stateRef.current!;
      const dt = Math.min(48, now - last) * speedRef.current;
      last = now;
      if (playRef.current && !st.done) step(st, dt, data, (i) => { setTurnIdx(i); setCurrentLog(i); });
      draw(ctx, st, spritesRef.current);
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
    setTurnIdx(target); setCurrentLog(target);
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
  fainted: boolean; shield: number; flash: number; wobble: number;
};
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
type Pop = { x: number; y: number; text: string; color: string; life: number; vy: number };
type Scene = { turn: ReplayTurn; phase: Phase; pt: number; fired: boolean; style: "beam" | "orb" | "melee" | "heal" | "support" };
type St = {
  W: number; H: number; actors: Record<string, Actor>; t0: number;
  scene: Scene | null; sceneIdx: number; particles: Particle[]; pops: Pop[];
  shake: number; done: boolean;
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
  }
  st.particles = st.particles.filter((p) => (p.life -= dt) > 0);
  st.particles.forEach((p) => { p.x += p.vx * dt * 0.06; p.y += p.vy * dt * 0.06; p.vy += dt * 0.002; });
  st.pops = st.pops.filter((p) => (p.life -= dt) > 0);
  st.pops.forEach((p) => { p.y += p.vy * dt * 0.05; });

  if (!st.scene) {
    // idle wandering + iniciar próxima cena
    idle(st, dt);
    const next = st.sceneIdx + 1;
    if (next >= data.turns.length) { st.done = true; return; }
    st.sceneIdx = next;
    onTurn(next);
    st.scene = { turn: data.turns[next], phase: "windup", pt: 0, fired: false, style: styleOf(data.turns[next]) };
    return;
  }
  runScene(st, dt);
}

function idle(st: St, dt: number) {
  for (const a of Object.values(st.actors)) {
    if (a.fainted) continue;
    const tx = a.hx + Math.cos(a.wobble) * 16;
    const ty = a.hy + Math.sin(a.wobble * 1.3) * 12;
    a.x += (tx - a.x) * Math.min(1, dt * 0.004);
    a.y += (ty - a.y) * Math.min(1, dt * 0.004);
  }
}

function runScene(st: St, dt: number) {
  const sc = st.scene!;
  const actor = st.actors[sc.turn.actorId];
  const target = st.actors[sc.turn.targetId];
  const guardian = sc.turn.guardianInterceptId ? st.actors[sc.turn.guardianInterceptId] : null;
  const hitTarget = guardian ?? target; // quem efetivamente recebe o VFX
  if (!actor || !target) { st.scene = null; return; }
  sc.pt += dt;

  if (sc.phase === "windup") {
    if (sc.style === "melee") {
      // avança em direção ao alvo
      const p = Math.min(1, sc.pt / DUR.windup);
      actor.x = actor.hx + (hitTarget.x - actor.hx) * 0.72 * ease(p);
      actor.y = actor.hy + (hitTarget.y - actor.hy) * 0.72 * ease(p);
    } else if (sc.style === "heal" || sc.style === "support") {
      const p = Math.min(1, sc.pt / DUR.windup);
      actor.y = actor.hy - 8 * Math.sin(p * Math.PI);
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

function fireVfx(st: St, sc: Scene, actor: Actor, target: Actor) {
  const color = hex(sc.turn.attackerType);
  const supa = sc.turn.advantageApplied;
  if (sc.style === "heal") {
    for (let i = 0; i < 18; i++) st.particles.push({ x: target.x + (Math.random() - 0.5) * 40, y: target.y + 20, vx: (Math.random() - 0.5) * 2, vy: -4 - Math.random() * 3, life: 520, max: 520, color: "#4ade80", size: 3 });
    st.pops.push({ x: target.x, y: target.y - 44, text: `+${sc.turn.damage}`, color: "#4ade80", life: 900, vy: -0.8 });
    return;
  }
  if (sc.style === "support") {
    // Oportunista: setas p/ baixo roxas sobre o alvo
    for (let i = 0; i < 14; i++) st.particles.push({ x: target.x + (Math.random() - 0.5) * 36, y: target.y - 30 - Math.random() * 20, vx: 0, vy: 3 + Math.random() * 2, life: 600, max: 600, color: "#c084fc", size: 4 });
    st.pops.push({ x: target.x, y: target.y - 44, text: "DEBUFF", color: "#c084fc", life: 1000, vy: -0.6 });
    return;
  }
  // golpes ofensivos → impacto no alvo
  const settle = () => {
    // knockback
    const dx = Math.sign(target.x - actor.x) || target.face * -1;
    target.kx += dx * (supa ? 18 : 12);
    target.flash = 1;
    // anel de impacto + faíscas
    for (let i = 0; i < (supa ? 26 : 16); i++) {
      const ang = Math.random() * Math.PI * 2, sp = 3 + Math.random() * (supa ? 9 : 6);
      st.particles.push({ x: target.x, y: target.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 420, max: 420, color, size: 2 + Math.random() * 2 });
    }
    st.ring = { x: target.x, y: target.y, r: 6, max: supa ? 70 : 46, color, life: 300 };
    st.pops.push({ x: target.x, y: target.y - 40, text: `${sc.turn.damage}`, color: supa ? "#fbbf24" : "#fff", life: 850, vy: -0.9 });
    if (supa) { st.shake = 14; st.pops.push({ x: target.x, y: target.y - 60, text: "SUPER!", color: "#fbbf24", life: 950, vy: -0.7 }); }
    else st.shake = 6;
    if (sc.turn.guardianInterceptId) { st.pops.push({ x: target.x, y: target.y + 30, text: "🛡 GUARDIÃO", color: "#38bdf8", life: 1000, vy: -0.4 }); target.shield = 1; }
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
  if (victim.hp <= 0) victim.fainted = true;
}

// pulo imediato (seek por turno): sem animação, só estado final.
function applyInstant(st: St, t: ReplayTurn, _data: ReplayData) {
  applyOutcome(st, t, { instant: true });
  const tgt = st.actors[t.targetId];
  if (tgt) tgt.shownHp = tgt.hp;
}

const ease = (p: number) => 1 - Math.pow(1 - p, 3);

// ────────────────────────── desenho ──────────────────────────
function draw(ctx: CanvasRenderingContext2D, st: St, sprites: Record<string, HTMLImageElement>) {
  const { W, H } = st;
  ctx.save();
  if (st.shake > 0) ctx.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake);

  // arena
  const g = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, "#152044"); g.addColorStop(1, "#070b18");
  ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.strokeStyle = "rgba(120,160,255,0.12)"; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 46) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 46) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // linha central
  ctx.strokeStyle = "rgba(255,203,5,0.18)"; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);

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

  // anel de impacto
  if (st.ring) {
    const r = st.ring; r.r += (r.max - r.r) * 0.2; r.life -= 16;
    ctx.save(); ctx.globalAlpha = Math.max(0, r.life / 300); ctx.strokeStyle = r.color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    if (r.life <= 0) st.ring = null;
  }

  // partículas
  for (const p of st.particles) {
    ctx.save(); ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
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

function drawActor(ctx: CanvasRenderingContext2D, a: Actor, img?: HTMLImageElement) {
  const x = a.x + a.kx, y = a.y + a.ky;
  const bob = a.fainted ? 0 : Math.sin(a.wobble) * 2;
  const S = 72;
  // sombra
  ctx.save(); ctx.globalAlpha = a.fainted ? 0.15 : 0.35; ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.ellipse(x, y + 26, 24, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  // escudo do Guardião
  if (a.shield > 0) {
    ctx.save(); ctx.globalAlpha = 0.5 * a.shield; ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 3;
    ctx.shadowBlur = 16; ctx.shadowColor = "#38bdf8";
    ctx.beginPath(); ctx.arc(x, y - 6, 34, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }

  ctx.save();
  ctx.translate(x, y - 6 + bob);
  if (a.face === -1) ctx.scale(-1, 1);
  ctx.globalAlpha = a.fainted ? 0.4 : 1;
  if (img && img.complete && img.naturalWidth > 0) {
    if (a.flash > 0) { ctx.shadowBlur = 20 * a.flash; ctx.shadowColor = "#fff"; }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, -S / 2, -S / 2, S, S);
    if (a.flash > 0) { ctx.globalAlpha = 0.5 * a.flash; ctx.globalCompositeOperation = "source-atop"; ctx.fillStyle = "#fff"; ctx.fillRect(-S / 2, -S / 2, S, S); }
  } else {
    // fallback: círculo com cor do tipo
    ctx.fillStyle = hex(a.c.type); ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  if (a.fainted) {
    ctx.save(); ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 12, y - 18); ctx.lineTo(x + 12, y + 6); ctx.moveTo(x + 12, y - 18); ctx.lineTo(x - 12, y + 6); ctx.stroke(); ctx.restore();
  }

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
