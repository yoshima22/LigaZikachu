"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getStaticSpriteUrl } from "@/lib/mascot-data";
import { getCombatRoleLabel } from "@/lib/combat-roles";
import { getTowerLobbyDataAction, createTowerRunAction } from "../actions";
import { TowerRunPanel } from "./tower-run-panel";
import { TowerNarrative, TowerNarrativeAdmin } from "./tower-narrative";

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
    return <TowerRunPanel runId={data.activeRun.id} onLeft={() => { router.refresh(); load(); }} />;
  }

  // Cooldown de entrada.
  if (data.nextEntryAt) {
    const when = new Date(data.nextEntryAt).toLocaleString("pt-BR");
    return (
      <section className={card}>
        <h2 className="text-sm font-black uppercase tracking-widest text-[#FFCB05]">Cooldown de entrada</h2>
        <p className="mt-2 text-sm text-slate-300">Próxima entrada disponível em <strong className="text-white">{when}</strong>.</p>
        <p className="mt-1 text-[11px] text-slate-500">O cooldown ({data.config.entryCooldownMinutes} min) é configurável no admin. Em desenvolvimento, defina 0 para testar sem espera.</p>
      </section>
    );
  }

  const selectedRole = data.roles.find((r) => r.key === role) ?? null;
  const toggle = (id: string) =>
    setPicks((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 2 ? cur : [...cur, id]);

  const create = () => {
    if (!role) { toast.error("Escolha uma Função de Expedição."); return; }
    if (picks.length !== 2) { toast.error("Selecione exatamente 2 mascotes."); return; }
    start(async () => {
      const res = await createTowerRunAction({ pace, expeditionRole: role, mascotIds: picks });
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Expedição criada!");
      setPicks([]);
      router.refresh(); load();
    });
  };

  return (
    <div className="space-y-6">
      <TowerNarrative scene={data.lobbyScene} />
      <TowerNarrativeAdmin initial={data.scenes} />

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
        {data.mascots.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">Nenhum mascote livre disponível. Libere mascotes (fora de arena/expedição/bazar) para entrar.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {data.mascots.map((m: Mascot) => {
              const checked = picks.includes(m.id);
              return (
                <button key={m.id} type="button" onClick={() => toggle(m.id)}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-left ${checked ? "border-[#FFCB05]/50 bg-[#FFCB05]/10" : "border-slate-800 bg-slate-900/50 hover:border-slate-600"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getStaticSpriteUrl(m.pokemonId)} alt="" className="h-11 w-11 shrink-0 object-contain [image-rendering:pixelated]" />
                  <span className="min-w-0">
                    <strong className="block truncate text-[11px] text-white">{m.name}</strong>
                    <small className="text-[10px] text-slate-500">Nv.{m.level}</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <button type="button" onClick={create} disabled={pending || picks.length !== 2 || !role}
        className="w-full rounded-xl bg-[#FFCB05] py-3 text-sm font-black text-[#1A1A2E] transition hover:bg-[#FFD700] disabled:opacity-40">
        {pending ? "Criando…" : "🗼 Iniciar Expedição"}
      </button>
    </div>
  );
}
