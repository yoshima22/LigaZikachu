export const THEME_STORAGE_KEY = "liga-zikachu:site-theme";
export const THEMES_PER_PAGE = 4;
export const SITE_THEMES = [
  { id: "padrao", name: "Padrão original", description: "Restaura as cores e o fundo originais, mantendo a nova logo da Liga.", accent: "#ffcb05", background: "#0f0f1a" },
  { id: "tecnologico", name: "Tecnológico", description: "Violeta, azul e linhas digitais para uma atmosfera futurista.", accent: "#a78bfa", background: "#080b26" },
  { id: "claro", name: "Claro", description: "Fundo claro e detalhes dourados, com painéis escuros de alto contraste.", accent: "#ffcb05", background: "#eaf2ff" },
  { id: "competitivo", name: "Competitivo", description: "Vermelho e grafite para entrar no clima da competição.", accent: "#f87171", background: "#140c10" },
  { id: "aurora", name: "Aurora", description: "Luzes violeta e turquesa em um céu noturno suave.", accent: "#a78bfa", background: "#11143a" },
  { id: "oceano", name: "Oceano", description: "Azuis profundos e reflexos aquáticos para uma navegação tranquila.", accent: "#38bdf8", background: "#071d32" },
  { id: "esmeralda", name: "Esmeralda", description: "Verdes vivos e névoa de floresta com contraste confortável.", accent: "#4ade80", background: "#09241c" },
  { id: "por-do-sol", name: "Pôr do Sol", description: "Coral, âmbar e azul de fim de tarde, sem pesar na tela.", accent: "#fb923c", background: "#2a1421" },
  { id: "rubi", name: "Rubi", description: "Vermelho intenso, grafite e reflexos discretos de competição.", accent: "#fb7185", background: "#240d16" },
  { id: "monocromatico", name: "Monocromático", description: "Preto, branco e prata com foco máximo no conteúdo do jogo.", accent: "#e5e7eb", background: "#101114" },
] as const;
export type SiteTheme = (typeof SITE_THEMES)[number]["id"];
export function normalizeSiteTheme(value: unknown): SiteTheme {
  return SITE_THEMES.find((theme) => theme.id === value)?.id ?? "padrao";
}
// Static, allow-listed initialization runs before paint, without a server cookie
// or database read. Never interpolate values read from storage into this script.
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});document.documentElement.dataset.theme=${JSON.stringify(SITE_THEMES.map((theme) => theme.id))}.includes(t)?t:"padrao"}catch(e){document.documentElement.dataset.theme="padrao"}`;
