import assert from "node:assert/strict";
import test from "node:test";
import { formatZikaLootTicketUsage } from "./zikaloot-ticket-usage";

test("formats used tickets against the draw maximum", () => {
  assert.equal(
    formatZikaLootTicketUsage(35, 35),
    "35 (Usados) / 35 Máximo total",
  );
});
