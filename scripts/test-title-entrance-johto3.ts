import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Johto3PlacementEffect, type Johto3Tier } from "../src/components/ui/title-entrance-johto3";

const scenarios: Array<{ tier: Johto3Tier; placement: string; label: string }> = [
  { tier: "FIRST", placement: "first", label: "1º Lugar" },
  { tier: "SECOND", placement: "second", label: "2º Lugar" },
  { tier: "THIRD", placement: "third", label: "3º Lugar" },
  { tier: "FOURTH", placement: "fourth", label: "4º Lugar" },
  { tier: "CHAMPION", placement: "cup-champion", label: "Campeão da Copa Johto" },
];

for (const scenario of scenarios) {
  const markup = renderToStaticMarkup(createElement(Johto3PlacementEffect, {
    tier: scenario.tier,
    name: "Mestre Zikachu",
    flavorText: "Uma jornada memorável.",
  }));

  assert.match(markup, new RegExp(`data-placement="${scenario.placement}"`), `${scenario.tier} needs its dedicated placement composition`);
  assert.match(markup, new RegExp(`${scenario.label}\\s*<span>`), `${scenario.tier} needs the correct placement label`);
  assert.match(markup, />Mestre Zikachu</, `${scenario.tier} must keep the player name visible`);
}

console.log("Johto III placement effects: dedicated compositions and labels: ok");
