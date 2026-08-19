// Mensagens de anúncio de live na Zika TV (ticker / Professor Enguiça).
// Combate: locução esportiva animada. Live livre: anúncios do Professor Enguiça.
// Cada categoria tem 6 variações; escolhemos uma ao acaso a cada live.

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const COMBAT_MESSAGES: Array<(label: string) => string> = [
  (l) => `📺 Tá pegando fogo, bicho! ${l} acabou de entrar AO VIVO na Zika TV. Corre pra arquibancada!`,
  (l) => `🔴 Liga o rádio da torcida! ${l} começou agora na Zika TV. Não perde esse combate!`,
  (l) => `⚔️ Soltaram os mascotes! ${l} está AO VIVO na Zika TV — vem torcer!`,
  (l) => `🍿 Pega a pipoca! ${l} entrou no ar na Zika TV. O combate já vai começar!`,
  (l) => `🎙️ Atenção, arquibancada: ${l} AO VIVO agora na Zika TV. É pancadaria boa!`,
  (l) => `🔥 A rinha começou! ${l} está transmitindo na Zika TV. Corre que tá quente!`,
];

const FREE_MESSAGES: Array<(title: string) => string> = [
  (t) => `🎬 Professor Enguiça anuncia: "${t}" no ar agora na Zika TV. Chega mais!`,
  (t) => `📡 O Professor Enguiça abriu a antena: "${t}" AO VIVO na Zika TV. Bora acompanhar!`,
  (t) => `🐟 Enguiça na área! "${t}" rolando agora na Zika TV — passa lá pra prosa!`,
  (t) => `📺 Sintonia especial do Professor Enguiça: "${t}" AO VIVO na Zika TV. Cola com a gente!`,
  (t) => `✨ O Professor Enguiça avisa: "${t}" começou na Zika TV. Puxa a cadeira e vem!`,
  (t) => `🎧 Direto do estúdio do Enguiça: "${t}" AO VIVO na Zika TV. A resenha é agora!`,
];

/**
 * Mensagem do ticker para uma live que acabou de entrar no ar.
 * `isCombat` distingue transmissões de partida/torneio das lives livres (avulsas).
 */
export function specLiveTickerMessage(params: { isCombat: boolean; label: string }): string {
  return params.isCombat ? pick(COMBAT_MESSAGES)(params.label) : pick(FREE_MESSAGES)(params.label);
}
