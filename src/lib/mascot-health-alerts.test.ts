import assert from "node:assert/strict";
import test from "node:test";
import { formatMascotHealthAlert } from "./mascot-health-alerts";

test("formats a named disease alert for one mascot", () => {
  assert.deepEqual(formatMascotHealthAlert("DISEASED", [{ name: "Pikachu" }]), {
    title: "Um mascote está doente",
    body: "Pikachu está doente. Use um Antídoto para interromper a transmissão.",
  });
});

test("formats an at-risk alert with both names when two mascots are affected", () => {
  const alert = formatMascotHealthAlert("AT_RISK", [{ name: "Pikachu" }, { name: "Eevee" }]);

  assert.equal(alert.title, "Dois mascotes estão perto de ficar doentes");
  assert.match(alert.body, /Pikachu e Eevee/);
});

test("keeps names out of aggregate alerts for large groups", () => {
  const alert = formatMascotHealthAlert("DISEASED", [
    { name: "Pikachu" },
    { name: "Eevee" },
    { name: "Bulbasaur" },
  ]);

  assert.deepEqual(alert, {
    title: "Um ou mais mascotes estão doentes",
    body: "Um ou mais mascotes estão doentes. Use Antídoto para interromper a transmissão.",
  });
});
