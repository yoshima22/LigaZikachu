import { auth } from "@/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>Status da conta</CardTitle>
          <CardDescription className="mt-2">
            {session?.user.status === "ACTIVE"
              ? "Acesso liberado para participar das próximas implementações do MVP."
              : "Conta autenticada, mas aguardando aprovação para operar a liga."}
          </CardDescription>
        </Card>
        <Card>
          <CardTitle>Escopo inicial entregue</CardTitle>
          <CardDescription className="mt-2">
            Base com Prisma, Auth.js, seed e rotas públicas/protegidas concluída.
          </CardDescription>
        </Card>
        <Card>
          <CardTitle>Próximos módulos</CardTitle>
          <CardDescription className="mt-2">
            Jogadores, temporadas, semanas, partidas, ranking e painel admin.
          </CardDescription>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardTitle>Mapa da Fase 1</CardTitle>
          <CardDescription className="mt-2">
            A fundação já suporta a evolução para as telas e fluxos principais definidos no plano aprovado.
          </CardDescription>
          <ul className="mt-4 space-y-2 text-sm text-slate-200">
            <li>• Autenticação com aprovação</li>
            <li>• Estrutura multi-temporada pronta no banco</li>
            <li>• Seeds para smoke test do ranking e códigos</li>
            <li>• Documento técnico consolidado em `docs/plano-fase-0.md`</li>
          </ul>
        </Card>
        <Card>
          <CardTitle>Checklist de smoke test</CardTitle>
          <CardDescription className="mt-2">
            Login, acesso protegido, leitura do dashboard e validação de seed em staging.
          </CardDescription>
        </Card>
      </section>
    </div>
  );
}
