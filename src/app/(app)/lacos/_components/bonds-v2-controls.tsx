"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { BookOpen, ChevronLeft, ChevronRight, HelpCircle, ImagePlus, Search, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { saveRefugeBackgroundV2Action, setMascotRoutineV2Action, simulateRefugeV2Action, updateActiveBondV2Action } from "../actions";
import { REFUGE_LOCATIONS, type RefugeLocation } from "@/lib/mascot-bonds-v2";
import { ImageUpload } from "@/components/ui/image-upload";

export function RoutineSelect({ mascotId, value }: { mascotId: string; value: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={value}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value as RefugeLocation | "NONE";
        startTransition(async () => {
          const result = await setMascotRoutineV2Action(mascotId, next);
          if (result.error) toast.error(result.error);
          else toast.success(next === "NONE" ? "Rotina removida." : "Rotina atualizada.");
        });
      }}
      className="w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-fuchsia-400/50 disabled:opacity-50"
    >
      <option value="NONE">Sem rotina</option>
      <option value="GARDEN">🌱 Horta</option>
      <option value="TRAINING">🥊 Campo de Treino</option>
      <option value="REST">🌙 Descanso</option>
      <option value="YARD">✨ Pátio</option>
    </select>
  );
}

export function SimulateRefugeButton({ location }: { location: RefugeLocation }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const result = await simulateRefugeV2Action(location);
        if (result.error) toast.error(result.error);
        else toast.success(result.message ?? "Momento processado.");
      })}
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
    >
      {pending ? "Processando..." : "Simular momento"}
    </button>
  );
}

export function BondV2Buttons({ relationId, active, protectedBond }: { relationId: string; active: boolean; protectedBond: boolean }) {
  const [pending, startTransition] = useTransition();
  function run(operation: "TOGGLE_ACTIVE" | "TOGGLE_PROTECTED") {
    startTransition(async () => {
      const result = await updateActiveBondV2Action(relationId, operation);
      if (result.error) toast.error(result.error);
      else toast.success("Laço atualizado.");
    });
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      <button disabled={pending} onClick={() => run("TOGGLE_ACTIVE")} className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/5 disabled:opacity-50">
        {active ? "Adormecer" : "Reativar"}
      </button>
      <button disabled={pending} onClick={() => run("TOGGLE_PROTECTED")} className={`rounded-md border px-2 py-1 text-[10px] disabled:opacity-50 ${protectedBond ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-white/10 text-slate-300 hover:bg-white/5"}`}>
        {protectedBond ? "★ Protegido" : "☆ Proteger"}
      </button>
    </div>
  );
}

type SceneMascot = { id: string; name: string; sprite: string; level: number; personality: string; owner: string; own: boolean; location: string | null };
type SceneStory = { id: string; title: string; description: string; conflict: boolean; when: string };

const POSITIONS = [
  "left-[8%] bottom-[12%]", "left-[27%] bottom-[25%]", "left-[48%] bottom-[10%]", "left-[68%] bottom-[28%]",
  "left-[82%] bottom-[12%]", "left-[18%] bottom-[48%]", "left-[58%] bottom-[50%]", "left-[78%] bottom-[52%]",
];

