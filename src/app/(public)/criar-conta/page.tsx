import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { registerWithCredentials } from "./actions";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <Card className="w-full">
        <div className="space-y-2">
          <span className="text-sm font-medium uppercase tracking-[0.25em] text-primary">Cadastro</span>
          <CardTitle>Criar conta</CardTitle>
          <CardDescription>
            Entre na Liga Zikachu com email e senha. O acesso fica pendente até aprovação do admin.
          </CardDescription>
        </div>
        <div className="mt-6">
          <RegisterForm action={registerWithCredentials} />
        </div>
        <div className="mt-6 text-sm text-slate-300">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-primary">
            Entrar
          </Link>
        </div>
      </Card>
    </main>
  );
}