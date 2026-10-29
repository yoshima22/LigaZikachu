export function shouldShowExpeditionStatus(claimable: boolean) {
  return !claimable;
}

export function shouldShowExpeditionCancellation(claimable: boolean) {
  return !claimable;
}
