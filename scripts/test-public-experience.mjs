import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const lobby = readFileSync(new URL("../src/app/(public)/salas/lobby-client.tsx", import.meta.url), "utf8");

test("keeps the public home Liga-first while promoting TCG and anonymous chat", () => {
  assert.match(home, /Campeonato TCG/i);
  assert.match(home, /ZikaChat/);
  assert.match(home, /sem conta/i);
});

test("lobby supports both code entry and safe public room cards", () => {
  assert.match(lobby, /Entrar com código/);
  assert.match(lobby, /Ao vivo agora/);
  assert.match(lobby, /publicId/);
  const renderedLobby = lobby.split("  return (\n    <main")[1];
  assert.ok(renderedLobby);
  assert.doesNotMatch(renderedLobby, /topicSecret|passwordHash|participantToken|hostToken/);
});
