"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Plus, RefreshCw, Sparkles, Trash2, Wand2, Shuffle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPokemonName } from "@/lib/mascot-data";
import { MascotPersonality } from "@prisma/client";
import {
  getPlayerMascotsAdmin,
  cloneMascotAction,
  createMascotForPlayerAction,
  computeProceduralStatsAction,
  deleteMascotAction,
} from "../actions";

type Mascot = {
  id: string; pokemonId: number; nickname: string | null; level: number;
  isFavorite: boolean; isEquipped: boolean; arenaState: string;
  bazarListed: boolean; activeExpedition: boolean; isShiny?: boolean;
};

const PERSONALITIES: { value: MascotPersonality; label: string }[] = [
  { value: "LOYAL",       label: "Leal" },
  { value: "PROUD",       label: "Orgulhoso" },
  { value: "MISCHIEVOUS", label: "Travesso" },
  { value: "LAZY",        label: "Preguiçoso" },
  { value: "COMPETITIVE", label: "Competitivo" },
  { value: "DRAMATIC",    label: "Dramático" },
  { value: "PLAYFUL",     label: "Brincalhão" },
  { value: "ELECTRIC",    label: "Elétrico" },
  { value: "TIMID",       label: "Tímido" },
  { value: "CHAOTIC",     label: "Caótico" },
];

interface Props {
  players: { id: string; displayName: string }[];
}

