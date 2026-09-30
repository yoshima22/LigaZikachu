export const THEME_STORAGE_KEY = "liga-zikachu:site-theme";
export const SITE_THEMES = [
  { id: "padrao", name: "Padrão", description: "A identidade original da Liga: dourado e azul profundo.", accent: "#ffcb05", background: "#0f0f1a" },
  { id: "tecnologico", name: "Tecnológico", description: "Violeta, azul e linhas digitais para uma atmosfera futurista.", accent: "#a78bfa", background: "#080b26" },
  { id: "claro", name: "Claro", description: "Fundo claro e detalhes dourados, com painéis escuros de alto contraste.", accent: "#ffcb05", background: "#eaf2ff" },
  { id: "competitivo", name: "Competitivo", description: "Vermelho e grafite para entrar no clima da competição.", accent: "#f87171", background: "#140c10" },
] as const;
export type SiteTheme = (typeof SITE_THEMES)[number]["id"];
export function normalizeSiteTheme(value: unknown): SiteTheme {
  return SITE_THEMES.find((theme) => theme.id === value)?.id ?? "padrao";
}
// Static, allow-listed initialization runs before paint, without a server cookie
// or database read. Never interpolate values read from storage into this script.
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});document.documentElement.dataset.theme=${JSON.stringify(SITE_THEMES.map((theme) => theme.id))}.includes(t)?t:"padrao"}catch(e){document.documentElement.dataset.theme="padrao"}`;
