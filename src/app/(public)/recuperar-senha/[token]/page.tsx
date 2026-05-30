"use client";

import { useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { resetPassword } from "../actions";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    startTransition(async () => {
      const result = await resetPassword({ token: params.token, password });
      if (result.error) {
        setError(result.error);
      } else {
        setDone(true);
        setTimeout(() => router.push("/login"), 3000);
      }
    });
  };

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
        <Card className="w-full space-y-4 text-center">
          <CardTitle className="text-[#7AC74C]">Senha redefinida!</CardTitle>
          <CardDescription>Você será redirecionado para o login em instantes.</CardDescription>
          <Link href="/login" className="block text-sm text-primary hover:underline">Ir para login agora</Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <Card className="w-full space-y-4">
        <div className="space-y-2">
          <span className="text-sm font-medium uppercase tracking-[0.25em] text-primary">Recuperação</span>
          <CardTitle>Nova senha</CardTitle>
          <CardDescription>Digite a nova senha para esta conta.</CardDescription>
        </div>

        <div className="h-px bg-border" />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Nova senha</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-slate-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Confirmar nova senha</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-border bg-slate-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
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
    </main>
  );
}
