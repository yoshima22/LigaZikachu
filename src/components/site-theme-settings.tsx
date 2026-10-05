"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { HEADER_LAYOUT_STORAGE_KEY, SITE_THEMES, THEMES_PER_PAGE, THEME_STORAGE_KEY, normalizeSiteTheme, type SiteTheme } from "@/lib/site-theme";

type HeaderLayout = "classic" | "stacked";
const HEADER_LAYOUTS: { id: HeaderLayout; name: string; description: string }[] = [
  { id: "classic", name: "Modo antigo", description: "Menu em uma linha ao lado da logo, no PC. Se não couber (por exemplo, com o menu Admin), o espaçamento é ajustado sozinho." },
  { id: "stacked", name: "Modo padrão", description: "Logo e dados do jogador em cima, e o menu em botões numa segunda linha, embaixo." },
];

const pageFor = (theme: SiteTheme) => Math.floor(SITE_THEMES.findIndex((item) => item.id === theme) / THEMES_PER_PAGE);

export function SiteThemeSettings() {
  const [selected, setSelected] = useState<SiteTheme>("padrao");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(0);
  const [headerLayout, setHeaderLayout] = useState<HeaderLayout>("classic");
  const pageCount = Math.ceil(SITE_THEMES.length / THEMES_PER_PAGE);
  useEffect(() => {
    const initial = normalizeSiteTheme(document.documentElement.dataset.theme);
    setSelected(initial);
    setPage(pageFor(initial));
    setHeaderLayout(document.documentElement.dataset.headerLayout === "stacked" ? "stacked" : "classic");
    const sync = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      const theme = normalizeSiteTheme(event.newValue);
      document.documentElement.dataset.theme = theme;
      setSelected(theme);
      setPage(pageFor(theme));
      setMessage("");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function chooseHeader(layout: HeaderLayout) {
    document.documentElement.dataset.headerLayout = layout;
    setHeaderLayout(layout);
    try {
      localStorage.setItem(HEADER_LAYOUT_STORAGE_KEY, layout);
      setMessage("Cabeçalho aplicado e salvo neste navegador.");
    } catch {
      setMessage("Cabeçalho aplicado. O navegador bloqueou o armazenamento; a escolha poderá ser perdida ao recarregar.");
    }
  }

  function choose(theme: SiteTheme) {
    document.documentElement.dataset.theme = theme;
    setSelected(theme);
    setPage(pageFor(theme));
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      setMessage("Tema aplicado e salvo neste navegador.");
    } catch {
      setMessage("Tema aplicado. O navegador bloqueou o armazenamento; a escolha poderá ser perdida ao recarregar.");
    }
  }

  return (
    <section className="theme-settings" aria-labelledby="site-theme-title">
      <p className="theme-settings-eyebrow">Configurações • Aparência</p>
      <h2 id="site-theme-title">Seu jogo, seu estilo</h2>
      <p className="theme-settings-description">Escolha o tema do site. A mudança aparece na hora e não altera seus dados de jogo.</p>
      <button type="button" className="theme-reset" onClick={() => choose("padrao")}>
        ↶ Restaurar padrão original
      </button>
      <p className="theme-settings-note">Tema ativo: <strong>{SITE_THEMES.find((theme) => theme.id === selected)?.name}</strong></p>
      <fieldset className="theme-options" id="site-theme-options">
        <legend className="sr-only">Tema do site</legend>
        {SITE_THEMES.slice(page * THEMES_PER_PAGE, (page + 1) * THEMES_PER_PAGE).map((theme) => (
          <label key={theme.id} className="theme-option" data-selected={selected === theme.id} style={{ "--preview-accent": theme.accent, "--preview-background": theme.background } as CSSProperties}>
            <input type="radio" name="site-theme" value={theme.id} checked={selected === theme.id} onChange={() => choose(theme.id)} />
            <span className="theme-preview" aria-hidden="true">
              <span className="theme-preview-nav"><span /> LIGA ZIKACHU</span>
              <span className="theme-preview-panel"><span /> <span /><span /></span>
              <span className="theme-preview-tabs"><i /><i /><i /></span>
            </span>
            <span className="theme-option-heading">{theme.name}<span>{selected === theme.id ? "✓ Ativo" : "Selecionar"}</span></span>
            <span className="theme-option-description">{theme.description}</span>
          </label>
        ))}
      </fieldset>
      <nav className="theme-pagination" aria-label="Páginas de temas">
        <button type="button" disabled={page === 0} aria-controls="site-theme-options" onClick={() => setPage((value) => value - 1)}>Anterior</button>
        <span aria-live="polite">Página {page + 1} de {pageCount}</span>
        <button type="button" disabled={page === pageCount - 1} aria-controls="site-theme-options" onClick={() => setPage((value) => value + 1)}>Próxima</button>
      </nav>
      <div className="mt-6 border-t border-[color:var(--theme-line)] pt-5">
        <h3 className="text-sm font-bold">Cabeçalho do site (PC)</h3>
        <p className="theme-settings-description">Escolha como o menu do topo aparece no computador. Nos dois modos há o botão Minimizar. No celular nada muda.</p>
        <fieldset className="theme-options mt-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))" }}>
          <legend className="sr-only">Modo do cabeçalho</legend>
          {HEADER_LAYOUTS.map((layout) => (
            <label key={layout.id} className="theme-option" data-selected={headerLayout === layout.id} style={{ "--preview-accent": "#ffcb05", "--preview-background": "#0f0f1a" } as CSSProperties}>
              <input type="radio" name="header-layout" value={layout.id} checked={headerLayout === layout.id} onChange={() => chooseHeader(layout.id)} />
              <span className="theme-option-heading">{layout.name}<span>{headerLayout === layout.id ? "✓ Ativo" : "Selecionar"}</span></span>
              <span className="theme-option-description">{layout.description}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <p className="theme-settings-note">Salvo somente neste navegador, sem sincronização entre dispositivos. Não é necessário clicar em salvar perfil.</p>
      <p className="theme-settings-status" role="status" aria-live="polite">{message}</p>
    </section>
  );
}
