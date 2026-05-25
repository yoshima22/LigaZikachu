import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 px-6 py-12">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-primary">
            Liga Zikachu
          </span>
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl">
              Temporadas, partidas e ranking auditável em um único app.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
              Base inicial do projeto com Next.js, Prisma, Auth.js e estrutura pronta para evoluir o MVP da liga.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/login">
              <Button>Entrar</Button>
            </Link>
            <a href="#stack">
              <Button variant="outline">Ver stack base</Button>
            </a>
          </div>
        </div>
        <Card>
          <CardTitle>Base já preparada</CardTitle>
          <CardDescription className="mt-2">
            Autenticação, schema Prisma completo, seed inicial, páginas públicas/protegidas e documento técnico da Fase 0.
          </CardDescription>
          <ul className="mt-6 space-y-3 text-sm text-slate-200">
            <li>• Auth.js com email e senha</li>
            <li>• PostgreSQL + Prisma + seed inicial</li>
            <li>• Dashboard protegido e fluxo de aprovação</li>
            <li>• Plano técnico salvo em `docs/plano-fase-0.md`</li>
          </ul>
        </Card>
      </section>

      <section id="stack" className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Auth centralizado",
            description: "Roles, status de aprovação e providers no mesmo app."
          },
          {
            title: "Modelo multi-temporada",
            description: "Entidades prontas para temporadas, semanas, decks, desafios e auditoria."
          },
          {
            title: "Teste sem setup local pesado",
            description: "Estrutura alinhada a preview deploy na Vercel e PWA instalável."
          }
        ].map((item) => (
          <Card key={item.title}>
            <CardTitle>{item.title}</CardTitle>
            <CardDescription className="mt-2">{item.description}</CardDescription>
          </Card>
        ))}
      </section>
    </main>
  );
}
