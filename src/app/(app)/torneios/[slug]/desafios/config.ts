export type ChallengeConfig = {
  badgeChallenge: boolean;
  freeChallenge: boolean;
  pointsPerBadge: number;
  pointsToChallenge: number;
  challengerPenalty: number;
  maxChallengesReceivedPerWeek: number;
};

export const DEFAULT_CHALLENGE_CONFIG: ChallengeConfig = {
  badgeChallenge: true,
  freeChallenge: false,
  pointsPerBadge: 3,
  pointsToChallenge: 3,
  challengerPenalty: 2,
  maxChallengesReceivedPerWeek: 1
};

export function parseChallengeConfig(raw: unknown): ChallengeConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_CHALLENGE_CONFIG;
  const r = raw as Record<string, unknown>;
  return {
    badgeChallenge: typeof r.badgeChallenge === "boolean" ? r.badgeChallenge : true,
    freeChallenge: typeof r.freeChallenge === "boolean" ? r.freeChallenge : false,
    pointsPerBadge: typeof r.pointsPerBadge === "number" ? r.pointsPerBadge : 3,
    pointsToChallenge: typeof r.pointsToChallenge === "number" ? r.pointsToChallenge : 3,
    challengerPenalty: typeof r.challengerPenalty === "number" ? r.challengerPenalty : 2,
    maxChallengesReceivedPerWeek:
      typeof r.maxChallengesReceivedPerWeek === "number" ? r.maxChallengesReceivedPerWeek : 1
  };
}
