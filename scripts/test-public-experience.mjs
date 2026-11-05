import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

function loadTypeScript(relativePath) {
  const file = new URL("../" + relativePath, import.meta.url);
  if (!existsSync(file)) return null;
  const source = readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require }, { filename: file.pathname });
  return module.exports;
}

const home = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const lobby = readFileSync(new URL("../src/app/(public)/salas/lobby-client.tsx", import.meta.url), "utf8");
const replayPreview = readFileSync(new URL("../src/components/home/weekly-replay-preview.tsx", import.meta.url), "utf8");
const weeklyReplay = loadTypeScript("src/lib/public-weekly-replay.ts");

test("keeps the public home Liga-first while promoting TCG and anonymous chat", () => {
  assert.match(home, /Campeonato TCG/i);
  assert.match(home, /ZikaChat/);
  assert.match(home, /sem conta/i);
  assert.match(home, /Liga Semanal/i);
  assert.match(home, /Liga Rush/i);
  assert.match(home, /SITE_LOGO_URL/);
  assert.doesNotMatch(home, /wide\?: boolean/);
  assert.match(replayPreview, /compact/);
  assert.match(replayPreview, /loop/);
  assert.match(replayPreview, /hideLabels/);
});

test("sanitizes a real weekly replay for the public hero without mascot names", () => {
  assert.equal(typeof weeklyReplay?.buildPublicWeeklyReplay, "function");
  const replay = weeklyReplay.buildPublicWeeklyReplay({
    resultJson: {
      lineupA: [{ id: "a", name: "Mascote confidencial", pokemonId: 25, maxHp: 90 }],
      lineupB: [{ id: "b", name: "Outro nome", pokemonId: 6, maxHp: 120 }],
    },
    replayJson: [{ turn: 1, actorId: "a", targetId: "b", action: "ATTACK", damage: 30 }],
  });
  assert.equal(replay.source, "real");
  assert.equal(JSON.stringify(replay.teams.map((team) => team.pokemonId)), JSON.stringify([25, 6]));
  assert.equal(JSON.stringify(replay.turns), JSON.stringify([{ actorId: "a", targetId: "b", action: "ATTACK", damage: 30 }]));
  assert.equal(JSON.stringify(replay).includes("Mascote confidencial"), false);
  assert.equal(JSON.stringify(replay).includes("Outro nome"), false);
});

test("falls back to a looping demo replay when a weekly match has no usable data", () => {
  assert.equal(typeof weeklyReplay?.buildPublicWeeklyReplay, "function");
  const replay = weeklyReplay.buildPublicWeeklyReplay({ resultJson: null, replayJson: null });
  assert.equal(replay.source, "demo");
  assert.ok(replay.teams.length >= 4);
  assert.ok(replay.turns.length >= 4);
});

test("lobby supports both code entry and safe public room cards", () => {
  assert.match(lobby, /Entrar com código/);
  assert.match(lobby, /Ao vivo agora/);
  assert.match(lobby, /publicId/);
  const renderedLobby = lobby.split("  return (\n    <main")[1];
  assert.ok(renderedLobby);
  assert.doesNotMatch(renderedLobby, /topicSecret|passwordHash|participantToken|hostToken/);
});
