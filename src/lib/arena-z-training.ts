// Sala de treino com habilidades: é uma equipe de treino (isTraining) marcada por esse
// roomLevel sentinela — evita coluna nova no banco. Só nela as habilidades passivas valem na Arena Z.
export const TRAINING_ABILITY_ROOM = -1;

export function isAbilityTrainingTeam(team: { isTraining: boolean; roomLevel: number | null }) {
  return team.isTraining && team.roomLevel === TRAINING_ABILITY_ROOM;
}
