import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const source = readFileSync(new URL("../src/components/quick-room/quick-room-client.tsx", import.meta.url), "utf8");
const require = createRequire(import.meta.url);

function loadTypeScript(relativePath) {
  const file = new URL("../" + relativePath, import.meta.url);
  if (!existsSync(file)) return null;
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require }, { filename: file.pathname });
  return module.exports;
}

const audioPolicy = loadTypeScript("src/lib/quick-room-audio.ts");
const liveSources = loadTypeScript("src/lib/quick-room-live.ts");

test("keeps microphone and camera opt-in", () => {
  assert.match(source, /const \[cameraOn, setCameraOn\] = useState\(false\)/);
  assert.match(source, /Entrar com microfone ligado/);
});

test("builds microphone constraints from the visible noise-reduction preference", () => {
  assert.ok(audioPolicy, "audio policy module should exist");
  const enabled = audioPolicy.microphoneConstraints(true);
  const disabled = audioPolicy.microphoneConstraints(false);
  assert.equal(enabled.echoCancellation, true);
  assert.equal(enabled.autoGainControl, true);
  assert.equal(enabled.noiseSuppression, true);
  assert.equal(disabled.noiseSuppression, false);
});

test("prioritizes shared screens before optional cameras in the room live-source list", () => {
  assert.ok(liveSources, "live source policy module should exist");
  const sources = liveSources.activeLiveSources([
    { id: "a", name: "Ana", sharing: false, camera: true },
    { id: "b", name: "Bruno", sharing: true, camera: true },
  ]);
  assert.equal(sources.length, 3);
  assert.equal(sources[0].kind, "screen");
  assert.equal(sources[0].name, "Bruno");
  assert.equal(sources[1].kind, "camera");
  assert.equal(sources[2].kind, "camera");
});

test("describes each participant media state for assistive technology", () => {
  assert.equal(
    liveSources.participantActivityLabel({ id: "a", name: "Ana", mic: true, sharing: true, camera: true }),
    "Microfone ligado, câmera disponível, tela disponível",
  );
  assert.equal(
    liveSources.participantActivityLabel({ id: "b", name: "Bruno", mic: false, sharing: false, camera: false }),
    "Conectado, sem mídia ativa",
  );
});

test("uses explicit source subscriptions for camera and screen", () => {
  assert.match(source, /type MediaKind = "screen" \| "camera"/);
  assert.match(source, /source: MediaKind/);
  assert.match(source, /peer\.viewing\.camera/);
  assert.match(source, /toggleWatch\(member\.id, "camera"\)/);
  assert.doesNotMatch(source, /setCameraOn\(true\); setSharing\(true\)/);
});
