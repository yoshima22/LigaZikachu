"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "./actions";

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const resetLink = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/recuperar-senha/${token}`
    : "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await requestPasswordReset(email);
      if (result.error) {
        setError(result.error);
      } else if (result.token) {
        setToken(result.token);
      }
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(resetLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
        <Card className="w-full space-y-4">
          <div className="space-y-2">
            <span className="text-sm font-medium uppercase tracking-[0.25em] text-primary">Recuperação</span>
            <CardTitle>Link gerado</CardTitle>
            <CardDescription>
              Copie o link abaixo e envie para o admin no WhatsApp ou Discord. Ele vai usar o link para redefinir sua senha.
              O link expira em 24 horas.
            </CardDescription>
          </div>

          <div className="rounded-xl border border-border bg-slate-900 p-3 break-all text-xs text-slate-300">
            {resetLink}
          </div>

          <Button onClick={handleCopy} className="w-full">
            {copied ? "Copiado!" : "Copiar link"}
          </Button>

          <Link href="/login" className="block text-center text-sm text-slate-400 hover:text-white">
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
            Digite seu email para gerar um link de redefinição. Você precisará enviar esse link para o admin.
          </CardDescription>
        </div>

        <div className="h-px bg-border" />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Email da conta</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full rounded-xl border border-border bg-slate-800 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Gerando link…" : "Gerar link de recuperação"}
          </Button>
        </form>

        <Link href="/login" className="block text-center text-sm text-slate-400 hover:text-white">
          Voltar para login
        </Link>
      </Card>
    </main>
  );
}
