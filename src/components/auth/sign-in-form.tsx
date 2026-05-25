"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type FormState = {
  error?: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Entrando..." : "Entrar com email e senha"}
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

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="h-11 w-full rounded-xl border border-border bg-slate-950/60 px-3 text-sm text-white outline-none ring-0 transition focus:border-primary"
          placeholder="voce@ligazikachu.com"
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
          className="h-11 w-full rounded-xl border border-border bg-slate-950/60 px-3 text-sm text-white outline-none ring-0 transition focus:border-primary"
          placeholder="********"
        />
      </div>
      {state?.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
