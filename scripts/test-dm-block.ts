import assert from "node:assert/strict";
import { isDirectMessageBlocked } from "../src/lib/dm-block";

assert.equal(
  isDirectMessageBlocked([{ blockerId: "receiver", blockedId: "sender" }], "sender", "receiver"),
  true,
  "um jogador bloqueado não pode enviar DM nem anexos ao bloqueador",
);
assert.equal(
  isDirectMessageBlocked([{ blockerId: "sender", blockedId: "receiver" }], "sender", "receiver"),
  false,
  "o bloqueio é direcional e não impede quem bloqueou de enviar mensagem",
);

console.log("ok dm block");
