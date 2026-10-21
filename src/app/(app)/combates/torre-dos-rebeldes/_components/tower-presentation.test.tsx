import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TOWER_BOSS_PRIZES } from "@/lib/tower/exclusive-catalog";

test("the tower poster is presented in full beside the introduction", async () => {
  const module = await import("./tower-hero").catch(() => null);
  assert.ok(module?.TowerHero, "TowerHero must exist");

  const html = renderToStaticMarkup(<module.TowerHero />);
  assert.match(html, /cover\.png/);
  assert.match(html, /object-contain/);
  assert.match(html, /Torre dos Rebeldes/);
  assert.doesNotMatch(html, /bg-cover/);
});

test("the floor overview does not deliver boss identities or exact prizes", async () => {
  const module = await import("./tower-floor-mysteries").catch(() => null);
  assert.ok(module?.TowerFloorMysteries, "TowerFloorMysteries must exist");

  const html = renderToStaticMarkup(<module.TowerFloorMysteries />);
  assert.equal((html.match(/º andar/g) ?? []).length, 7);
  for (const prize of TOWER_BOSS_PRIZES) {
    assert.equal(html.includes(prize.boss), false, `boss ${prize.floor} leaked`);
    assert.equal(html.includes(prize.label), false, `prize ${prize.floor} leaked`);
  }
  const lobbySource = readFileSync(new URL("./tower-lobby.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(lobbySource, /TOWER_BOSS_PRIZES/);
});
