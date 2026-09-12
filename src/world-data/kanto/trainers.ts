export type WorldTrainerMascot = {
  pokemonId: number;
  level: number;
  role: string;
  stats: { force: number; agility: number; charisma: number; instinct: number; vitality: number };
};

export type WorldTrainer = {
  id: string;
  locationId: string;
  name: string;
  title: string;
  intro: string;
  portraitUrl?: string;
  badgeId?: string;
  prerequisiteId?: string;
  team: WorldTrainerMascot[];
  firstWinReward: { pokeBalls?: number; potions?: number; antidotes?: number; zikaCoins?: number };
};

export const KANTO_MVP_TRAINERS: WorldTrainer[] = [
  {
    id: "viridian-bug-catcher-01", locationId: "viridian-forest", name: "Noah", title: "Jovem Caçador de Insetos",
    intro: "Você ouviu o farfalhar também? Meus parceiros conhecem cada curva desta trilha.", portraitUrl: "/world-mode/kanto/viridian-forest/trainer-noah.webp",
    team: [
      { pokemonId: 10, level: 4, role: "ATTACKER", stats: { force: 12, agility: 14, charisma: 9, instinct: 12, vitality: 12 } },
      { pokemonId: 13, level: 4, role: "OPPORTUNIST", stats: { force: 11, agility: 13, charisma: 8, instinct: 15, vitality: 11 } },
    ], firstWinReward: { pokeBalls: 1 },
  },
  {
    id: "viridian-bug-catcher-02", locationId: "viridian-forest", name: "Milo", title: "Caçador do Dossel",
    intro: "A floresta recompensa paciência. Vamos ver se sua equipe sabe esperar a abertura certa.", portraitUrl: "/world-mode/kanto/viridian-forest/trainer-milo.webp", prerequisiteId: "viridian-bug-catcher-01",
    team: [
      { pokemonId: 11, level: 5, role: "DEFENDER", stats: { force: 10, agility: 8, charisma: 10, instinct: 12, vitality: 20 } },
      { pokemonId: 10, level: 5, role: "FLANK", stats: { force: 13, agility: 18, charisma: 9, instinct: 14, vitality: 12 } },
    ], firstWinReward: { antidotes: 1 },
  },
  {
    id: "viridian-bug-catcher-03", locationId: "viridian-forest", name: "Iris", title: "Veterana da Colmeia",
    intro: "Você chegou longe. Agora enfrente uma equipe que luta como uma colmeia de verdade.", portraitUrl: "/world-mode/kanto/viridian-forest/trainer-iris.webp", prerequisiteId: "viridian-bug-catcher-02",
    team: [
      { pokemonId: 13, level: 6, role: "OPPORTUNIST", stats: { force: 14, agility: 15, charisma: 10, instinct: 19, vitality: 13 } },
      { pokemonId: 14, level: 6, role: "DEFENDER", stats: { force: 11, agility: 9, charisma: 10, instinct: 14, vitality: 22 } },
      { pokemonId: 15, level: 8, role: "DUELIST", stats: { force: 24, agility: 23, charisma: 13, instinct: 21, vitality: 18 } },
    ], firstWinReward: { pokeBalls: 2, potions: 1 },
  },
  {
    id: "pewter-camper-liam", locationId: "pewter-city", name: "Liam", title: "Campista do Ginásio",
    intro: "Pedra não precisa ser rápida quando sabe exatamente onde aguentar o impacto.",
    team: [
      { pokemonId: 74, level: 9, role: "DEFENDER", stats: { force: 22, agility: 11, charisma: 12, instinct: 15, vitality: 28 } },
      { pokemonId: 524, level: 9, role: "GUARDIAN", stats: { force: 23, agility: 10, charisma: 16, instinct: 13, vitality: 29 } },
    ], firstWinReward: { potions: 1, zikaCoins: 30 },
  },
  {
    id: "pewter-hiker-marcus", locationId: "pewter-city", name: "Marcus", title: "Montanhista Veterano",
    intro: "Força abre caminhos. Resistência decide quem permanece de pé quando a poeira baixa.", prerequisiteId: "pewter-camper-liam",
    team: [
      { pokemonId: 74, level: 10, role: "ATTACKER", stats: { force: 27, agility: 12, charisma: 12, instinct: 17, vitality: 26 } },
      { pokemonId: 95, level: 11, role: "GUARDIAN", stats: { force: 30, agility: 13, charisma: 18, instinct: 18, vitality: 34 } },
    ], firstWinReward: { pokeBalls: 2, zikaCoins: 50 },
  },
  {
    id: "pewter-leader-brock", locationId: "pewter-city", name: "Brock", title: "Líder do Ginásio de Pewter",
    intro: "Uma base sólida sustenta qualquer sonho. Mostre que sua equipe aprendeu a atravessar Kanto unida.", prerequisiteId: "pewter-hiker-marcus", badgeId: "boulder-badge",
    team: [
      { pokemonId: 74, level: 12, role: "DEFENDER", stats: { force: 30, agility: 14, charisma: 18, instinct: 19, vitality: 36 } },
      { pokemonId: 95, level: 14, role: "GUARDIAN", stats: { force: 38, agility: 16, charisma: 22, instinct: 23, vitality: 44 } },
    ], firstWinReward: { pokeBalls: 5, potions: 2, zikaCoins: 150 },
  },
];

export const KANTO_MVP_TRAINER_BY_ID = new Map(KANTO_MVP_TRAINERS.map((trainer) => [trainer.id, trainer]));
