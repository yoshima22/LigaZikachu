"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";

type FormState = { error?: string; success?: boolean };

export function SignInForm({
  defaultState
}: {
  action?: (state: FormState | undefined, formData: FormData) => Promise<FormState | undefined>;
  defaultState?: FormState;
}) {
  const [state, setState] = useState<FormState | undefined>(defaultState);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState(undefined);

    const formData = new FormData(event.currentTarget);
    const identifier = String(formData.get("identifier") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const response = await fetch("/api/auth/manual-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        const baseError = typeof payload.error === "string" ? payload.error : "Nao foi possivel autenticar.";
        const code = typeof payload.code === "string" ? ` (${payload.code})` : ` (HTTP ${response.status})`;
        setState({ error: `${baseError}${code}` });
        return;
      }

      setState({ success: true });
      if (payload.sessionToken) {
        try { localStorage.setItem("lz_session_backup", payload.sessionToken); } catch {}
      }
      window.location.assign("/dashboard");
    } catch (error) {
      console.error("[LoginForm] manual login failed", error);
      setState({ error: "Erro interno. Tente novamente em alguns instantes." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="identifier">
          Email ou nick do PTCG Live
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          required
          autoComplete="username"
          className="h-11 w-full rounded-xl border border-border bg-slate-950/60 px-3 text-sm text-white outline-none ring-0 transition focus:border-primary"
          placeholder="voce@email.com ou SeuNickPTCG"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          className="h-11 w-full rounded-xl border border-border bg-slate-950/60 px-3 text-sm text-white outline-none ring-0 transition focus:border-primary"
          placeholder="********"
        />
      </div>
      {state?.error && <p className="text-sm text-rose-300">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-300">Login realizado. Abrindo dashboard...</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
