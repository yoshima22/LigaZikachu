import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("the tower poster is presented in full beside the introduction", async () => {
  const module = await import("./tower-hero").catch(() => null);
  assert.ok(module?.TowerHero, "TowerHero must exist");

  const html = renderToStaticMarkup(<module.TowerHero />);
  assert.match(html, /cover\.png/);
  assert.match(html, /object-contain/);
  assert.match(html, /Torre dos Rebeldes/);
  assert.doesNotMatch(html, /bg-cover/);
});
