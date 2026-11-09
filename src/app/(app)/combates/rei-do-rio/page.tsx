import { existsSync } from "node:fs";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { getReiAdmin } from "@/lib/rei-do-rio/service";
import { listEditions } from "@/lib/rei-do-rio/view";
import { ReiClient } from "./_components/rei-client";

export const dynamic = "force-dynamic";

// Banner opcional: só aparece quando o arquivo existir (nunca URL quebrada).
function findBanner() {
  for (const ext of ["webp", "png", "jpg", "jpeg"]) {
    if (existsSync(join(process.cwd(), "public", "events", "rei-do-rio", `banner.${ext}`))) return `/events/rei-do-rio/banner.${ext}`;
  }
  return null;
}

// Guard no servidor: o modo é fechado ao público nesta etapa. Jogadores comuns (e GMs) voltam para /combates;
// as server actions repetem a checagem.
export default async function ReiDoRioPage() {
  const admin = await getReiAdmin();
  if (!admin) redirect("/combates");
  const editions = await listEditions();
  return (
    <main className="mx-auto max-w-7xl space-y-4 px-3 py-6 sm:px-4 sm:py-8">
      <ReiClient editions={editions} banner={findBanner()} />
    </main>
  );
}
