"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getPokemonTypes, getStaticSpriteUrl } from "@/lib/mascot-data";
import { getCombatRoleLabel } from "@/lib/combat-roles";
import { getTowerLobbyDataAction, createTowerRunAction, joinTowerRoomAction, contributeTowerPreparationAction, spendTowerTalentAction } from "../actions";
import { TowerRunPanel } from "./tower-run-panel";
import { TowerKnowledge, TowerNarrative, TowerNarrativeAdmin } from "./tower-narrative";
import { TowerAdminSettings } from "./tower-admin-settings";
import { TowerIntro } from "./tower-intro";

type LobbyData = Extract<Awaited<ReturnType<typeof getTowerLobbyDataAction>>, { ok: true }>;
type Role = LobbyData["roles"][number];
type Mascot = LobbyData["mascots"][number];

const card = "rounded-2xl border border-slate-800 bg-slate-950/70 p-5";

export function TowerLobby() {
  const router = useRouter();
  const [data, setData] = useState<LobbyData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [pace, setPace] = useState<"ONLINE" | "SLOW">("ONLINE");
  const [role, setRole] = useState<Role["key"] | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [stances, setStances] = useState<Record<string,string>>({});
  const [search,setSearch]=useState(""); const [typeFilter,setTypeFilter]=useState("ALL"); const [mascotPage,setMascotPage]=useState(1); const [introKey,setIntroKey]=useState(0);

  const load = () => {
    void getTowerLobbyDataAction().then((res) => {
      if ("error" in res) { setLoadError(res.error ?? "Erro ao carregar o lobby."); return; }
      setData(res);
      const firstKey: Role["key"] | null = res.roles[0]?.key ?? null;
      setRole((r) => r ?? firstKey);
    });
  };
  useEffect(load, []);

  if (loadError) return <section className={card}><p className="text-sm text-red-300">{loadError}</p></section>;
  if (!data) return <section className={card}><p className="text-sm text-slate-500">Carregando lobby…</p></section>;

  // Já existe uma expedição ativa (lobby ou em andamento) → painel de turno.
  if (data.activeRun) {
    return <div className="space-y-4"><TowerIntro forceKey={introKey}/><button type="button" onClick={()=>setIntroKey(Date.now())} className="rounded-xl border border-purple-400/30 bg-purple-400/10 px-4 py-2 text-xs font-black text-purple-200">▶ Testar introdução do evento</button><TowerAdminSettings initial={data.config} onSaved={load}/><TowerNarrativeAdmin initial={data.scenes}/><TowerRunPanel runId={data.activeRun.id} onLeft={() => { router.refresh(); load(); }} /></div>;
  }

  // Cooldown de entrada.
  if (data.nextEntryAt) {
    const when = new Date(data.nextEntryAt).toLocaleString("pt-BR");
    return <div className="space-y-4">
      <TowerAdminSettings initial={data.config} onSaved={load}/>
      <TowerNarrativeAdmin initial={data.scenes}/>
      <section className={card}>
        <h2 className="text-sm font-black uppercase tracking-widest text-[#FFCB05]">Cooldown de entrada</h2>
        <p className="mt-2 text-sm text-slate-300">Próxima entrada disponível em <strong className="text-white">{when}</strong>.</p>
        <p className="mt-1 text-[11px] text-slate-500">O cooldown ({data.config.entryCooldownMinutes} min) é configurável no admin. Em desenvolvimento, defina 0 para testar sem espera.</p>
      </section>
    </div>;
  }

  const selectedRole = data.roles.find((r) => r.key === role) ?? null;
  const filteredMascots=data.mascots.filter(m=>(!search||m.name.toLowerCase().includes(search.toLowerCase()))&&(typeFilter==="ALL"||getPokemonTypes(m.pokemonId).includes(typeFilter)));
  const mascotPages=Math.max(1,Math.ceil(filteredMascots.length/16)); const visibleMascots=filteredMascots.slice((mascotPage-1)*16,mascotPage*16);
  const toggle = (id: string) =>
    setPicks((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 2 ? cur : [...cur, id]);

  const create = () => {
    if (!role) { toast.error("Escolha uma Função de Expedição."); return; }
    if (picks.length !== 2) { toast.error("Selecione exatamente 2 mascotes."); return; }
    start(async () => {
      const res = await createTowerRunAction({ pace, expeditionRole: role, mascotIds: picks, stanceByMascot: stances });
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Expedição criada!");
      setPicks([]);
      router.refresh(); load();
    });
  };

  return (
    <div className="space-y-6">
      <TowerIntro forceKey={introKey}/>
      <TowerNarrative scene={data.lobbyScene} />
      <button type="button" onClick={()=>setIntroKey(Date.now())} className="rounded-xl border border-purple-400/30 bg-purple-400/10 px-4 py-2 text-xs font-black text-purple-200">▶ Testar introdução do evento</button>
      <TowerAdminSettings initial={data.config} onSaved={load}/>
      <TowerKnowledge entries={data.knowledge} failures={data.failures} />
      <section className={card}>
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">Preparação entre runs</p>
        <div className="my-4 flex items-center gap-4 rounded-2xl border border-amber-300/25 bg-amber-950/15 p-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/events/torre-dos-rebeldes/leaders/06_meowth_rebelde.png" alt="Recepcionista" className="h-24 w-24 shrink-0 object-contain"/><div className="rounded-2xl border border-amber-200/20 bg-black/35 p-3 text-xs leading-relaxed text-amber-50"><b className="block text-amber-300">Recepcionista da Torre</b>Isto não é debug. São estudos reais entre runs: cada contribuição diária soma ao esforço da Liga e, ao chegar a 5, libera uma contramedida para todas as expedições futuras.</div></div>
        <h2 className="mt-1 text-lg font-black text-white">O conhecimento da comunidade enfraquece a Torre</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">No começo, mecanismos e objetos não explicam o que fazem. Acertos entram no Arquivo compartilhado. Fora da run, cada jogador pode estudar uma frente por dia; com 5 contribuições, a contramedida passa a valer nas próximas expedições.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">{([
          ["WARD", "Reforçar proteções", "Absorve os dois primeiros pontos de Pressão."] as const,
          ["INSIGHT", "Decifrar mecanismos", "Prepara pistas mais claras para enigmas descobertos."] as const,
          ["MAP", "Mapear corredores", "Amplia o conhecimento das rotas futuras."] as const,
        ]).map(([key, title, text]) => {
          const value = data.communityProgress.find((entry) => entry.metricKey === key)?.value ?? 0;
          return <article key={key} className="rounded-xl border border-cyan-400/20 bg-cyan-950/10 p-3"><div className="flex items-center justify-between gap-2"><b className="text-sm text-cyan-100">{title}</b><span className="text-xs font-black text-[#FFCB05]">{Math.min(5, value)}/5</span></div><p className="mt-1 min-h-10 text-[11px] text-slate-400">{text}</p><button type="button" disabled={pending || value >= 5} onClick={() => start(async () => { const res = await contributeTowerPreparationAction(key); if ("error" in res) toast.error(res.error); else { toast.success("Estudo registrado no Arquivo comunitário."); load(); } })} className="mt-3 w-full rounded-lg border border-cyan-300/30 py-2 text-[10px] font-black text-cyan-200 disabled:opacity-40">{value >= 5 ? "CONTRAMEDIDA LIBERADA" : "CONTRIBUIR HOJE"}</button></article>;
        })}</div>
        {data.communityCodex.length > 0 && <div className="mt-4 rounded-xl border border-purple-400/20 bg-purple-950/15 p-3"><b className="text-xs uppercase tracking-wider text-purple-200">Descobertas compartilhadas</b>{data.communityCodex.slice(0, 6).map((entry) => <p key={entry.id} className="mt-2 text-xs text-slate-300">✦ {String((entry.data as { text?: string } | null)?.text ?? entry.subjectKey)}</p>)}</div>}
      </section>
      <TowerNarrativeAdmin initial={data.scenes} />
      {data.controlledMascots.length > 0 && <section className={card}><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-widest text-red-300">Sob controle da Torre</p><h2 className="text-lg font-black text-white">Mascotes aguardando resgate</h2></div><span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-200">{data.controlledMascots.length}</span></div><p className="mt-2 text-xs text-slate-400">Eles podem reaparecer como inimigos sob Psicose até uma Sala Anti-Psicose libertá-los.</p><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.controlledMascots.map((mascot) => mascot && <article key={mascot.id} className="flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-950/15 p-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={getStaticSpriteUrl(mascot.pokemonId)} alt="" className="h-14 w-14 object-contain [image-rendering:pixelated]"/><div><b className="text-sm text-red-100">{mascot.name} · Nv.{mascot.level}</b><p className="text-[10px] text-slate-400">Dono: {mascot.owner} · andar {mascot.floor}</p></div></article>)}</div></section>}

      <section className={card}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Árvore de talentos</p><h2 className="text-lg font-black text-white">Legado das runs</h2></div><span className="rounded-full bg-[#FFCB05] px-3 py-1 text-xs font-black text-slate-950">{data.talents.points} ponto(s)</span></div><p className="mt-2 text-xs text-slate-400">Cada chefe derrotado concede um ponto. Os benefícios são permanentes e usados nas próximas runs.</p><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{([['PRESSURE','Controle da Pressão','+1 proteção inicial contra Pressão.'],['COMBAT','Treino de combate','+2% de atributos por nível.'],['BOSS','Caçador de chefes','+3% contra chefes por nível.'],['LUCK','Destino dobrado','Melhora futuras rerrolagens de sorte.'],['RESCUE','Equipe de resgate','Melhora salas Anti-Psicose.']] as const).map(([key,title,text])=><article key={key} className="rounded-xl border border-emerald-400/20 bg-emerald-950/10 p-3"><b className="text-xs text-emerald-100">{title}</b><p className="mt-1 min-h-10 text-[10px] text-slate-400">{text}</p><button disabled={pending||data.talents.points<=0||Number(data.talents.ranks[key]??0)>=5} onClick={()=>start(async()=>{const res=await spendTowerTalentAction(key);if('error'in res)toast.error(res.error);else{toast.success('Talento aprendido.');load()}})} className="mt-2 w-full rounded-lg border border-emerald-300/25 py-1.5 text-[10px] font-black text-emerald-200 disabled:opacity-35">Nv.{Number(data.talents.ranks[key]??0)} · Aprender</button></article>)}</div></section>

      {data.rooms.length>0&&<section className={card}><h2 className="text-sm font-black uppercase tracking-widest text-[#FFCB05]">Salas aguardando jogadores</h2><p className="mt-1 text-[11px] text-slate-500">Prepare seus dois mascotes abaixo e entre em uma sala de até três treinadores.</p><div className="mt-3 grid gap-3 md:grid-cols-2">{data.rooms.map(room=><article key={room.id} className="rounded-xl border border-purple-400/20 bg-purple-950/15 p-3"><div className="flex justify-between"><b className="text-white">Sala {room.code}</b><span className="text-xs text-purple-300">{room.members.length}/3</span></div><p className="mt-1 text-[10px] text-slate-400">Host: {room.host} · {room.pace==="ONLINE"?"120s":"4h"}</p><div className="mt-2 flex flex-wrap gap-1">{room.members.map(m=><span key={m.userId} className="rounded-full bg-slate-800 px-2 py-1 text-[9px] text-slate-300">{m.name}{m.ready?" ✓":""}</span>)}</div><button disabled={pending||picks.length!==2||!role} onClick={()=>start(async()=>{if(!role)return;const res=await joinTowerRoomAction({runId:room.id,expeditionRole:role,mascotIds:picks,stanceByMascot:stances});if("error" in res)toast.error(res.error);else{toast.success("Você entrou na sala.");load()}})} className="mt-3 w-full rounded-lg border border-purple-400/40 bg-purple-400/10 py-2 text-xs font-black text-purple-200 disabled:opacity-40">Entrar nesta sala</button></article>)}</div></section>}

      {/* Ritmo */}
      <section className={card}>
        <h2 className="text-sm font-black uppercase tracking-widest text-[#FFCB05]">Ritmo</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {([["ONLINE", "Online · 120s por turno"], ["SLOW", "Lento · 4h por turno"]] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setPace(value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${pace === value ? "border-[#FFCB05] bg-[#FFCB05]/15 text-[#FFCB05]" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Função de Expedição */}
      <section className={card}>
        <h2 className="text-sm font-black uppercase tracking-widest text-[#FFCB05]">Função de Expedição</h2>
        <p className="mt-1 text-[11px] text-slate-500">A Função limita as posturas que seus mascotes podem usar dentro da Torre.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.roles.map((r) => (
            <button key={r.key} type="button" onClick={() => setRole(r.key)}
              className={`rounded-xl border p-3 text-left transition-colors ${role === r.key ? "border-[#FFCB05]/60 bg-[#FFCB05]/10" : "border-slate-800 bg-slate-900/40 hover:border-slate-600"}`}>
              <p className="text-xs font-black text-white">{r.label}</p>
              <p className="mt-1 text-[10px] leading-snug text-slate-400">{r.benefit}</p>
              <p className="mt-1 text-[9px] text-cyan-300">{r.stances.map((s) => getCombatRoleLabel(s)).join(" · ")}</p>
            </button>
          ))}
        </div>
        {selectedRole && (
          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-900/50 p-2 text-[11px] text-slate-400">
            <strong className="text-slate-200">{selectedRole.label}:</strong> {selectedRole.exploration}
          </p>
        )}
      </section>

      {/* Mascotes */}
      <section className={card}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-widest text-[#FFCB05]">Seus 2 mascotes</h2>
          <span className={`text-xs font-bold ${picks.length === 2 ? "text-[#FFCB05]" : "text-slate-500"}`}>{picks.length}/2</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Eles entram em Survivor e carregam o estado entre combates dentro da Torre.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_220px]"><input value={search} onChange={e=>{setSearch(e.target.value);setMascotPage(1)}} placeholder="Buscar mascote pelo nome..." className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"/><select value={typeFilter} onChange={e=>{setTypeFilter(e.target.value);setMascotPage(1)}} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"><option value="ALL">Todos os tipos</option>{['Normal','Fogo','Água','Elétrico','Planta','Gelo','Lutador','Veneno','Terra','Voador','Psíquico','Inseto','Pedra','Fantasma','Dragão','Sombrio','Aço','Fada'].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
        {data.mascots.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">Nenhum mascote livre disponível. Libere mascotes (fora de arena/expedição/bazar) para entrar.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {visibleMascots.map((m: Mascot) => {
              const checked = picks.includes(m.id);
              return (
                <button key={m.id} type="button" onClick={() => toggle(m.id)}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-left ${checked ? "border-[#FFCB05]/50 bg-[#FFCB05]/10" : "border-slate-800 bg-slate-900/50 hover:border-slate-600"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getStaticSpriteUrl(m.pokemonId)} alt="" className="h-11 w-11 shrink-0 object-contain [image-rendering:pixelated]" />
                  <span className="min-w-0">
                    <strong className="block truncate text-[11px] text-white">{m.name}</strong>
                    <small className="text-[10px] text-slate-500">Nv.{m.level}</small>
                    {checked&&selectedRole&&<select value={stances[m.id]??selectedRole.stances[0]} onClick={e=>e.stopPropagation()} onChange={e=>setStances(cur=>({...cur,[m.id]:e.target.value}))} className="mt-1 w-full rounded border border-cyan-400/30 bg-slate-950 p-1 text-[9px] text-cyan-200">{selectedRole.stances.map(s=><option key={s} value={s}>{getCombatRoleLabel(s)}</option>)}</select>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {filteredMascots.length>16&&<div className="mt-3 flex items-center justify-center gap-3"><button disabled={mascotPage<=1} onClick={()=>setMascotPage(p=>p-1)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-30">Anterior</button><span className="text-xs text-slate-500">Página {mascotPage}/{mascotPages}</span><button disabled={mascotPage>=mascotPages} onClick={()=>setMascotPage(p=>p+1)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-30">Próxima</button></div>}
      </section>

      <button type="button" onClick={create} disabled={pending || picks.length !== 2 || !role}
        className="w-full rounded-xl bg-[#FFCB05] py-3 text-sm font-black text-[#1A1A2E] transition hover:bg-[#FFD700] disabled:opacity-40">
        {pending ? "Criando…" : "🗼 Criar sala de expedição"}
      </button>
    </div>
  );
}
