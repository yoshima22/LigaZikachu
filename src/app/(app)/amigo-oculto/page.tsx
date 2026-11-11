import { redirect } from "next/navigation";
import { getSsAdmin, getView } from "@/lib/amigo-oculto/service";
import { AmigoClient } from "./_components/amigo-client";

export const dynamic = "force-dynamic";

// Fechado ao público: só admin entra; as actions repetem a checagem.
export default async function AmigoOcultoPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const admin = await getSsAdmin();
  if (!admin) redirect("/dashboard");
  const { e } = await searchParams;
  const view = await getView(e);
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-3 py-6 sm:px-4 sm:py-8">
      <AmigoClient view={JSON.parse(JSON.stringify(view))} myPlayerName={admin.displayName} />
    </main>
  );
}
