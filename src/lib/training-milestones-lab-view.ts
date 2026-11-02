import { buildTrainingJourney, TRAINING_STANCES, type TrainingPersonality, type TrainingStanceKey } from "./training-milestones";

export function buildTrainingLabView(input: {
  stance: TrainingStanceKey;
  personality: TrainingPersonality;
  seed: number;
  focusA: number;
  focusB: number;
}) {
  const journey = buildTrainingJourney(input);
  const average = Math.max(0, Math.min(250, (input.focusA + input.focusB) / 2));
  const percentage = Math.round((average / 250) * 100);
  return {
    ...journey,
    focusLabel: TRAINING_STANCES[input.stance].focus.join(" + "),
    effectPreview: `Força de foco: ${percentage}% do teto publicado (${average.toFixed(0)} de 250).`,
    persistenceNotice: "Simulação local — não cria item, não consome ZC e não libera postura.",
  };
}
