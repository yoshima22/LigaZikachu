import { redirect } from "next/navigation";
import { REI_ASSETS } from "@/lib/rei-do-rio/assets";
import { getReiAdmin } from "@/lib/rei-do-rio/service";
import { listEditions } from "@/lib/rei-do-rio/view";
import { ReiClient } from "./_components/rei-client";

export const dynamic = "force-dynamic";

// Guard no servidor: o modo é fechado ao público nesta etapa. Jogadores comuns (e GMs) voltam para /combates;
// as server actions repetem a checagem.
export default async function ReiDoRioPage() {
  const admin = await getReiAdmin();
  if (!admin) redirect("/combates");
  const editions = await listEditions();
  return (
    <main className="mx-auto max-w-7xl space-y-4 px-3 py-6 sm:px-4 sm:py-8">
      <ReiClient editions={editions} banner={REI_ASSETS.banner} />
    </main>
  );
}
