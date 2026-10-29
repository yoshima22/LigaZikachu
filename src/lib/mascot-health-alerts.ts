export type MascotHealthAlertKind = "DISEASED" | "AT_RISK";

export type MascotHealthAlertMascot = { name: string };

function affectedNames(mascots: MascotHealthAlertMascot[]) {
  return mascots.length === 1
    ? mascots[0].name
    : `${mascots[0].name} e ${mascots[1].name}`;
}

export function formatMascotHealthAlert(
  kind: MascotHealthAlertKind,
  mascots: MascotHealthAlertMascot[],
): { title: string; body: string } {
  const names = affectedNames(mascots);
  const named = mascots.length <= 2;

  if (kind === "DISEASED") {
    return named
      ? {
          title: mascots.length === 1 ? "Um mascote está doente" : "Dois mascotes estão doentes",
          body: `${names} ${mascots.length === 1 ? "está" : "estão"} doente${mascots.length === 1 ? "" : "s"}. Use um Antídoto para interromper a transmissão.`,
        }
      : {
          title: "Um ou mais mascotes estão doentes",
          body: "Um ou mais mascotes estão doentes. Use Antídoto para interromper a transmissão.",
        };
  }

  return named
    ? {
        title: mascots.length === 1 ? "Um mascote está perto de ficar doente" : "Dois mascotes estão perto de ficar doentes",
        body: `${names} ${mascots.length === 1 ? "está" : "estão"} perto de ficar doente${mascots.length === 1 ? "" : "s"}. Cuidado!`,
      }
    : {
        title: "Um ou mais mascotes estão perto de ficar doentes",
        body: "Um ou mais mascotes estão perto de ficar doentes. Cuidado!",
      };
}
