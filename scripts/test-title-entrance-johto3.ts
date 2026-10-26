import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Johto3PlacementEffect, type Johto3Tier } from "../src/components/ui/title-entrance-johto3";
import { getTitleEntranceDuration } from "../src/components/ui/title-entrance";

const scenarios: Array<{ tier: Johto3Tier; placement: string; direction: string; label: string }> = [
  { tier: "FIRST", placement: "first", direction: "royal-procession", label: "1º Lugar" },
  { tier: "SECOND", placement: "second", direction: "silver-spotlight", label: "2º Lugar" },
  { tier: "THIRD", placement: "third", direction: "bronze-podium", label: "3º Lugar" },
  { tier: "FOURTH", placement: "fourth", direction: "emerald-arc", label: "4º Lugar" },
  { tier: "CHAMPION", placement: "cup-champion", direction: "cup-coronation", label: "Campeão da Copa Johto" },
];

for (const scenario of scenarios) {
  const markup = renderToStaticMarkup(createElement(Johto3PlacementEffect, {
    tier: scenario.tier,
    name: "Mestre Zikachu",
    flavorText: "Uma jornada memorável.",
  }));

  assert.match(markup, new RegExp(`data-placement="${scenario.placement}"`), `${scenario.tier} needs its dedicated placement composition`);
  assert.match(markup, new RegExp(`data-art-direction="${scenario.direction}"`), `${scenario.tier} needs its own art direction`);
  assert.match(markup, new RegExp(`${scenario.label}\\s*<span>`), `${scenario.tier} needs the correct placement label`);
  assert.match(markup, />Mestre Zikachu</, `${scenario.tier} must keep the player name visible`);
  assert.match(markup, /class="j3-cinematic-copy"/, `${scenario.tier} must use the cinematic copy treatment`);
  assert.match(markup, /\.j3-cinematic-copy\{[^}]*\.5s/, `${scenario.tier} must reveal primary copy about one second earlier`);
  assert.match(markup, /@media \(prefers-reduced-motion: reduce\)/, `${scenario.tier} must provide a reduced-motion presentation`);
}

console.log("Johto III placement effects: dedicated compositions and labels: ok");

assert.equal(getTitleEntranceDuration("JOHTO3_FIRST"), 7200);
assert.equal(getTitleEntranceDuration("JOHTO3_SECOND"), 6000);
assert.equal(getTitleEntranceDuration("JOHTO3_THIRD"), 5200);
assert.equal(getTitleEntranceDuration("JOHTO3_CHAMPION"), 5000);
assert.equal(getTitleEntranceDuration("JOHTO3_FOURTH"), 3800);

console.log("Johto III placement effect durations: one second shorter: ok");
