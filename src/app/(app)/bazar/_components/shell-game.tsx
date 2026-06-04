"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coins, Trophy, Skull, Timer } from "lucide-react";
import { startShellGameSession, resolveShellGame, getShellGameCooldown } from "../actions";

// ── Constantes ────────────────────────────────────────────────────────────────

const CUP_W   = 88;   // largura do copo
const CUP_H   = 76;   // altura do copo
const SLOT_GAP = 44;  // espaço entre copos
const SLOTS   = [0, CUP_W + SLOT_GAP, (CUP_W + SLOT_GAP) * 2]; // X de cada slot
const LIFT    = 90;   // pixels que o copo sobe para revelar a bolinha
const BALL_D  = 26;   // diâmetro da bolinha
const CONTAINER_W = SLOTS[2] + CUP_W; // largura total

const GOLD = "#c9a800";
const GOLD_D = "#5a4700";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Phase =
  | "idle"        // aguardando aposta
  | "dealing"     // servidor processa
  | "showing"     // mostra bolinha sob o copo do meio
  | "hiding"      // abaixa o copo
  | "shuffling"   // embaralha
  | "pick"        // jogador escolhe
  | "lifting"     // levanta o copo escolhido
  | "won"         // venceu
  | "lost";       // perdeu

// ── Cup SVG (forma de copo estilizado) ───────────────────────────────────────

function Cup({
  x, lifted, dimmed, onClick, phase,
}: {
  x: number;
  lifted: boolean;
  dimmed: boolean;
  onClick?: () => void;
  phase: Phase;
}) {
  const canClick = phase === "pick" && onClick;
  const yOffset  = lifted ? -LIFT : 0;

  return (
    <g
      style={{
        transform: `translate(${x}px, ${yOffset}px)`,
        transition: "transform 0.22s cubic-bezier(.4,0,.2,1)",
        cursor: canClick ? "pointer" : "default",
        opacity: dimmed ? 0.35 : 1,
      }}
      onClick={canClick ? onClick : undefined}
    >
      {/* Sombra */}
      <ellipse cx={CUP_W / 2} cy={CUP_H + 4} rx={CUP_W * 0.42} ry={6}
        fill="rgba(0,0,0,0.5)" />

      {/* Corpo do copo (trapézio) */}
      <defs>
        <linearGradient id={`cupGrad${x}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d4a800" />
          <stop offset="50%" stopColor="#8b5e00" />
          <stop offset="100%" stopColor="#3a2800" />
        </linearGradient>
        <linearGradient id={`rimGrad${x}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFCB05" />
          <stop offset="100%" stopColor="#c9a800" />
        </linearGradient>
      </defs>

      {/* Corpo principal — trapézio */}
      <path
        d={`M ${CUP_W * 0.08} 10
            L ${CUP_W * 0.92} 10
            L ${CUP_W * 0.98} ${CUP_H}
            L ${CUP_W * 0.02} ${CUP_H} Z`}
        fill={`url(#cupGrad${x})`}
        stroke={GOLD_D} strokeWidth="1.5"
      />

      {/* Brilho lateral esquerdo */}
      <path
        d={`M ${CUP_W * 0.14} 14 L ${CUP_W * 0.08} ${CUP_H - 6} L ${CUP_W * 0.14} ${CUP_H - 6} L ${CUP_W * 0.20} 14 Z`}
        fill="rgba(255,255,255,0.10)"
      />

      {/* Aba superior (rim) */}
      <rect x="0" y="4" width={CUP_W} height="12"
        rx="5" fill={`url(#rimGrad${x})`}
        stroke={GOLD_D} strokeWidth="1" />

      {/* Relâmpago decorativo */}
      <text x={CUP_W / 2} y={CUP_H * 0.62}
        textAnchor="middle" fontSize="18" fill="rgba(255,203,5,0.3)"
        style={{ userSelect: "none" }}>
        ⚡
      </text>

      {/* Hover ring quando clicável */}
      {canClick && (
        <rect x="-3" y="1" width={CUP_W + 6} height={CUP_H + 6}
          rx="7" fill="none" stroke={GOLD} strokeWidth="2"
          strokeDasharray="5 3" opacity="0.7">
          <animateTransform attributeName="transform" type="rotate"
            from="0 44 40" to="360 44 40" dur="4s" repeatCount="indefinite" />
        </rect>
      )}
    </g>
  );
}

// ── Bolinha ───────────────────────────────────────────────────────────────────

function Ball({ x, visible }: { x: number; visible: boolean }) {
  const cx = x + CUP_W / 2;
  const cy = CUP_H - BALL_D / 2 - 2;
  return (
    <g style={{ opacity: visible ? 1 : 0, transition: "opacity 0.2s" }}>
      <defs>
        <radialGradient id="ballGrad" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#fffde0" />
          <stop offset="40%" stopColor="#FFCB05" />
          <stop offset="100%" stopColor="#c9a800" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={BALL_D / 2}
        fill="url(#ballGrad)"
        stroke={GOLD_D} strokeWidth="1.5"
        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))" />
    </g>
  );
}

