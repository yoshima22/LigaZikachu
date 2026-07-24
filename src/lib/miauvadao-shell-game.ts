export const SHELL_MIN_BET = 50;
export const SHELL_MAX_BET = 2_000;
export const SHELL_WIN_BONUS_PCT = 0.65;

export function getShellGamePrize(betAmount: number) {
  return betAmount + Math.floor(betAmount * SHELL_WIN_BONUS_PCT);
}

/** Maior aposta cujo prêmio total pode ser pago integralmente pelo cofre. */
export function getMaxShellBetForVault(vaultBalance: number) {
  let maxBet = Math.min(SHELL_MAX_BET, Math.floor(Math.max(0, vaultBalance) / (1 + SHELL_WIN_BONUS_PCT)));
  while (maxBet > 0 && getShellGamePrize(maxBet) > vaultBalance) maxBet -= 1;
  while (maxBet < SHELL_MAX_BET && getShellGamePrize(maxBet + 1) <= vaultBalance) maxBet += 1;
  return maxBet;
}
