import { THEME_ART } from "./site-theme-assets";
export const THEME_STORAGE_KEY = "liga-zikachu:site-theme";
export const THEMES_PER_PAGE = 4;
export const SITE_THEMES = [
  { id: "padrao", name: "Padrão original", description: "Restaura as cores e o fundo originais, mantendo a nova logo da Liga.", accent: "#ffcb05", background: "#0f0f1a" },
  { id: "tecnologico", name: "Tecnológico", description: "Violeta, azul e linhas digitais para uma atmosfera futurista.", accent: "#a78bfa", background: "#080b26" },
  { id: "claro", name: "Claro", description: "Fundo claro e detalhes dourados, com painéis escuros de alto contraste.", accent: "#ffcb05", background: "#eaf2ff" },
  { id: "competitivo", name: "Competitivo", description: "Vermelho e grafite para entrar no clima da competição.", accent: "#f87171", background: "#140c10" },
  { id: "alakazam", name: "Alakazam · Santuário", description: "Energia psíquica e templos sob a luz da lua.", accent: "#d8b4fe", background: "#161025", thumbnail: THEME_ART.alakazam.thumbnail },
  { id: "mewtwo", name: "Mewtwo · Eclipse", description: "Um mundo lendário entre ruínas e céus violetas.", accent: "#e9a5ff", background: "#150e29", thumbnail: THEME_ART.mewtwo.thumbnail },
  { id: "sudowoodo", name: "Sudowoodo · Outono", description: "Folhas douradas, cachoeiras e um pôr do sol acolhedor.", accent: "#fdba74", background: "#24180f", thumbnail: THEME_ART.sudowoodo.thumbnail },
] as const;
export type SiteTheme = (typeof SITE_THEMES)[number]["id"];
export function normalizeSiteTheme(value: unknown): SiteTheme {
  return SITE_THEMES.find((theme) => theme.id === value)?.id ?? "padrao";
}
// Static, allow-listed initialization runs before paint, without a server cookie
// or database read. Never interpolate values read from storage into this script.
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});document.documentElement.dataset.theme=${JSON.stringify(SITE_THEMES.map((theme) => theme.id))}.includes(t)?t:"padrao"}catch(e){document.documentElement.dataset.theme="padrao"}`;
