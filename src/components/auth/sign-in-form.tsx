"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type FormState = { error?: string; success?: boolean };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Entrando..." : "Entrar"}
    </Button>
  );
}

export function SignInForm({
  action,
  defaultState
}: {
  action: (state: FormState | undefined, formData: FormData) => Promise<FormState | undefined>;
  defaultState?: FormState;
}) {
  const [state, formAction] = useActionState(action, defaultState);

  useEffect(() => {
    if (state?.success) {
      window.location.assign("/dashboard");
    }
  }, [state?.success]);

  return (
    <form action={formAction} className="space-y-4">
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
      <SubmitButton />
    </form>
  );
}
