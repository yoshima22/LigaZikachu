// Preferências de notificação por jogador: quais categorias ele quer receber,
// em quais canais (Jogo / Celular) e um cooldown global de push (1–120 min).
// Modelo opt-out: sem configuração salva, tudo é permitido e o cooldown é 0.

export type NotifCategory =
  | "MENSAGENS"
  | "BAZAR"
  | "ARENA"
  | "LIGA_SEMANAL"
  | "LIGA_RUSH"
  | "MASCOTES"
  | "ANUNCIOS"
  | "OUTROS";

export type NotifChannelPrefs = { inGame: boolean; push: boolean };

export type NotificationSettings = {
  /** Cooldown de push em minutos (0 = desligado, 1–120 = intervalo mínimo entre pushes). */
  cooldownMinutes: number;
  categories: Record<NotifCategory, NotifChannelPrefs>;
};

export const NOTIF_CATEGORIES: { key: NotifCategory; label: string; hint: string }[] = [
  { key: "MENSAGENS",    label: "Mensagens diretas", hint: "Novas mensagens de outros jogadores." },
  { key: "BAZAR",        label: "Bazar",             hint: "Vendas, propostas, trocas e leilões." },
  { key: "ARENA",        label: "Arena",             hint: "Arena Z e Arena Draft: desafios e resultados." },
  { key: "LIGA_SEMANAL", label: "Liga Semanal",      hint: "Partidas e atualizações da Liga Semanal." },
  { key: "LIGA_RUSH",    label: "Liga Rush",         hint: "Partidas e atualizações da Liga Rush." },
  { key: "MASCOTES",     label: "Mascotes",          hint: "Expedições, Laços, cuidado e afins." },
  { key: "ANUNCIOS",     label: "Anúncios da Liga",  hint: "Comunicados enviados pela administração." },
  { key: "OUTROS",       label: "Outros",            hint: "Torneios, ZikaLoot, Álbum e demais avisos." },
];

export const COOLDOWN_MIN = 1;
export const COOLDOWN_MAX = 120;

function defaultChannels(): NotifChannelPrefs {
  return { inGame: true, push: true };
}

export function defaultNotificationSettings(): NotificationSettings {
  return {
    cooldownMinutes: 0,
    categories: Object.fromEntries(
      NOTIF_CATEGORIES.map((c) => [c.key, defaultChannels()]),
    ) as Record<NotifCategory, NotifChannelPrefs>,
  };
}

/** Normaliza o JSON salvo (parcial/legado) para uma configuração completa e segura. */
export function parseNotificationSettings(raw: unknown): NotificationSettings {
  const base = defaultNotificationSettings();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const obj = raw as Record<string, unknown>;

  const cd = Number(obj.cooldownMinutes);
  if (Number.isFinite(cd)) {
    base.cooldownMinutes = cd <= 0 ? 0 : Math.min(COOLDOWN_MAX, Math.max(COOLDOWN_MIN, Math.round(cd)));
  }

  const cats = obj.categories;
  if (cats && typeof cats === "object" && !Array.isArray(cats)) {
    for (const { key } of NOTIF_CATEGORIES) {
      const entry = (cats as Record<string, unknown>)[key];
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const e = entry as Record<string, unknown>;
        base.categories[key] = {
          inGame: e.inGame !== false,
          push: e.push !== false,
        };
      }
    }
  }
  return base;
}

/** Mapeia a `category` gravada em PlayerNotification para a categoria de preferência. */
export function dbCategoryToNotif(dbCategory: string): NotifCategory {
  switch (dbCategory) {
    case "BAZAR": return "BAZAR";
    case "BONDS":
    case "MASCOT": return "MASCOTES";
    case "MESSAGE": return "MENSAGENS";
    case "ARENA": return "ARENA";
    default: return "OUTROS";
  }
}

export function isInGameAllowed(raw: unknown, category: NotifCategory): boolean {
  return parseNotificationSettings(raw).categories[category].inGame;
}

export function isPushAllowed(raw: unknown, category: NotifCategory): boolean {
  return parseNotificationSettings(raw).categories[category].push;
}

/** true quando o cooldown de push ainda não expirou desde o último envio. */
export function isWithinPushCooldown(raw: unknown, lastPushAt: Date | null | undefined, now = Date.now()): boolean {
  const { cooldownMinutes } = parseNotificationSettings(raw);
  if (cooldownMinutes <= 0 || !lastPushAt) return false;
  return now - new Date(lastPushAt).getTime() < cooldownMinutes * 60_000;
}
