import { redirect } from "next/navigation";
import { loadPackages } from "@/lib/amigo-oculto/catalog-db";
import { getSsAdmin, getView, kitItemChoices } from "@/lib/amigo-oculto/service";
import { AmigoClient } from "../_components/amigo-client";

export const dynamic = "force-dynamic";

// Painel de teste/depuração: só admin; as actions repetem a checagem.
export default async function AmigoOcultoAdminPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const admin = await getSsAdmin();
  if (!admin) redirect("/dashboard");
  const { e } = await searchParams;
  const view = await getView(e);
  const [packages, choices] = await Promise.all([loadPackages(view.edition?.cfg.kits), kitItemChoices()]);
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-3 py-6 sm:px-4 sm:py-8">
      <AmigoClient view={JSON.parse(JSON.stringify(view))} packages={packages} choices={choices} myPlayerName={admin.displayName} />
    </main>
  );
}
