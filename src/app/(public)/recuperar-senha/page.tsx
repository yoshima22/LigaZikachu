"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "./actions";
import { CheckCircle2, Mail } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Enviando…" : "Enviar e-mail de recuperação"}
    </Button>
  );
}

export default function RecoverPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, undefined);

  if (state?.success) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
        <Card className="w-full space-y-4 text-center">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
              <Mail size={24} className="text-emerald-400" />
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-white">Verifique seu e-mail</CardTitle>
            <CardDescription>
              Se existe uma conta com esse e-mail, você receberá as instruções em breve.
              O link expira em <strong className="text-slate-300">1 hora</strong>.
            </CardDescription>
          </div>
          <p className="text-xs text-slate-500">
            Não recebeu? Verifique a pasta de spam ou aguarde alguns minutos.
          </p>
          <Link href="/login" className="block text-sm text-primary hover:underline">
            Voltar para login
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <Card className="w-full space-y-4">
        <div className="space-y-2">
          <span className="text-sm font-medium uppercase tracking-[0.25em] text-primary">Recuperação</span>
          <CardTitle>Esqueci minha senha</CardTitle>
          <CardDescription>
            Digite seu e-mail cadastrado. Você receberá um link para criar uma nova senha.
          </CardDescription>
        </div>

        <div className="h-px bg-border" />

        <form action={action} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">E-mail da conta</label>
            <input
              name="email"
              type="email"
              required
              placeholder="seu@email.com"
              className="w-full rounded-xl border border-border bg-slate-800 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {state?.error && <p className="text-xs text-red-400">{state.error}</p>}

          <SubmitButton />
        </form>

        <Link href="/login" className="block text-center text-sm text-slate-400 hover:text-white">
          Voltar para login
        </Link>
      </Card>
    </main>
  );
}
