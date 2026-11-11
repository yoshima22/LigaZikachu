import { redirect } from "next/navigation";
import { loadPackages } from "@/lib/amigo-oculto/catalog-db";
import { getSsAdmin, getView } from "@/lib/amigo-oculto/service";
import { AmigoClient } from "../_components/amigo-client";

export const dynamic = "force-dynamic";

// Painel de teste/depuração: só admin; as actions repetem a checagem.
export default async function AmigoOcultoAdminPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const admin = await getSsAdmin();
  if (!admin) redirect("/dashboard");
  const { e } = await searchParams;
  const [view, packages] = await Promise.all([getView(e), loadPackages()]);
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-3 py-6 sm:px-4 sm:py-8">
      <AmigoClient view={JSON.parse(JSON.stringify(view))} packages={packages} myPlayerName={admin.displayName} />
    </main>
  );
}
