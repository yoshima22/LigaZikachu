export const dynamic = "force-dynamic";

import { getLabDataAction } from "./actions";
import { LabClient } from "./_components/lab-client";
import { getActiveRaidSabotages, getOrderStepUnlockState } from "@/lib/raid-event";
import { MysteryStepButton } from "@/app/(app)/combates/ordem-da-trapaca/_components/mystery-step-button";

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  return (
    <div className="h-2 rounded-full bg-slate-800">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${Math.min(100, (value / Math.max(1, total)) * 100)}%` }}
      />
    </div>
  );
}

export default async function LaboratorioPage() {
  const [raidSabotages, labStepState] = await Promise.all([
    getActiveRaidSabotages("LABORATORY"),
    getOrderStepUnlockState("LAB_SMOKE_TO_MACHINE"),
  ]);

  const labDisabled = raidSabotages.find(
    (s) => s.sabotageType === "DISABLE_LAB_ANALYSIS" || s.sabotageType === "DISABLE_DUST_CONVERSION",
  );
  const shouldLockLab =
    Boolean(labDisabled) ||
    (labStepState.active && labStepState.unlocked && !labStepState.resolved);

  if (shouldLockLab) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <div className="rounded-3xl border border-purple-500/35 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.2),transparent_35%),rgba(15,23,42,0.92)] p-6 shadow-[0_0_40px_rgba(168,85,247,0.12)]">
          <p className="text-[10px] uppercase tracking-[0.24em] text-purple-300">Ordem da Trapaca</p>
          <h1 className="mt-2 font-pixel text-2xl text-[#FFCB05]">Laboratorio travado</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
            {labDisabled?.description ??
              "A maquina do Laboratorio engasgou com fumaca roxa. Analises, reciclagem e trocas ficam bloqueadas ate a etapa ser resolvida."}
          </p>
          <p className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-500">
            Seus mascotes e recursos estao seguros. O bloqueio so impede novas operacoes do Laboratorio enquanto a travessura estiver ativa.
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-[10px] uppercase tracking-widest text-purple-300">Maquina obstruida</p>
              <p className="mt-2 text-sm text-slate-300">
                A fumaca nao esta saindo da bancada. Ela parece voltar para dentro da maquina de analise,
                como se a pista estivesse presa no proprio equipamento.
              </p>
              <div className="mt-4 rounded-xl border border-purple-400/25 bg-purple-500/10 p-4">
                <p className="font-semibold text-purple-100">Fumaca densa</p>
                <p className="mt-1 text-xs text-slate-400">
                  Quando as pistas suficientes forem encontradas, a Liga pode dissipar a fumaca e reabrir o Laboratorio.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-[10px] uppercase tracking-widest text-purple-300">Investigacao</p>
              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span>Pistas gerais</span>
                    <span>{labStepState.generalClues}/{labStepState.requiredGeneralClues}</span>
                  </div>
                  <ProgressBar value={labStepState.generalClues} total={labStepState.requiredGeneralClues} color="bg-purple-400" />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span>Pistas do Laboratorio</span>
                    <span>{labStepState.specificClues}/{labStepState.requiredSpecificClues}</span>
                  </div>
                  <ProgressBar value={labStepState.specificClues} total={labStepState.requiredSpecificClues} color="bg-[#FFCB05]" />
                </div>
              </div>

              {labStepState.unlocked ? (
                <div className="mt-5">
                  <MysteryStepButton
                    stepKey="LAB_SMOKE_TO_MACHINE"
                    returnPath="/laboratorio"
                    className="w-full rounded-xl border border-[#FFCB05]/60 bg-[#FFCB05] px-4 py-3 text-sm font-black text-slate-950 shadow-[0_0_22px_rgba(255,203,5,0.22)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                    showOnlySuccess
                    pendingLabel="Dissipando..."
                    title="Dissipar a fumaca do Laboratorio"
                  >
                    Dissipar fumaca
                  </MysteryStepButton>
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-300">
                  Continue encontrando pistas na Arena, Liga Semanal e expedicoes curtas para liberar a solucao.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const data = await getLabDataAction();
  if (!data.ok) return null;

  return (
    <LabClient
      initialDust={data.creationDust}
      initialMascots={data.mascots}
      initialWeeklyUsage={data.weeklyUsage}
      initialMonthlyUsage={data.monthlyUsage}
      weeklyEvolutionStone={data.weeklyEvolutionStone}
      limits={data.limits}
      costs={data.costs}
      monthlyCosts={data.monthlyCosts}
      initialCoinBalance={data.coinBalance}
      analysisCost={data.analysisCost}
    />
  );
}