export function RefugeLocationScene({ location, occupants, ownMascots, backgroundUrl, stories }: { location: RefugeLocation; occupants: SceneMascot[]; ownMascots: SceneMascot[]; backgroundUrl: string; stories: SceneStory[] }) {
  const definition = REFUGE_LOCATIONS[location];
  const [query, setQuery] = useState("");
  const [image, setImage] = useState(backgroundUrl);
  const [pending, startTransition] = useTransition();
  const available = useMemo(() => ownMascots.filter((mascot) => mascot.name.toLowerCase().includes(query.toLowerCase()) || mascot.personality.toLowerCase().includes(query.toLowerCase())), [ownMascots, query]);

  function allocate(mascotId: string) {
    startTransition(async () => {
      const result = await setMascotRoutineV2Action(mascotId, location);
      if (result.error) toast.error(result.error); else toast.success(`${definition.label} virou a nova rotina do mascote.`);
    });
  }

  return <article className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/20">
    <div className="relative min-h-[330px] overflow-hidden bg-slate-900">
      {backgroundUrl ? <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-[1.02]" style={{ backgroundImage: `url(${backgroundUrl})` }} /> : <div className={`absolute inset-0 ${location === "GARDEN" ? "bg-[radial-gradient(circle_at_30%_30%,#39734b,#10251c_55%,#07120d)]" : location === "TRAINING" ? "bg-[radial-gradient(circle_at_70%_20%,#81441d,#29180e_55%,#100a08)]" : location === "REST" ? "bg-[radial-gradient(circle_at_50%_20%,#24467a,#121d3c_55%,#080c1c)]" : "bg-[radial-gradient(circle_at_50%_25%,#643a87,#251333_55%,#0e0815)]"}`} />}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-black/30" />
      <div className="absolute left-5 top-5 z-10"><div className="flex items-center gap-2"><span className="text-3xl drop-shadow-lg">{definition.icon}</span><div><h3 className="text-xl font-black text-white drop-shadow">{definition.label}</h3><p className="text-xs text-white/65">{definition.purpose}</p></div></div></div>
      <div className="absolute right-5 top-5 z-10 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur"><Users size={12} className="mr-1 inline" /> {occupants.length} habitando agora</div>
      <div className="absolute left-5 top-20 z-10 max-w-[75%] rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[10px] leading-4 text-white/75 backdrop-blur-sm"><strong className="text-white">Impacto:</strong> {definition.impact}</div>
      {occupants.slice(0, 8).map((mascot, index) => <div key={mascot.id} className={`group absolute z-10 -translate-x-1/2 ${POSITIONS[index]} transition hover:z-20 hover:scale-110`}><div className={`rounded-2xl border p-1 backdrop-blur-sm ${mascot.own ? "border-cyan-300/60 bg-cyan-950/50 shadow-lg shadow-cyan-400/20" : "border-white/20 bg-black/35"}`}><img src={mascot.sprite} alt={mascot.name} className="h-16 w-16 object-contain drop-shadow-[0_5px_7px_rgba(0,0,0,.8)] sm:h-20 sm:w-20" /></div><div className="pointer-events-none absolute left-1/2 top-full mt-1 hidden min-w-max -translate-x-1/2 rounded-lg border border-white/10 bg-slate-950/95 px-2 py-1 text-center group-hover:block"><p className="text-[10px] font-bold text-white">{mascot.name} · Nv.{mascot.level}</p><p className="text-[9px] text-slate-400">{mascot.owner} · {mascot.personality}</p></div></div>)}
      {occupants.length === 0 && <div className="absolute inset-x-5 bottom-20 rounded-2xl border border-dashed border-white/15 bg-black/25 p-5 text-center text-xs text-white/55 backdrop-blur-sm">O local está silencioso. Envie um mascote para começar a habitá-lo.</div>}
      <div className="absolute inset-x-4 bottom-4 z-20 flex items-center justify-between gap-3"><p className="rounded-full bg-black/45 px-3 py-1.5 text-[10px] text-white/70 backdrop-blur">Azul: seu mascote · passe o mouse para conhecer os visitantes</p><SimulateRefugeButton location={location} /></div>
    </div>
    <div className="grid gap-4 border-t border-white/10 p-4 lg:grid-cols-[1fr_220px]">
      <div><div className="relative"><Search size={14} className="absolute left-3 top-2.5 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por nome ou personalidade..." className="w-full rounded-xl border border-white/10 bg-slate-900 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-cyan-300/40" /></div><div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">{available.map((mascot) => <button key={mascot.id} disabled={pending || mascot.location === location} onClick={() => allocate(mascot.id)} className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] transition ${mascot.location === location ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200" : "border-white/10 text-slate-300 hover:border-white/25 hover:bg-white/5"}`}><img src={mascot.sprite} alt="" className="h-5 w-5 object-contain" />{mascot.name}{mascot.location === location ? " · aqui" : " · enviar"}</button>)}</div></div>
      <details className="group rounded-xl border border-white/10 bg-white/[.025] p-3"><summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-bold text-slate-300"><ImagePlus size={14} /> Cenário do local</summary><div className="mt-3"><ImageUpload value={image} onChange={setImage} label="Background personalizado" hint="Recomendado: 1600×900, JPG ou WEBP." compress maxWidth={1800} maxHeight={1000} /><button disabled={pending || image === backgroundUrl} onClick={() => startTransition(async () => { const result = await saveRefugeBackgroundV2Action(location, image); if (result.error) toast.error(result.error); else toast.success("Cenário salvo."); })} className="mt-2 w-full rounded-lg bg-fuchsia-400 px-3 py-2 text-[10px] font-black text-slate-950 disabled:opacity-40">Salvar cenário</button></div></details>
    </div>
    <div className="border-t border-white/10 bg-black/20 p-4"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-300">O que está acontecendo aqui</p><span className="text-[9px] text-slate-600">ambiência recente</span></div>{stories.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-slate-600">Ainda não há histórias registradas neste local.</p> : <div className="grid gap-2 sm:grid-cols-3">{stories.map((story) => <div key={story.id} className={`rounded-xl border p-3 ${story.conflict ? "border-rose-400/25 bg-rose-400/[.06]" : "border-emerald-400/15 bg-emerald-400/[.04]"}`}><p className={`text-[9px] font-black uppercase tracking-wider ${story.conflict ? "text-rose-300" : "text-emerald-300"}`}>{story.conflict ? "⚡ Conflito percebido" : "✦ Momento social"} · {story.when}</p><p className="mt-1 text-xs font-bold text-white">{story.title}</p><p className="mt-1 line-clamp-3 text-[10px] leading-4 text-slate-400">{story.description}</p></div>)}</div>}</div>
  </article>;
}

export function BondsTutorial() {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-300/15"><BookOpen size={15} /> Como funciona o novo Laços?</button>{open && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-3 backdrop-blur-sm" onClick={() => setOpen(false)}><div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-fuchsia-300/25 bg-[#080d1c] shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#080d1c]/95 p-5 backdrop-blur"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-fuchsia-300">Guia do Refúgio</p><h2 className="text-xl font-black text-white">A vida social dos seus mascotes</h2></div><button onClick={() => setOpen(false)} className="rounded-full border border-white/10 p-2 text-slate-400 hover:text-white"><X size={17} /></button></div><div className="grid gap-4 p-5 md:grid-cols-2">{[
    ["1. Escolha uma rotina", "Envie mascotes para Horta, Treino, Descanso ou Pátio. Eles retornam à rotina quando ficam livres; não é preciso recolocá-los todo dia."],
    ["2. Os locais são públicos", "Mascotes de jogadores diferentes convivem no mesmo espaço. Personalidade, local e histórico determinam as interações possíveis."],
    ["3. Amizade coopera", "Colegas, Amigos e Super Amigos ajudam em treino, expedição, recuperação e acontecimentos de suporte. Só o melhor bônus elegível conta."],
    ["4. Rivalidade motiva", "Rivais, Inimigos e Nêmesis criam treino, revanche e efeitos contra aquela relação específica. Rivalidade não é uma punição nem precisa virar amizade."],
    ["5. Ativo x Adormecido", "Laço Ativo participa de histórias e efeitos. Adormecido permanece no histórico, mas não interfere no jogo até ser reativado. Cada mascote terá até 10 ativos."],
    ["6. O que significa Proteger", "Proteção impede que um vínculo importante seja escolhido automaticamente para adormecer quando surgir um 11º laço. Ela não aumenta score nem concede bônus."],
    ["7. Memórias explicam o porquê", "Vitórias, derrotas, ajuda e convivência viram memórias. O diário mostra como a relação chegou ao estado atual."],
    ["8. Você mantém o controle", "Acontecimentos comuns se resolvem sozinhos. Só momentos importantes pedem decisão; se você não entrar, o mascote escolhe sem gastar seus recursos."],
  ].map(([title, text]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><h3 className="font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></div>)}</div><div className="border-t border-white/10 p-5"><div className="rounded-2xl bg-gradient-to-r from-emerald-400/10 to-rose-400/10 p-4 text-sm text-slate-300"><strong className="text-emerald-300">Amizade</strong> melhora cooperação e suporte. <strong className="text-rose-300">Rivalidade</strong> melhora motivação e confrontos específicos. Nenhuma das duas é a resposta universalmente correta.</div></div></div></div>}</>;
}

type BondItem = { id: string; a: string; b: string; owner: string; spriteA: string; spriteB: string; score: number; tier: string; effect: string; interactions: number; active: boolean; protectedBond: boolean };

export function BondDirectoryV2({ relations }: { relations: BondItem[] }) {
  const [mode, setMode] = useState<"ACTIVE" | "DORMANT">("ACTIVE");
  const [page, setPage] = useState(1);
  const perPage = 6;
  const filtered = relations.filter((relation) => relation.active === (mode === "ACTIVE"));
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const visible = filtered.slice((Math.min(page, pages) - 1) * perPage, Math.min(page, pages) * perPage);
  return <div><div className="mb-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3"><div className="grid gap-2 sm:grid-cols-3"><InfoPill icon={<Sparkles size={14} />} title="Ativo" text="Gera histórias e efeitos." /><InfoPill icon={<ShieldCheck size={14} />} title="Protegido" text="Não adormece automaticamente." /><InfoPill icon={<HelpCircle size={14} />} title="Adormecido" text="Só histórico; nenhum efeito." /></div></div><div className="mb-3 flex rounded-xl border border-white/10 bg-slate-950 p-1">{(["ACTIVE", "DORMANT"] as const).map((item) => <button key={item} onClick={() => { setMode(item); setPage(1); }} className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${mode === item ? "bg-fuchsia-400 text-slate-950" : "text-slate-400"}`}>{item === "ACTIVE" ? `Ativos (${relations.filter((r) => r.active).length})` : `Adormecidos (${relations.filter((r) => !r.active).length})`}</button>)}</div><div className="space-y-2">{visible.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">Nenhum laço nesta categoria.</div> : visible.map((relation) => <article key={relation.id} className={`rounded-2xl border p-3 ${relation.score < -14 ? "border-rose-400/20 bg-rose-400/[.035]" : relation.score > 14 ? "border-emerald-400/20 bg-emerald-400/[.035]" : "border-white/10 bg-white/[.025]"}`}><div className="flex gap-3"><div className="flex -space-x-2"><img src={relation.spriteA} alt="" className="h-10 w-10 rounded-full border border-slate-700 bg-slate-900 object-contain" /><img src={relation.spriteB} alt="" className="h-10 w-10 rounded-full border border-slate-700 bg-slate-900 object-contain" /></div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-white">{relation.a} → {relation.b}</p><p className="text-[10px] text-slate-500">{relation.owner} · {relation.interactions} interações</p></div><div className="text-right"><p className="font-bold text-white">{relation.tier}</p><p className="text-xs text-slate-500">{relation.score > 0 ? "+" : ""}{relation.score}</p></div></div><div className="my-2 rounded-lg border border-white/5 bg-black/20 p-2"><p className="text-[9px] font-bold uppercase tracking-wider text-fuchsia-300">Impacto atual</p><p className="mt-1 text-xs leading-5 text-slate-400">{relation.effect}</p></div><BondV2Buttons relationId={relation.id} active={relation.active} protectedBond={relation.protectedBond} /></article>)}</div>{pages > 1 && <div className="mt-3 flex items-center justify-between text-xs text-slate-400"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-white/10 p-2 disabled:opacity-30"><ChevronLeft size={14} /></button><span>Página {Math.min(page, pages)} de {pages}</span><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-white/10 p-2 disabled:opacity-30"><ChevronRight size={14} /></button></div>}</div>;
}

function InfoPill({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex gap-2 rounded-xl bg-white/[.035] p-2 text-slate-400"><span className="mt-0.5 text-fuchsia-300">{icon}</span><div><p className="text-[10px] font-bold text-white">{title}</p><p className="text-[9px]">{text}</p></div></div>; }
