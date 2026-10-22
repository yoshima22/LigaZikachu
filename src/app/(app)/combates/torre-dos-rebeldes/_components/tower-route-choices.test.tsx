import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TowerRouteChoices } from "./tower-route-choices";

test("route cards explain opportunity and danger in one responsive choice surface", () => {
  const routes = [
    { id: "route-a", title: "Rota desconhecida", kind: "UNKNOWN", visited: false, cleared: false, available: true, blockedReason: null,
      intel: { signal: "Passos e metal", opportunity: "Confronto possível", risk: "Pode haver desgaste" } },
    { id: "route-b", title: "Capela Silenciosa", kind: "REST", visited: true, cleared: true, available: false, blockedReason: "Resolva a sala atual",
      intel: { signal: "Chama acolhedora", opportunity: "Pode recuperar HP", risk: "Aumenta Pressão" } },
  ];
  const html = renderToStaticMarkup(<TowerRouteChoices routes={routes} selectedId="route-a" disabled={false} onRoute={() => {}} />);
  assert.match(html, /Passos e metal/);
  assert.match(html, /Confronto possível/);
  assert.match(html, /Pode haver desgaste/);
  assert.match(html, /Voltar/);
  assert.match(html, /Rota marcada/);
  assert.match(html, /Resolva a sala atual/);
  assert.match(html, /disabled=""/);
  assert.match(html, /grid-cols-1/);
  assert.doesNotMatch(html, /Escolha [12]/);
});
