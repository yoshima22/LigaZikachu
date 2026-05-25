import Link from "next/link";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { signInWithCredentials } from "./actions";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <Card className="w-full">
        <div className="space-y-2">
          <span className="text-sm font-medium uppercase tracking-[0.25em] text-primary">Liga Zikachu</span>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>Use email e senha. Novos acessos entram como pendentes até aprovação do admin.</CardDescription>
        </div>

        <div className="my-6 h-px bg-border" />

        <SignInForm action={signInWithCredentials} />

        <div className="mt-6 flex items-center justify-between text-sm text-slate-300">
          <Link href="/recuperar-senha" className="hover:text-white">
            Esqueci minha senha
          </Link>
          <Link href="/criar-conta" className="hover:text-white">
            Criar conta
          </Link>
        </div>
      </Card>
    </main>
  );
}
