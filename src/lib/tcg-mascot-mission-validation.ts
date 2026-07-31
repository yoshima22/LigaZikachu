export type MascotMissionDeckValidation = {
  valid: boolean;
  matchedCardNames: string[];
  acceptedCardNames: string[];
};

export function normalizeTcgCardText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[♀]/g, " f ")
    .replace(/[♂]/g, " m ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function containsCardName(line: string, cardName: string) {
  if (!line || !cardName) return false;
  return (` ${line} `).includes(` ${cardName} `);
}

export function validateMascotMissionDeckList(
  deckList: string,
  acceptedCardNames: string[],
): MascotMissionDeckValidation {
  const names = Array.from(new Set(acceptedCardNames));
  const lines = deckList
    .split(/\r?\n/)
    .map(normalizeTcgCardText)
    .filter(Boolean);

  const matchedCardNames = names.filter((name) => {
    const normalizedName = normalizeTcgCardText(name);
    return !!normalizedName && lines.some((line) => containsCardName(line, normalizedName));
  });

  return {
    valid: matchedCardNames.length > 0,
    matchedCardNames: Array.from(new Set(matchedCardNames)),
    acceptedCardNames: names,
  };
}
