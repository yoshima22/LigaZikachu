export const dynamic = "force-dynamic";

import { getLabDataAction } from "./actions";
import { LabClient } from "./_components/lab-client";

export default async function LaboratorioPage() {
  const data = await getLabDataAction();
  if (!data.ok) return null;

  return (
    <LabClient
      initialDust={data.creationDust}
      initialMascots={data.mascots}
      initialWeeklyUsage={data.weeklyUsage}
      limits={data.limits}
      costs={data.costs}
      initialCoinBalance={data.coinBalance}
      analysisCost={data.analysisCost}
    />
  );
}
