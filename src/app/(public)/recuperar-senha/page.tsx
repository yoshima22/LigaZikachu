import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function RecoverPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <Card className="w-full space-y-4">
        <div className="space-y-2">
          <span className="text-sm font-medium uppercase tracking-[0.25em] text-primary">Recuperação</span>
          <CardTitle>Fluxo base preparado</CardTitle>
          <CardDescription>
            A etapa de envio real por email entra na próxima implementação. O app já reserva rota e modelagem para tokens de recuperação.
          </CardDescription>
        </div>
        <p className="text-sm text-slate-300">
          No MVP, o reset será feito com token por email usando Auth.js e `verification_tokens`.
        </p>
        <Link href="/login" className="text-sm font-medium text-primary">
          Voltar para login
        </Link>
      </Card>
    </main>
  );
}
