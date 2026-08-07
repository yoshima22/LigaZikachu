"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Plus, Save, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { ExpeditionDuration, ExpeditionMode } from "@/lib/mascot-data";
import type { TimedGameBonusEvent } from "@/lib/timed-game-bonuses";
import { deleteTimedGameBonusEvent, saveTimedGameBonusEvent } from "../timed-game-bonus-actions";

const MODES: Array<{ value: ExpeditionMode; label: string }> = [
  { value: "STANDARD", label: "Padrão" },
  { value: "TRAINING", label: "Treinamento" },
  { value: "ITEMS", label: "Itens" },
];
const DURATIONS: Array<{ value: ExpeditionDuration; label: string }> = [
  { value: "30min", label: "30 min" }, { value: "1h", label: "1 hora" },
  { value: "3h", label: "3 horas" }, { value: "6h", label: "6 horas" },
];

function localInputValue(iso: string) {
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function newDraft(): TimedGameBonusEvent {
  const startsAt = new Date();
  startsAt.setMinutes(Math.ceil(startsAt.getMinutes() / 15) * 15, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 48 * 60 * 60_000);
  return {
    id: crypto.randomUUID(), name: "", enabled: true,
    startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
    expeditionExpBonusPct: 0, expeditionModes: [], expeditionDurations: [],
    eggRarityBonusPct: 0, arenaDailyZcLimit: null, createdAt: new Date().toISOString(),
  };
}

function statusOf(event: TimedGameBonusEvent) {
  const now = Date.now();
  if (!event.enabled) return { label: "Desativado", cls: "text-slate-400 border-slate-600" };
  if (new Date(event.endsAt).getTime() <= now) return { label: "Encerrado", cls: "text-red-300 border-red-500/30" };
  if (new Date(event.startsAt).getTime() > now) return { label: "Agendado", cls: "text-blue-300 border-blue-500/30" };
  return { label: "Ativo agora", cls: "text-green-300 border-green-500/30" };
}

export function TimedGameBonusPanel({ initialEvents }: { initialEvents: TimedGameBonusEvent[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [editing, setEditing] = useState<TimedGameBonusEvent | null>(null);
  const [pending, startTransition] = useTransition();

  const update = <K extends keyof TimedGameBonusEvent>(key: K, value: TimedGameBonusEvent[K]) => {
    setEditing(current => current ? { ...current, [key]: value } : current);
  };
  const toggleList = <T extends string>(values: T[], value: T) =>
    values.includes(value) ? values.filter(item => item !== value) : [...values, value];

  const save = () => {
    if (!editing) return;
    startTransition(async () => {
      const result = await saveTimedGameBonusEvent(editing);
      if (!result.ok || !result.event) {
        toast.error(result.error ?? "Erro ao salvar evento.");
        return;
      }
      setEvents(current => {
        const exists = current.some(event => event.id === result.event!.id);
        const next = exists ? current.map(event => event.id === result.event!.id ? result.event! : event) : [...current, result.event!];
        return next.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
      });
      setEditing(null);
      toast.success("Evento temporário salvo.");
    });
  };

  const remove = (event: TimedGameBonusEvent) => {
    if (!confirm(`Excluir o evento "${event.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteTimedGameBonusEvent(event.id);
      if (!result.ok) {
        toast.error(result.error ?? "Erro ao excluir evento.");
        return;
      }
      setEvents(current => current.filter(item => item.id !== event.id));
      if (editing?.id === event.id) setEditing(null);
      toast.success("Evento excluído.");
    });
  };

  return (
    <Card className="border-cyan-500/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><CalendarClock size={18} className="text-cyan-300" /> Eventos e bônus temporários</CardTitle>
          <p className="mt-1 text-xs text-slate-500">Agende finais de semana comemorativos. Fora do período ativo, os valores normais permanecem inalterados.</p>
        </div>
        <Button onClick={() => setEditing(newDraft())} className="h-9 gap-2 bg-cyan-600 text-xs text-white hover:bg-cyan-500"><Plus size={13} /> Novo evento</Button>
      </div>

      {editing && (
        <div className="mt-4 space-y-4 rounded-xl border border-cyan-500/25 bg-cyan-950/10 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 md:col-span-1"><span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Nome do evento</span><input value={editing.name} onChange={event => update("name", event.target.value)} placeholder="Ex: Fim de semana Johto" className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm" /></label>
            <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Início</span><input type="datetime-local" value={localInputValue(editing.startsAt)} onChange={event => { if (event.target.value) update("startsAt", new Date(event.target.value).toISOString()); }} className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm" /></label>
            <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Fim</span><input type="datetime-local" value={localInputValue(editing.endsAt)} onChange={event => { if (event.target.value) update("endsAt", new Date(event.target.value).toISOString()); }} className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm" /></label>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-purple-500/20 bg-purple-950/10 p-3 space-y-3">
              <p className="text-xs font-semibold text-purple-300">EXP em expedições</p>
              <label className="flex items-center gap-2 text-xs text-slate-300"><input type="number" min={0} max={500} value={editing.expeditionExpBonusPct} onChange={event => update("expeditionExpBonusPct", Number(event.target.value))} className="w-20 rounded border border-border bg-slate-900 px-2 py-1.5" /> % de EXP adicional</label>
              <div><p className="mb-1 text-[10px] text-slate-500">Tipos (nenhum = todos)</p><div className="flex flex-wrap gap-1">{MODES.map(mode => <button type="button" key={mode.value} onClick={() => update("expeditionModes", toggleList(editing.expeditionModes, mode.value))} className={`rounded-full border px-2 py-1 text-[10px] ${editing.expeditionModes.includes(mode.value) ? "border-purple-400 bg-purple-500/20 text-purple-200" : "border-border text-slate-500"}`}>{mode.label}</button>)}</div></div>
              <div><p className="mb-1 text-[10px] text-slate-500">Durações (nenhuma = todas)</p><div className="flex flex-wrap gap-1">{DURATIONS.map(duration => <button type="button" key={duration.value} onClick={() => update("expeditionDurations", toggleList(editing.expeditionDurations, duration.value))} className={`rounded-full border px-2 py-1 text-[10px] ${editing.expeditionDurations.includes(duration.value) ? "border-purple-400 bg-purple-500/20 text-purple-200" : "border-border text-slate-500"}`}>{duration.label}</button>)}</div></div>
            </section>
            <section className="rounded-xl border border-yellow-500/20 bg-yellow-950/10 p-3 space-y-3"><p className="text-xs font-semibold text-yellow-300">Ovos</p><label className="flex items-center gap-2 text-xs text-slate-300"><input type="number" min={0} max={20} step={0.5} value={editing.eggRarityBonusPct} onChange={event => update("eggRarityBonusPct", Number(event.target.value))} className="w-20 rounded border border-border bg-slate-900 px-2 py-1.5" /> pontos percentuais</label><p className="text-[10px] text-slate-500">Soma à melhoria de raridade já gravada no ovo, com teto total seguro de 20 pontos.</p></section>
            <section className="rounded-xl border border-green-500/20 bg-green-950/10 p-3 space-y-3"><p className="text-xs font-semibold text-green-300">Arena Z</p><label className="block text-xs text-slate-300">Novo limite diário de ZC<input type="number" min={2000} max={1000000} value={editing.arenaDailyZcLimit ?? ""} placeholder="Sem alteração" onChange={event => update("arenaDailyZcLimit", event.target.value ? Number(event.target.value) : null)} className="mt-2 w-full rounded border border-border bg-slate-900 px-2 py-1.5" /></label><p className="text-[10px] text-slate-500">Em eventos sobrepostos prevalece o maior limite ativo.</p></section>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={editing.enabled} onChange={event => update("enabled", event.target.checked)} /> Evento habilitado</label><div className="flex gap-2"><Button variant="ghost" onClick={() => setEditing(null)} className="h-8 text-xs">Cancelar</Button><Button onClick={save} disabled={pending || !editing.name.trim()} className="h-8 gap-2 bg-cyan-600 text-xs text-white hover:bg-cyan-500"><Save size={12} /> {pending ? "Salvando..." : "Salvar evento"}</Button></div></div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {events.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-slate-600">Nenhum evento temporário cadastrado.</p>}
        {events.map(event => { const status = statusOf(event); return <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-slate-950/40 p-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-200">{event.name}</p><span className={`rounded-full border px-2 py-0.5 text-[9px] ${status.cls}`}>{status.label}</span></div><p className="mt-1 text-[10px] text-slate-500">{new Date(event.startsAt).toLocaleString("pt-BR")} → {new Date(event.endsAt).toLocaleString("pt-BR")}</p><div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-400">{event.expeditionExpBonusPct > 0 && <span>+{event.expeditionExpBonusPct}% EXP expedições</span>}{event.eggRarityBonusPct > 0 && <span>+{event.eggRarityBonusPct} pontos percentuais em ovos</span>}{event.arenaDailyZcLimit && <span>Arena: {event.arenaDailyZcLimit.toLocaleString("pt-BR")} ZC/dia</span>}</div></div><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setEditing(event)} className="h-8 gap-1 text-xs text-cyan-300"><Zap size={11} /> Editar</Button><Button variant="ghost" size="sm" onClick={() => remove(event)} disabled={pending} className="h-8 text-red-400 hover:bg-red-500/10"><Trash2 size={12} /></Button></div></div>; })}
      </div>
    </Card>
  );
}
