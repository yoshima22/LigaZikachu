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
      {pending ? "Criando conta..." : "Criar conta"}
    </Button>
  );
}

export function RegisterForm({
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
        <label className="text-sm font-medium text-slate-200" htmlFor="name">
          Nome
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="h-11 w-full rounded-xl border border-border bg-slate-950/60 px-3 text-sm text-white outline-none transition focus:border-primary"
          placeholder="Seu nome"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="h-11 w-full rounded-xl border border-border bg-slate-950/60 px-3 text-sm text-white outline-none transition focus:border-primary"
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
          className="h-11 w-full rounded-xl border border-border bg-slate-950/60 px-3 text-sm text-white outline-none transition focus:border-primary"
          placeholder="Mínimo de 8 caracteres"
        />
      </div>
      {state?.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      <p className="text-xs text-slate-400">
        Após o cadastro, o acesso fica pendente até aprovação do admin.
      </p>
      <SubmitButton />
    </form>
  );
}