// ── Seção Clonar ──────────────────────────────────────────────────────────────
function CloneSection({ players }: Props) {
  const [pending, start] = useTransition();
  const [playerId, setPlayerId] = useState("");
  const [mascots,  setMascots]  = useState<Mascot[]>([]);
  const [mascotId, setMascotId] = useState("");
  const [result,   setResult]   = useState<string | null>(null);

  const loadMascots = (id: string) => {
    setPlayerId(id); setMascotId(""); setMascots([]); setResult(null);
    if (!id) return;
    start(async () => {
      const r = await getPlayerMascotsAdmin(id);
      if (r.error) { toast.error(r.error); return; }
      setMascots(r.mascots);
    });
  };

  const handleClone = () => {
    const m = mascots.find(x => x.id === mascotId);
    if (!m) { toast.error("Selecione um mascote."); return; }
    const name = m.nickname ?? getPokemonName(m.pokemonId);
    if (!confirm(
      `Clonar ${name} (Nv.${m.level})?\n\n` +
      `• Todos os atributos, nível, personalidade e stats serão copiados.\n` +
      `• Amigos e rivais serão transferidos para o clone.\n` +
      `• O mascote original será DELETADO e substituído pelo clone.\n` +
      `• Expedições ativas e histórico de eventos NÃO são copiados.`
    )) return;

    start(async () => {
      const r = await cloneMascotAction(mascotId);
      if (!r.ok) { toast.error(r.error ?? "Erro ao clonar."); return; }
      toast.success(r.summary ?? "Clonado!");
      setResult(`✅ ${r.summary}\nNovo ID: ${r.newMascotId}`);
      setMascotId("");
      const upd = await getPlayerMascotsAdmin(playerId);
      if (!upd.error) setMascots(upd.mascots);
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/50 bg-slate-900/40 p-4">
      <div className="flex items-center gap-2">
        <Copy size={14} className="text-blue-400" />
        <p className="text-sm font-semibold text-slate-200">Clonar Mascote</p>
        <span className="text-xs text-slate-500">— recria o pokémon limpando estados travados</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400">Jogador</label>
          <select value={playerId} onChange={e => loadMascots(e.target.value)}
            className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]">
            <option value="">Selecione o jogador</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400">Mascote a clonar</label>
          <select value={mascotId} onChange={e => setMascotId(e.target.value)}
            disabled={mascots.length === 0}
            className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05] disabled:opacity-50">
            <option value="">{pending ? "Carregando…" : "Selecione"}</option>
            {mascots.map(m => (
              <option key={m.id} value={m.id}>
                {m.nickname ?? getPokemonName(m.pokemonId)} — Nv.{m.level}
                {m.isEquipped ? " 🎯" : ""}{m.isFavorite ? " ⭐" : ""}
                {m.activeExpedition ? " 🗺" : ""}
                {m.arenaState !== "FREE" ? ` (${m.arenaState})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mascotId && (() => {
        const m = mascots.find(x => x.id === mascotId)!;
        return (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300 space-y-0.5">
            <p className="font-semibold">⚠️ O original será deletado após a clonagem.</p>
            <p className="text-slate-400">Expedições ativas serão encerradas sem recompensa. Histórico de eventos não é copiado.</p>
            <p className="text-slate-400">Stats, nível, personalidade, humor, apelido{m.isShiny ? ", ✦ shiny" : ""}, amigos e rivais serão preservados.</p>
          </div>
        );
      })()}

      <Button type="button" disabled={pending || !mascotId} onClick={handleClone}
        className="gap-2 bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40">
        <Copy size={13} className={pending ? "animate-spin" : ""} />
        {pending ? "Clonando…" : "Clonar e substituir"}
      </Button>

      {result && (
        <pre className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-2.5 text-xs text-green-300 whitespace-pre-wrap">
          {result}
        </pre>
      )}
    </div>
  );
}

// ── Seção Criar Mascote ───────────────────────────────────────────────────────
function CreateSection({ players }: Props) {
  const [pending,      start]          = useTransition();
  const [calcPending,  startCalc]      = useTransition();
  const DEFAULT_STAT = 10;

  const [playerId,    setPlayerId]    = useState("");
  const [pokemonId,   setPokemonId]   = useState("");
  const [personality, setPersonality] = useState<MascotPersonality>("LOYAL");
  const [isShiny,     setIsShiny]     = useState(false);
  const [isFavorite,  setIsFavorite]  = useState(false);
  const [level,       setLevel]       = useState("1");
  const [nickname,    setNickname]    = useState("");

  // Modo procedural
  const [procedural,  setProcedural]  = useState(false);
  const [proceduralBase, setProceduralBase] = useState<{ statForce: number; statAgility: number; statCharisma: number; statInstinct: number; statVitality: number } | null>(null);

  // Stats manuais (usados em modo manual ou como base editável pós-cálculo)
  const [statF, setStatF] = useState(String(DEFAULT_STAT));
  const [statA, setStatA] = useState(String(DEFAULT_STAT));
  const [statC, setStatC] = useState(String(DEFAULT_STAT));
  const [statI, setStatI] = useState(String(DEFAULT_STAT));
  const [statV, setStatV] = useState(String(DEFAULT_STAT));

  // Bônus manual por stat (sobre o valor procedural/manual)
  const [bonusF, setBonusF] = useState("0");
  const [bonusA, setBonusA] = useState("0");
  const [bonusC, setBonusC] = useState("0");
  const [bonusI, setBonusI] = useState("0");
  const [bonusV, setBonusV] = useState("0");

  // Pontos extras aleatórios
  const [extraRandom, setExtraRandom] = useState("0");

  const [result, setResult] = useState<string | null>(null);

  const statInt = (v: string, fallback = DEFAULT_STAT) => {
    const n = parseInt(v); return isNaN(n) ? fallback : Math.max(0, Math.min(999, n));
  };
  const clampStat = (base: number, bonus: number) => Math.max(1, Math.min(999, base + bonus));

  const pokeIdNum = parseInt(pokemonId);
  const ROTOM_FORM_IDS = new Set([10008, 10009, 10010, 10011, 10012]);
  const isValidPokemonId = (id: number) => (id >= 1 && id <= 1025) || ROTOM_FORM_IDS.has(id);
  const previewName = !isNaN(pokeIdNum) && isValidPokemonId(pokeIdNum)
    ? getPokemonName(pokeIdNum)
    : null;

  // Calcula proceduralmente
  const handleCompute = () => {
    if (!pokeIdNum || !isValidPokemonId(pokeIdNum)) { toast.error("Pokémon ID inválido."); return; }
    const lvl = parseInt(level);
    if (isNaN(lvl) || lvl < 1 || lvl > 100) { toast.error("Nível inválido."); return; }
    startCalc(async () => {
      const r = await computeProceduralStatsAction({ pokemonId: pokeIdNum, level: lvl, personality });
      if (!r.ok || !r.stats) { toast.error(r.error ?? "Erro ao calcular."); return; }
      setProceduralBase(r.stats);
      setStatF(String(r.stats.statForce));
      setStatA(String(r.stats.statAgility));
      setStatC(String(r.stats.statCharisma));
      setStatI(String(r.stats.statInstinct));
      setStatV(String(r.stats.statVitality));
      toast.success("Stats procedurais calculados!");
    });
  };

  const handleCreate = () => {
    if (!playerId) { toast.error("Selecione um jogador."); return; }
    if (!pokeIdNum || !isValidPokemonId(pokeIdNum)) { toast.error("Pokémon ID inválido."); return; }
    const lvl = parseInt(level);
    if (isNaN(lvl) || lvl < 1 || lvl > 100) { toast.error("Nível inválido (1–100)."); return; }

    const finalF = clampStat(statInt(statF), statInt(bonusF, 0));
    const finalA = clampStat(statInt(statA), statInt(bonusA, 0));
    const finalC = clampStat(statInt(statC), statInt(bonusC, 0));
    const finalI = clampStat(statInt(statI), statInt(bonusI, 0));
    const finalV = clampStat(statInt(statV), statInt(bonusV, 0));
    const extraPts = Math.max(0, statInt(extraRandom, 0));

    const player = players.find(p => p.id === playerId);
    const name = nickname.trim() || (previewName ?? `#${pokeIdNum}`);
    const summaryLine = [
      `Criar ${name} (Nv.${lvl}${isShiny ? " ✦ Shiny" : ""}) para ${player?.displayName}`,
      `Stats: F${finalF} A${finalA} C${finalC} I${finalI} V${finalV}`,
      extraPts > 0 ? `+${extraPts} pts aleatórios extras` : null,
    ].filter(Boolean).join("\n");
    if (!confirm(summaryLine)) return;

    start(async () => {
      const r = await createMascotForPlayerAction({
        playerId, pokemonId: pokeIdNum, personality, isShiny, isFavorite,
        level: lvl,
        nickname: nickname.trim() || undefined,
        statForce:    finalF,
        statAgility:  finalA,
        statCharisma: finalC,
        statInstinct: finalI,
        statVitality: finalV,
        extraRandomPoints: extraPts || undefined,
      });
      if (!r.ok) { toast.error(r.error ?? "Erro ao criar."); return; }
      toast.success(r.summary ?? "Mascote criado!");
      setResult(`✅ ${r.summary}\nID: ${r.mascotId}`);
      // Reset
      setPokemonId(""); setNickname(""); setLevel("1"); setIsShiny(false); setIsFavorite(false);
      setStatF(String(DEFAULT_STAT)); setStatA(String(DEFAULT_STAT));
      setStatC(String(DEFAULT_STAT)); setStatI(String(DEFAULT_STAT)); setStatV(String(DEFAULT_STAT));
      setBonusF("0"); setBonusA("0"); setBonusC("0"); setBonusI("0"); setBonusV("0");
      setExtraRandom("0"); setProceduralBase(null);
    });
  };

  const statRows = [
    { label: "Força",      key: "F", val: statF, set: setStatF, bonus: bonusF, setBonus: setBonusF, proc: proceduralBase?.statForce },
    { label: "Agilidade",  key: "A", val: statA, set: setStatA, bonus: bonusA, setBonus: setBonusA, proc: proceduralBase?.statAgility },
    { label: "Carisma",    key: "C", val: statC, set: setStatC, bonus: bonusC, setBonus: setBonusC, proc: proceduralBase?.statCharisma },
    { label: "Instinto",   key: "I", val: statI, set: setStatI, bonus: bonusI, setBonus: setBonusI, proc: proceduralBase?.statInstinct },
    { label: "Vitalidade", key: "V", val: statV, set: setStatV, bonus: bonusV, setBonus: setBonusV, proc: proceduralBase?.statVitality },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-border/50 bg-slate-900/40 p-4">
      <div className="flex items-center gap-2">
        <Plus size={14} className="text-green-400" />
        <p className="text-sm font-semibold text-slate-200">Adicionar Mascote</p>
        <span className="text-xs text-slate-500">— cria diretamente no inventário do jogador</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Jogador */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400">Jogador</label>
          <select value={playerId} onChange={e => setPlayerId(e.target.value)}
            className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]">
            <option value="">Selecione</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
        </div>

        {/* Pokémon ID */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400">
            Pokémon ID (1–1025 ou 10008–10012 para formas Rotom)
            {previewName && <span className="ml-1.5 font-normal text-[#FFCB05]">→ {previewName}</span>}
          </label>
          <input type="number" min={1} value={pokemonId}
            onChange={e => setPokemonId(e.target.value)}
            placeholder="ex: 172 (Pichu)"
            className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05] placeholder:text-slate-600" />
        </div>

        {/* Nível */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400">Nível (1–100)</label>
          <input type="number" min={1} max={100} value={level}
            onChange={e => setLevel(e.target.value)}
            className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]" />
        </div>

        {/* Apelido */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400">Apelido <span className="font-normal text-slate-600">(opcional)</span></label>
          <input type="text" maxLength={30} value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="deixe vazio para usar o nome padrão"
            className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05] placeholder:text-slate-600" />
        </div>

        {/* Personalidade */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400">Personalidade</label>
          <select value={personality} onChange={e => setPersonality(e.target.value as MascotPersonality)}
            className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]">
            {PERSONALITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* Flags */}
        <div className="space-y-2 flex flex-col justify-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isShiny} onChange={e => setIsShiny(e.target.checked)}
              className="rounded accent-yellow-400" />
            <span className="text-xs text-slate-300">
              <Sparkles size={11} className="inline mr-0.5 text-yellow-300" /> Shiny
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isFavorite} onChange={e => setIsFavorite(e.target.checked)}
              className="rounded accent-yellow-400" />
            <span className="text-xs text-slate-300">⭐ Marcar como favorito</span>
          </label>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────────── */}
      <div className="space-y-3 rounded-xl border border-border/40 bg-slate-900/60 p-3">
        {/* Toggle procedural */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wand2 size={13} className="text-purple-400" />
            <p className="text-xs font-semibold text-slate-300">Stats</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={procedural} onChange={e => { setProcedural(e.target.checked); setProceduralBase(null); }}
              className="rounded accent-purple-500" />
            <span className="text-xs text-slate-300">
              <Wand2 size={10} className="inline mr-0.5 text-purple-400" /> Gerar proceduralmente
            </span>
          </label>
        </div>

        {/* Botão calcular */}
        {procedural && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/5 p-2.5">
            <Info size={12} className="text-purple-400 shrink-0" />
            <p className="text-[11px] text-slate-400 flex-1 min-w-0">
              Simula o crescimento desde o nível 1 com stats base aleatórios (range ovo Comum), aplicando o algoritmo real de level-up com os pesos da personalidade escolhida.
            </p>
            <Button type="button" disabled={calcPending || !pokemonId || !level} onClick={handleCompute}
              className="gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs h-7 px-3 disabled:opacity-40 shrink-0">
              <Shuffle size={11} className={calcPending ? "animate-spin" : ""} />
              {calcPending ? "Calculando…" : proceduralBase ? "↺ Reroll" : "Calcular"}
            </Button>
          </div>
        )}

        {/* Grid de stats — base editável */}
        <div className="space-y-1">
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {statRows.map(s => (
              <div key={s.key} className="space-y-1">
                <label className="text-[10px] text-slate-500 block">{s.label}</label>
                <input type="number" min={1} max={999} value={s.val}
                  onChange={e => s.set(e.target.value)}
                  className="w-full rounded-lg border border-border bg-slate-900 px-1 py-1.5 text-xs text-slate-200 text-center outline-none focus:border-[#FFCB05]" />
                {proceduralBase && s.proc !== undefined && (
                  <p className="text-[9px] text-purple-400/70 leading-none">base:{s.proc}</p>
                )}
              </div>
            ))}
          </div>
          {procedural && proceduralBase && (
            <p className="text-[10px] text-slate-600 italic">Stats preenchidos proceduralmente — edite à vontade antes de criar.</p>
          )}
        </div>

        {/* Bônus manual por stat */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <Plus size={9} /> Bônus manual adicional por stat
          </p>
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {statRows.map(s => {
              const bval = statInt(s.bonus, 0);
              const base = statInt(s.val);
              const total = clampStat(base, bval);
              return (
                <div key={`bonus-${s.key}`} className="space-y-1">
                  <input type="number" min={-999} max={999} value={s.bonus}
                    onChange={e => s.setBonus(e.target.value)}
                    className={`w-full rounded-lg border bg-slate-900 px-1 py-1.5 text-xs text-center outline-none focus:border-[#FFCB05] ${
                      bval > 0 ? "border-green-500/40 text-green-300" :
                      bval < 0 ? "border-red-500/40 text-red-300"    :
                      "border-border text-slate-500"
                    }`} />
                  {bval !== 0 && (
                    <p className="text-[9px] text-slate-400 leading-none">= {total}</p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-600">Soma diretamente ao stat base. Pode ser negativo para reduzir.</p>
        </div>

        {/* Pontos aleatórios extras */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/30">
          <div className="flex items-center gap-2">
            <Shuffle size={11} className="text-orange-400" />
            <label className="text-[11px] text-slate-400 font-semibold">Pontos extras aleatórios:</label>
            <input type="number" min={0} max={500} value={extraRandom}
              onChange={e => setExtraRandom(e.target.value)}
              className="w-16 rounded-lg border border-border bg-slate-900 px-2 py-1 text-xs text-slate-200 text-center outline-none focus:border-orange-400/60" />
          </div>
          <p className="text-[10px] text-slate-600">
            Distribuídos aleatoriamente entre os 5 stats ao criar. Útil para variação natural sem definir manualmente.
          </p>
        </div>
      </div>

      <Button type="button" disabled={pending || !playerId || !pokemonId} onClick={handleCreate}
        className="gap-2 bg-green-600 hover:bg-green-500 text-white disabled:opacity-40">
        <Plus size={13} className={pending ? "animate-spin" : ""} />
        {pending ? "Criando…" : "Criar Mascote"}
      </Button>

      {result && (
        <pre className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-2.5 text-xs text-green-300 whitespace-pre-wrap">
          {result}
        </pre>
      )}
    </div>
  );
}

// ── Seção Remover Mascote ─────────────────────────────────────────────────────
function DeleteSection({ players }: Props) {
  const [pending, start] = useTransition();
  const [playerId, setPlayerId] = useState("");
  const [mascots,  setMascots]  = useState<Mascot[]>([]);
  const [mascotId, setMascotId] = useState("");
  const [result,   setResult]   = useState<string | null>(null);

  const loadMascots = (id: string) => {
    setPlayerId(id); setMascotId(""); setMascots([]); setResult(null);
    if (!id) return;
    start(async () => {
      const r = await getPlayerMascotsAdmin(id);
      if (r.error) { toast.error(r.error); return; }
      setMascots(r.mascots);
    });
  };

  const handleDelete = () => {
    const m = mascots.find(x => x.id === mascotId);
    if (!m) { toast.error("Selecione um mascote."); return; }
    const name = m.nickname ?? getPokemonName(m.pokemonId);
    const player = players.find(p => p.id === playerId);
    if (!confirm(
      `⚠️ ATENÇÃO — Esta ação é PERMANENTE.\n\n` +
      `Remover ${name} (Nv.${m.level}) da conta de ${player?.displayName}?\n\n` +
      `Todos os dados (expedições, relações, eventos, buffs) serão deletados.`
    )) return;

    start(async () => {
      const r = await deleteMascotAction(mascotId);
      if (!r.ok) { toast.error(r.error ?? "Erro ao remover."); return; }
      toast.success(r.summary ?? "Removido!");
      setResult(`🗑️ ${r.summary}`);
      setMascotId("");
      const upd = await getPlayerMascotsAdmin(playerId);
      if (!upd.error) setMascots(upd.mascots);
    });
  };

  const selected = mascots.find(x => x.id === mascotId);

  return (
    <div className="space-y-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
      <div className="flex items-center gap-2">
        <Trash2 size={14} className="text-red-400" />
        <p className="text-sm font-semibold text-slate-200">Remover Mascote</p>
        <span className="text-xs text-red-500/70">— ação permanente, não pode ser desfeita</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400">Jogador</label>
          <select value={playerId} onChange={e => loadMascots(e.target.value)}
            className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-red-500">
            <option value="">Selecione o jogador</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400">
            Mascote {mascots.length > 0 && <span className="text-slate-600 font-normal">({mascots.length})</span>}
          </label>
          <select value={mascotId} onChange={e => setMascotId(e.target.value)}
            disabled={mascots.length === 0}
            className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-red-500 disabled:opacity-50">
            <option value="">{pending ? "Carregando…" : "Selecione"}</option>
            {mascots.map(m => (
              <option key={m.id} value={m.id}>
                {m.nickname ?? getPokemonName(m.pokemonId)} — Nv.{m.level}
                {m.isEquipped ? " 🎯" : ""}{m.isFavorite ? " ⭐" : ""}
                {m.activeExpedition ? " 🗺" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-300 space-y-0.5">
          <p className="font-semibold">
            {selected.nickname ?? getPokemonName(selected.pokemonId)} — Nv.{selected.level}
            {selected.isShiny ? " ✦" : ""}
            {selected.isEquipped ? " 🎯 (companheiro ativo)" : ""}
            {selected.isFavorite ? " ⭐" : ""}
          </p>
          <p className="text-red-400/70">Este mascote será deletado permanentemente junto com todas as suas expedições, relações, eventos e buffs.</p>
        </div>
      )}

      <Button type="button" disabled={pending || !mascotId} onClick={handleDelete}
        className="gap-2 bg-red-600 hover:bg-red-500 text-white disabled:opacity-40">
        <Trash2 size={13} />
        {pending ? "Removendo…" : "Remover mascote"}
      </Button>

      {result && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-xs text-red-300">
          {result}
        </p>
      )}
    </div>
  );
}

// ── Export principal ──────────────────────────────────────────────────────────
export function AdminMascotPanel({ players }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <RefreshCw size={16} className="text-[#FFCB05]" />
        <h3 className="font-semibold text-slate-200">Gerenciamento de Mascotes</h3>
      </div>
      <CloneSection players={players} />
      <CreateSection players={players} />
      <DeleteSection players={players} />
    </div>
  );
}
