import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/components/quick-room/quick-room-client.tsx", import.meta.url), "utf8");

test("keeps microphone and camera opt-in", () => {
  assert.match(source, /const \[cameraOn, setCameraOn\] = useState\(false\)/);
  assert.match(source, /Entrar com microfone ligado/);
});

test("uses explicit source subscriptions for camera and screen", () => {
  assert.match(source, /type MediaKind = "screen" \| "camera"/);
  assert.match(source, /source: MediaKind/);
  assert.match(source, /peer\.viewing\.camera/);
  assert.match(source, /toggleWatch\(member\.id, "camera"\)/);
  assert.doesNotMatch(source, /setCameraOn\(true\); setSharing\(true\)/);
});
