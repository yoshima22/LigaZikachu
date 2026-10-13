"use client";

import type { ComponentProps } from "react";
import { OrderRaidTeamSelector } from "../../ordem-da-trapaca/_components/order-raid-team-selector";
import { JohtoBattleResultView } from "./johto-battle-view";

type JohtoTeamSelectorProps = Omit<ComponentProps<typeof OrderRaidTeamSelector>, "renderResult">;

/**
 * Mantém o renderizador do resultado dentro da fronteira de Client Component.
 * Server Components podem passar a server action para o seletor, mas não uma
 * função de renderização comum.
 */
export function JohtoTeamSelector(props: JohtoTeamSelectorProps) {
  return (
    <OrderRaidTeamSelector
      {...props}
      renderResult={(result, close) => <JohtoBattleResultView result={result} onClose={close} />}
    />
  );
}
