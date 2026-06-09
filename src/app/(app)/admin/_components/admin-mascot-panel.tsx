"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Plus, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPokemonName } from "@/lib/mascot-data";
import { MascotPersonality } from "@prisma/client";
import {
  getPlayerMascotsAdmin,
  cloneMascotAction,
  createMascotForPlayerAction,
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
      `• O mascote original será DELETADO e substituído pelo clone.\n` +
      `• Expedições, relações e eventos NÃO são copiados.`
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
            <p className="text-slate-400">Expedições ativas serão encerradas sem recompensa. Relações e histórico de eventos não são copiados.</p>
            <p className="text-slate-400">Stats, nível, personalidade, humor, apelido{m.isShiny ? ", ✦ shiny" : ""} serão preservados.</p>
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
  const [pending, start] = useTransition();
  const DEFAULT_STAT = 10;

  const [playerId,    setPlayerId]    = useState("");
  const [pokemonId,   setPokemonId]   = useState("");
  const [personality, setPersonality] = useState<MascotPersonality>("LOYAL");
  const [isShiny,     setIsShiny]     = useState(false);
  const [isFavorite,  setIsFavorite]  = useState(false);
  const [level,       setLevel]       = useState("1");
  const [nickname,    setNickname]    = useState("");
  const [statF,       setStatF]       = useState(String(DEFAULT_STAT));
  const [statA,       setStatA]       = useState(String(DEFAULT_STAT));
  const [statC,       setStatC]       = useState(String(DEFAULT_STAT));
  const [statI,       setStatI]       = useState(String(DEFAULT_STAT));
  const [statV,       setStatV]       = useState(String(DEFAULT_STAT));
  const [result,      setResult]      = useState<string | null>(null);

  const statInt = (v: string, fallback = DEFAULT_STAT) => {
    const n = parseInt(v);
    return isNaN(n) ? fallback : Math.max(1, Math.min(999, n));
  };

  const pokeIdNum = parseInt(pokemonId);
  const previewName = !isNaN(pokeIdNum) && pokeIdNum >= 1 && pokeIdNum <= 1025
    ? getPokemonName(pokeIdNum)
    : null;

  const handleCreate = () => {
    if (!playerId) { toast.error("Selecione um jogador."); return; }
    if (!pokeIdNum || pokeIdNum < 1 || pokeIdNum > 1025) { toast.error("Pokémon ID inválido (1–1025)."); return; }
    const lvl = parseInt(level);
    if (isNaN(lvl) || lvl < 1 || lvl > 100) { toast.error("Nível inválido (1–100)."); return; }

    const player = players.find(p => p.id === playerId);
    const name = nickname.trim() || (previewName ?? `#${pokeIdNum}`);
    if (!confirm(`Criar ${name} (Nv.${lvl}${isShiny ? " ✦ Shiny" : ""}) para ${player?.displayName}?`)) return;

    start(async () => {
      const r = await createMascotForPlayerAction({
        playerId, pokemonId: pokeIdNum, personality, isShiny, isFavorite,
        level: lvl,
        nickname: nickname.trim() || undefined,
        statForce:    statInt(statF),
        statAgility:  statInt(statA),
        statCharisma: statInt(statC),
        statInstinct: statInt(statI),
        statVitality: statInt(statV),
      });
      if (!r.ok) { toast.error(r.error ?? "Erro ao criar."); return; }
      toast.success(r.summary ?? "Mascote criado!");
      setResult(`✅ ${r.summary}\nID: ${r.mascotId}`);
      // Reset form
      setPokemonId(""); setNickname(""); setLevel("1"); setIsShiny(false); setIsFavorite(false);
      setStatF(String(DEFAULT_STAT)); setStatA(String(DEFAULT_STAT));
      setStatC(String(DEFAULT_STAT)); setStatI(String(DEFAULT_STAT)); setStatV(String(DEFAULT_STAT));
    });
  };

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
            Pokémon ID (1–1025)
            {previewName && <span className="ml-1.5 font-normal text-[#FFCB05]">→ {previewName}</span>}
          </label>
          <input type="number" min={1} max={1025} value={pokemonId}
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

      {/* Stats */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-400">Stats base</p>
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: "Força",     val: statF, set: setStatF },
            { label: "Agilidade", val: statA, set: setStatA },
            { label: "Carisma",   val: statC, set: setStatC },
            { label: "Instinto",  val: statI, set: setStatI },
            { label: "Vitalidade",val: statV, set: setStatV },
          ].map(s => (
            <div key={s.label} className="space-y-1 text-center">
              <label className="text-[10px] text-slate-500 block">{s.label}</label>
              <input type="number" min={1} max={999} value={s.val}
                onChange={e => s.set(e.target.value)}
                className="w-full rounded-lg border border-border bg-slate-900 px-2 py-1.5 text-xs text-slate-200 text-center outline-none focus:border-[#FFCB05]" />
            </div>
          ))}
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
    </div>
  );
}
