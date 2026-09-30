"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { SITE_THEMES, THEME_STORAGE_KEY, normalizeSiteTheme, type SiteTheme } from "@/lib/site-theme";

export function SiteThemeSettings() {
  const [selected, setSelected] = useState<SiteTheme>("padrao");
  const [message, setMessage] = useState("");
  useEffect(() => {
    setSelected(normalizeSiteTheme(document.documentElement.dataset.theme));
    const sync = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      const theme = normalizeSiteTheme(event.newValue);
      document.documentElement.dataset.theme = theme;
      setSelected(theme);
      setMessage("");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function choose(theme: SiteTheme) {
    document.documentElement.dataset.theme = theme;
    setSelected(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      setMessage("Tema aplicado e salvo neste navegador.");
    } catch {
      setMessage("Tema aplicado. O navegador bloqueou o armazenamento; a escolha poderá ser perdida ao recarregar.");
    }
  }

  return (
    <section className="theme-settings" aria-labelledby="site-theme-title">
      <p className="theme-settings-eyebrow">Configurações • Aparência • Teste admin</p>
      <h2 id="site-theme-title">Seu jogo, seu estilo</h2>
      <p className="theme-settings-description">Escolha o tema do site. A mudança aparece na hora e não altera seus dados de jogo.</p>
      <fieldset className="theme-options">
        <legend className="sr-only">Tema do site</legend>
        {SITE_THEMES.map((theme) => (
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
      <p className="theme-settings-note">Salvo somente neste navegador, sem sincronização entre dispositivos. Não é necessário clicar em salvar perfil.</p>
      <p className="theme-settings-status" role="status" aria-live="polite">{message}</p>
    </section>
  );
}
