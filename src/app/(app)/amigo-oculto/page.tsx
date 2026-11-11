import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { currentEdition, playerView } from "@/lib/amigo-oculto/service";
import { getSessionPlayer } from "@/lib/session";
import { PlayerClient } from "./_components/player-client";

export const dynamic = "force-dynamic";

// Tela do jogador. Só aparece quando o admin publica a edição; até lá, só admin enxerga.
export default async function AmigoOcultoPage() {
  const user = await getSessionUser();
  if (!user) redirect("/dashboard");
  const player = await getSessionPlayer(user.id);
  if (!player) redirect("/dashboard");
  const admin = isAdmin(user.role);
  const edition = await currentEdition(admin);
  if (!edition) redirect("/dashboard");
  const view = await playerView(edition.id, player.id);
  if (!view) redirect("/dashboard");
  return (
    <main className="mx-auto max-w-4xl space-y-4 px-3 py-6 sm:px-4 sm:py-8">
      <PlayerClient view={JSON.parse(JSON.stringify(view))} isAdmin={admin} />
    </main>
  );
}
