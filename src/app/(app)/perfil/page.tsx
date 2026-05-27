import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { EditProfileForm } from "./_components/edit-profile-form";

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user) return null;

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      displayName: true,
      ptcglNick: true,
      avatarUrl: true,
      email: true,
    },
  });

  if (!player) {
    return (
      <div className="space-y-6">
        <h1 className="font-pixel text-base text-[#FFCB05]">Perfil</h1>
        <Card className="p-6">
          <p className="text-slate-400">Perfil de jogador nao encontrado.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {player.avatarUrl ? (
          <img
            src={player.avatarUrl}
            alt={player.displayName}
            className="h-16 w-16 rounded-full object-cover border-2 border-[#FFCB05]/30"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#FFCB05] to-[#FFD700] flex items-center justify-center text-[#1A1A2E] font-bold text-xl">
            {player.displayName.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="font-pixel text-base text-[#FFCB05]">{player.displayName}</h1>
          <p className="text-sm text-slate-400">{player.ptcglNick || "Sem nick do jogo"}</p>
        </div>
      </div>

      <Card className="p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Editar perfil</h2>
        <EditProfileForm player={player} />
      </Card>
    </div>
  );
}
