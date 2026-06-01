"use client";

import { useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { resetPassword } from "../recuperar-senha/actions";
import { CheckCircle2 } from "lucide-react";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!token) {
    return (
      <Card className="w-full space-y-4 text-center">
        <CardTitle className="text-red-400">Link inválido</CardTitle>
        <CardDescription>Este link de recuperação é inválido ou está incompleto.</CardDescription>
        <Link href="/recuperar-senha" className="block text-sm text-primary hover:underline">
          Solicitar novo link
        </Link>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="w-full space-y-4 text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
            <CheckCircle2 size={24} className="text-emerald-400" />
          </div>
        </div>
        <CardTitle className="text-white">Senha redefinida!</CardTitle>
        <CardDescription>Sua senha foi atualizada com sucesso. Você será redirecionado para o login.</CardDescription>
        <Link href="/login" className="block text-sm text-primary hover:underline">Ir para login agora</Link>
      </Card>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    startTransition(async () => {
      const result = await resetPassword({ token, password });
      if (result.error) {
        setError(result.error);
      } else {
        setDone(true);
        setTimeout(() => router.push("/login"), 3000);
      }
    });
  };

  return (
    <Card className="w-full space-y-4">
      <div className="space-y-2">
        <span className="text-sm font-medium uppercase tracking-[0.25em] text-primary">Liga Zikachu</span>
        <CardTitle>Criar nova senha</CardTitle>
        <CardDescription>Digite e confirme sua nova senha. Mínimo de 8 caracteres.</CardDescription>
      </div>
      <div className="h-px bg-border" />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs text-slate-400">Nova senha</label>
          <input type="password" required minLength={8} value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo de 8 caracteres"
            className="w-full rounded-xl border border-border bg-slate-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-slate-400">Confirmar nova senha</label>
          <input type="password" required minLength={8} value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repita a senha"
            className="w-full rounded-xl border border-border bg-slate-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Salvando…" : "Redefinir senha"}
        </Button>
      </form>
      <Link href="/login" className="block text-center text-sm text-slate-400 hover:text-white">
        Voltar para login
      </Link>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <Suspense fallback={<div className="text-slate-400">Carregando…</div>}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