// ── Cooldown display ──────────────────────────────────────────────────────────

function CooldownTimer({ ms }: { ms: number }) {
  const [remaining, setRemaining] = useState(ms);
  useEffect(() => {
    setRemaining(ms);
    const iv = setInterval(() => setRemaining(r => Math.max(0, r - 1000)), 1000);
    return () => clearInterval(iv);
  }, [ms]);

  const m = Math.floor(remaining / 60_000);
  const s = Math.floor((remaining % 60_000) / 1_000);
  return (
    <span className="flex items-center gap-1 font-semibold" style={{ color: GOLD }}>
      <Timer size={13} />
      {String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
    </span>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  balance: number;
  playerId: string | null;
  vaultBalance: number;
  lastWinnerMessage: string | null;
  isAdmin?: boolean;
}

export function ShellGame({ balance, playerId, vaultBalance, lastWinnerMessage, isAdmin }: Props) {
  const router = useRouter();

  // Minimizable
  const [expanded, setExpanded] = useState(false);
  // Debug mode (admin)
  const [debugMode, setDebugMode] = useState(false);

  // Jogo
  const [phase, setPhase]     = useState<Phase>("idle");
  const [cupX, setCupX]       = useState(SLOTS.slice() as [number, number, number]);
  const [liftedCup, setLiftedCup] = useState<number | null>(null); // índice do copo levantado
  const [ballCup, setBallCup] = useState(1);         // qual copo tem a bolinha
  const [showBall, setShowBall] = useState(false);   // bolinha visível?
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bet, setBet]         = useState(100);
  const [result, setResult]   = useState<{ won: boolean; prize: number; actualCup: number } | null>(null);
  const [localBalance, setLocalBalance] = useState(balance);
  const [cooldownMs, setCooldownMs] = useState(0);

  // Carrega cooldown ao montar
  useEffect(() => {
    if (!playerId) return;
    getShellGameCooldown().then(r => setCooldownMs(r.cooldownMs));
  }, [playerId]);

  // Mantém saldo local em sync com props
  useEffect(() => { setLocalBalance(balance); }, [balance]);

  // ── Utilidades de animação ────────────────────────────────────────────────

  const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

  /** Troca as posições X de dois copos */
  const swapCups = useCallback((a: number, b: number, speed: number) => {
    setCupX(prev => {
      const next = [...prev] as [number, number, number];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
    return delay(speed + 30);
  }, []);

  /** Levanta ou abaixa um copo específico */
  const liftCup = (idx: number | null) => {
    setLiftedCup(idx);
    return delay(350);
  };

  // ── Sequência completa do jogo ────────────────────────────────────────────

  const runGame = useCallback(async (sid: string, ballIdx: number) => {
    // 1. Mostra a bolinha levantando o copo do meio (que é onde está a bola inicialmente)
    setBallCup(ballIdx);
    setShowBall(true);
    setPhase("showing");
    await liftCup(ballIdx);
    await delay(900);

    // 2. Abaixa o copo, esconde a bolinha
    setPhase("hiding");
    await liftCup(null);
    await delay(400);
    setShowBall(false);
    await delay(200);

    // 3. Embaralha — sequência de trocas progressivamente mais rápidas
    setPhase("shuffling");
    const pairs: [number, number][] = [];
    for (let i = 0; i < 18; i++) {
      const candidates: [number, number][] = [[0,1],[1,2],[0,2]];
      pairs.push(candidates[Math.floor(Math.random() * candidates.length)]);
    }
    const speeds = [280, 260, 240, 220, 200, 180, 160, 150, 140, 130, 120, 110, 105, 100, 95, 90, 85, 80];
    for (let i = 0; i < pairs.length; i++) {
      await swapCups(pairs[i][0], pairs[i][1], speeds[i] ?? 80);
    }
    await delay(200);

    // 4. Aguarda palpite
    setPhase("pick");
    setSessionId(sid);
  }, [swapCups]);

  // ── Iniciar jogo ──────────────────────────────────────────────────────────

  const handleStart = async () => {
    if (!playerId) { toast.error("Faça login para jogar."); return; }
    if (cooldownMs > 0 && !isAdmin) return;

    setPhase("dealing");
    setResult(null);
    setCupX(SLOTS.slice() as [number, number, number]);
    setLiftedCup(null);
    setShowBall(false);

    const r = await startShellGameSession(bet);
    if (r.error) { toast.error(r.error); setPhase("idle"); return; }
    if (r.lastCooldownMs) { setCooldownMs(r.lastCooldownMs); setPhase("idle"); return; }
    if (!r.sessionId) { setPhase("idle"); return; }

    if (r.debugMode) setDebugMode(true);
    if (r.newBalance !== undefined) setLocalBalance(r.newBalance);

    // A bolinha sempre começa no copo do MEIO visualmente
    // (a posição real está no servidor; a animação inicial é apenas visual)
    await runGame(r.sessionId, 1);
  };

  // ── Palpite do jogador ────────────────────────────────────────────────────

  const handlePick = async (cupIdx: number) => {
    if (phase !== "pick" || !sessionId) return;
    setPhase("lifting");

    // Descobre qual slot esse copo está para mostrar visualmente
    await liftCup(cupIdx);
    await delay(350);
    setShowBall(true);
    await delay(600);

    const r = await resolveShellGame(sessionId, cupIdx);
    if (r.error) { toast.error(r.error); setPhase("idle"); return; }

    if (r.debugMode) setDebugMode(true);
    if (r.newBalance !== undefined) setLocalBalance(r.newBalance);

    // Levanta o copo correto se errou
    if (!r.won && r.actualPos !== undefined && r.actualPos !== cupIdx) {
      await liftCup(r.actualPos);
      await delay(400);
    }

    const actualCupIdx = r.actualPos ?? 0;
    setBallCup(actualCupIdx);
    setResult({ won: r.won ?? false, prize: r.prize ?? 0, actualCup: actualCupIdx });
    setPhase(r.won ? "won" : "lost");

    // Cooldown após jogar
    setCooldownMs(5 * 60_000);
    setTimeout(() => { router.refresh(); }, 1500);
  };

  // ── Reiniciar ─────────────────────────────────────────────────────────────

  const handleReset = () => {
    setPhase("idle");
    setResult(null);
    setCupX(SLOTS.slice() as [number, number, number]);
    setLiftedCup(null);
    setShowBall(false);
    setSessionId(null);
  };

  const vaultPrize = Math.floor(vaultBalance * 0.20);
  const totalPrize = bet + vaultPrize;
  const isPlaying  = phase !== "idle" && phase !== "won" && phase !== "lost";

  return (
    <div className="rounded-2xl overflow-hidden" style={{
      background: "linear-gradient(135deg,#1a1105 0%,#0e0c06 60%,#1a1105 100%)",
      boxShadow: `0 0 0 1px ${GOLD_D}`,
    }}>
      {/* Always visible header — click to toggle */}
      <button type="button" onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ background: expanded ? "#1e1608" : "#140f03", borderBottom: expanded ? `1px solid ${GOLD_D}` : "none" }}>
        <div className="flex items-center gap-3">
          <span className="text-xl">🎩</span>
          <div>
            <p className="font-pixel text-sm" style={{ color: "#FFCB05" }}>Jogo do Miauvadão</p>
            <p className="text-[10px]" style={{ color: GOLD_D }}>
              {expanded ? "Clique para fechar" : "Clique para jogar e testar sua sorte!"}
            </p>
          </div>
        </div>
        <div style={{ color: GOLD, fontSize: 18 }}>{expanded ? "▲" : "▼"}</div>
      </button>

      {/* Collapsible content */}
      {expanded && (
      <div className="px-5 pt-4 pb-6 space-y-4">
        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[11px] mt-0.5" style={{ color: GOLD_D }}>
              Encontre a bolinha e ganhe <strong style={{ color: "#FFCB05" }}>{totalPrize.toLocaleString("pt-BR")} ZC</strong>
              <span style={{ color: GOLD_D }}> (aposta + 20% do cofre)</span>
            </p>
          </div>
          <div className="text-[10px] flex flex-col items-end gap-0.5" style={{ color: GOLD_D }}>
            <span>Cofre: <strong style={{ color: "#FFCB05" }}>{vaultBalance.toLocaleString("pt-BR")} ZC</strong></span>
            <span>Prêmio do cofre: <strong style={{ color: "#FFCB05" }}>+{vaultPrize.toLocaleString("pt-BR")} ZC</strong></span>
          </div>
        </div>

        {debugMode && (
          <div className="text-center text-[10px] font-bold" style={{ color: "#ef4444" }}>
            ⚡ MODO DEBUG — sem efeito nos fundos
          </div>
        )}

        {/* ── Arena do jogo ── */}
        <div className="flex flex-col items-center gap-5">
          {/* Mesa */}
          <div className="relative rounded-xl p-5"
            style={{ background: "#140f03", border: `2px solid ${GOLD_D}`, minWidth: CONTAINER_W + 40 }}>

            {/* Status text */}
            <div className="text-center mb-4 h-6">
              {phase === "idle"      && <span style={{ color: GOLD_D, fontSize: 12 }}>Faça sua aposta e inicie o jogo</span>}
              {phase === "dealing"   && <span style={{ color: GOLD,   fontSize: 12 }}>Preparando...</span>}
              {phase === "showing"   && <span style={{ color: "#FFCB05", fontSize: 12, fontWeight: 700 }}>Memorize a posição da bolinha! 👀</span>}
              {phase === "hiding"    && <span style={{ color: GOLD_D, fontSize: 12 }}>Escondendo...</span>}
              {phase === "shuffling" && <span style={{ color: "#FFCB05", fontSize: 12, fontWeight: 700 }}>Acompanhe os copos! 🎩</span>}
              {phase === "pick"      && <span style={{ color: "#FFCB05", fontSize: 13, fontWeight: 800, animation: "pulse 1s infinite" }}>👆 Clique no copo certo!</span>}
              {phase === "lifting"   && <span style={{ color: GOLD, fontSize: 12 }}>Revelando...</span>}
              {phase === "won"  && result && <span style={{ color: "#4ade80", fontSize: 14, fontWeight: 800 }}>🎉 Você ganhou {result.prize.toLocaleString("pt-BR")} ZC!</span>}
              {phase === "lost"      && <span style={{ color: "#ef4444", fontSize: 14, fontWeight: 800 }}>😿 Errou! O Miauvadão venceu!</span>}
            </div>

            {/* SVG arena */}
            <div className="flex justify-center">
              <svg
                width={CONTAINER_W}
                height={CUP_H + LIFT + BALL_D + 16}
                style={{ overflow: "visible" }}
              >
                {/* Base/mesa */}
                <rect x={-8} y={CUP_H + LIFT + 2} width={CONTAINER_W + 16} height={10}
                  rx="4" fill="#2a1a03" stroke={GOLD_D} strokeWidth="1" />

                {/* Bolinha (renderizada ANTES dos copos para ficar atrás) */}
                <g transform={`translate(0, ${LIFT})`}>
                  <Ball
                    x={cupX[ballCup]}
                    visible={showBall}
                  />
                </g>

                {/* Copos */}
                <g transform={`translate(0, ${LIFT})`}>
                  {[0, 1, 2].map(i => (
                    <Cup
                      key={i}
                      x={cupX[i]}
                      lifted={liftedCup === i}
                      dimmed={phase === "won" && result?.actualCup !== i}
                      onClick={() => handlePick(i)}
                      phase={phase}
                    />
                  ))}
                </g>
              </svg>
            </div>
          </div>

          {/* ── Controles ── */}
          {(phase === "idle" || phase === "won" || phase === "lost") && (
            <div className="w-full max-w-sm space-y-3">
              {/* Seletor de aposta */}
              {phase === "idle" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs" style={{ color: GOLD_D }}>
                    <span>Aposta (50–2000 ZC)</span>
                    <span>Saldo: <strong style={{ color: "#FFCB05" }}>{localBalance.toLocaleString("pt-BR")} ZC</strong></span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={50} max={Math.min(2000, localBalance)}
                      value={bet}
                      onChange={e => setBet(Math.min(2000, Math.max(50, parseInt(e.target.value) || 50)))}
                      className="flex-1 rounded-xl border px-3 py-2 text-center text-sm font-bold outline-none"
                      style={{ background: "#0d0b08", borderColor: GOLD_D, color: "#FFCB05" }}
                    />
                  </div>
                  {/* Atalhos */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[50, 100, 250, 500].map(v => (
                      <button key={v} type="button"
                        onClick={() => setBet(Math.min(v, localBalance))}
                        className="rounded-lg py-1 text-[11px] font-semibold transition-all"
                        style={{
                          background: bet === v ? GOLD : "#2a1a03",
                          color: bet === v ? "#1a1209" : GOLD_D,
                          border: `1px solid ${GOLD_D}`,
                        }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Botão principal */}
              {phase === "idle" && (
                cooldownMs > 0 ? (
                  <div className="rounded-xl py-3 text-center text-xs"
                    style={{ background: "#2a1a03", border: `1px solid ${GOLD_D}` }}>
                    <span style={{ color: GOLD_D }}>Próxima jogada em </span>
                    <CooldownTimer ms={cooldownMs} />
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!playerId || bet > localBalance || bet < 50}
                    onClick={handleStart}
                    className="w-full rounded-xl py-3 text-sm font-black transition-all disabled:opacity-40"
                    style={{
                      background: `linear-gradient(135deg, ${GOLD}, #8b5e00)`,
                      color: "#1a1209",
                      boxShadow: `0 0 0 2px ${GOLD_D}, 0 4px 16px rgba(201,168,0,0.3)`,
                    }}>
                    🎩 Jogar por {bet.toLocaleString("pt-BR")} ZC
                  </button>
                )
              )}

              {/* Pós-jogo */}
              {(phase === "won" || phase === "lost") && (
                <div className="space-y-2">
                  {phase === "won" && result && (
                    <div className="rounded-xl py-3 text-center space-y-1"
                      style={{ background: "#0a2010", border: "2px solid #4ade80" }}>
                      <Trophy size={20} className="mx-auto text-green-400" />
                      <p className="text-sm font-black text-green-400">+{result.prize.toLocaleString("pt-BR")} ZC</p>
                      <p className="text-[10px] text-green-700">adicionados ao seu saldo</p>
                    </div>
                  )}
                  {phase === "lost" && (
                    <div className="rounded-xl py-3 text-center space-y-1"
                      style={{ background: "#200a0a", border: "2px solid #ef4444" }}>
                      <Skull size={20} className="mx-auto text-red-400" />
                      <p className="text-sm font-black text-red-400">-{bet.toLocaleString("pt-BR")} ZC</p>
                      <p className="text-[10px] text-red-800">o Miauvadão venceu desta vez!</p>
                    </div>
                  )}
                  <button type="button" onClick={handleReset}
                    className="w-full rounded-xl py-2.5 text-xs font-bold"
                    style={{ background: "#2a1a03", border: `1px solid ${GOLD_D}`, color: GOLD_D }}>
                    Jogar novamente
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Cancelar durante shuffling não é possível — apenas instrução */}
          {phase === "pick" && (
            <p className="text-[11px] animate-pulse" style={{ color: "#FFCB05" }}>
              Escolha um dos 3 copos acima! ↑
            </p>
          )}
        </div>

        {/* Regras */}
        <div className="rounded-xl px-3 py-2 text-[10px] space-y-0.5"
          style={{ background: "#0d0b08", color: GOLD_D }}>
          <p>🎯 <strong style={{ color: GOLD }}>Como jogar:</strong> A bolinha começa no copo do meio. Observe enquanto os copos embaralham. Clique no copo que você acha que esconde a bolinha.</p>
          <p>🏆 <strong style={{ color: GOLD }}>Prêmio:</strong> Sua aposta + 20% do cofre do Miauvadão. Cooldown de 5 min entre jogadas.</p>
        </div>
      </div>
      )}
    </div>
  );
}
