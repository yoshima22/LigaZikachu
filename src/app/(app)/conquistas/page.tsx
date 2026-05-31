import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth/permissions";
import { auth } from "@/auth";
import Link from "next/link";
import { Award, Lock, Plus, Star, Trophy, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AchievementsAdminPanel } from "./_components/achievements-admin-panel";
import { RewardManager } from "./_components/reward-manager";
import { MyAchievementsPanel } from "./_components/my-achievements-panel";
import { RulesManager } from "./_components/rules-manager";

export const dynamic = "force-dynamic";

const rarityColors: Record<string, string> = {
  COMMON:    "border-slate-600 text-slate-400",
  UNCOMMON:  "border-[#7AC74C]/50 text-[#7AC74C]",
  RARE:      "border-[#6390F0]/50 text-[#6390F0]",
  EPIC:      "border-[#735797]/60 text-[#735797]",
  LEGENDARY: "border-[#FFCB05]/60 text-[#FFCB05]",
  SECRET:    "border-slate-700 text-slate-600"
};

const categoryIcons: Record<string, React.ReactNode> = {
  TOURNAMENT: <Trophy size={14} />,
  COLLECTION: <Star size={14} />,
  SOCIAL:     <Zap size={14} />,
  ENGAGEMENT: <Zap size={14} />,
  COSMETIC:   <Award size={14} />,
  SPECIAL:    <Award size={14} />
};

export default async function ConquistasPage() {
  const session = await auth();
  if (!session?.user) return null;

  const adminUser = isAdmin(session.user.role);

  const [achievements, players, seasons, myAchievements, shopItems] = await Promise.all([
    prisma.achievement.findMany({
      where: adminUser ? {} : { active: true, isSecret: false },
      include: {
        rewards: true,
        rules: true,
        _count: { select: { playerAchievements: true } }
      },
      orderBy: [{ rarity: "asc" }, { name: "asc" }]
    }),
    adminUser
      ? prisma.player.findMany({ select: { id: true, displayName: true }, orderBy: { displayName: "asc" } })
      : [],
    adminUser
      ? prisma.season.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" }, take: 5 })
      : [],
    // Conquistas do próprio usuário
    prisma.playerAchievement.findMany({
      where: { player: { userId: session.user.id } },
      include: { achievement: { select: { id: true, name: true, rarity: true, iconUrl: true } } },
      orderBy: { awardedAt: "desc" }
    }).catch(() => []),
    // Itens do shop para configurar recompensas
    adminUser
      ? prisma.shopItem.findMany({
          where: { active: true },
          select: { id: true, name: true, type: true },
          orderBy: { type: "asc" }
        })
      : []
  ]);

  const myAchievementIds = new Set(myAchievements.map(a => a.achievementId));

  const grouped = {
    TOURNAMENT: achievements.filter(a => a.category === "TOURNAMENT"),
    COLLECTION: achievements.filter(a => a.category === "COLLECTION"),
    SOCIAL:     achievements.filter(a => a.category === "SOCIAL"),
    ENGAGEMENT: achievements.filter(a => a.category === "ENGAGEMENT"),
    COSMETIC:   achievements.filter(a => a.category === "COSMETIC"),
    SPECIAL:    achievements.filter(a => a.category === "SPECIAL"),
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Liga Zikachu</p>
            <h1 className="font-pixel text-base text-[#FFCB05]">Conquistas</h1>
            <p className="mt-1 text-sm text-slate-400">
              {myAchievements.length} conquistadas · {achievements.filter(a => a.active).length} disponíveis
            </p>
          </div>
          {myAchievements.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {myAchievements.slice(0, 5).map(a => (
                <div key={a.id} title={a.achievement.name}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${rarityColors[a.achievement.rarity]}`}>
                  {a.achievement.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Minhas conquistas — vitrine do jogador */}
      {!adminUser && myAchievements.length > 0 && (
        <MyAchievementsPanel
          achievements={myAchievements.map(a => ({
            id: a.id,
            name: a.achievement.name,
            rarity: a.achievement.rarity,
            iconUrl: a.achievement.iconUrl ?? null,
            isHighlighted: a.isHighlighted,
            unlockedAt: a.awardedAt.toISOString()
          }))}
        />
      )}

      {/* Painel Admin */}
      {adminUser && (
        <>
          <AchievementsAdminPanel
            achievements={achievements.map(a => ({
              id: a.id, key: a.key, name: a.name, description: a.description ?? null,
              type: a.type, rarity: a.rarity, category: a.category, scope: a.scope,
              isSecret: a.isSecret, isRepeatable: a.isRepeatable, active: a.active,
              suggestedPoints: a.suggestedPoints, iconUrl: a.iconUrl ?? null,
              playersCount: a._count.playerAchievements
            }))}
            players={players}
            seasons={seasons}
          />
          <RulesManager
            achievements={achievements.map(a => ({
              id: a.id, name: a.name, type: a.type,
              rules: (a as { rules?: Array<{ id: string; eventType: string; targetValue: number; metadataFilter?: unknown }> }).rules?.map(r => ({
                id: r.id, eventType: r.eventType, targetValue: r.targetValue,
                metadataFilter: r.metadataFilter as Record<string, unknown> | null
              })) ?? []
            }))}
          />
          <RewardManager
            achievements={achievements.map(a => ({
              id: a.id, name: a.name,
              rewards: a.rewards.map(r => ({
                id: r.id, rewardType: r.rewardType, rewardAmount: r.rewardAmount,
                rewardItemId: r.rewardItemId, titleText: r.titleText, deliverViaGift: r.deliverViaGift
              }))
            }))}
            shopItems={shopItems}
          />
        </>
      )}

      {/* Conquistas por categoria */}
      {Object.entries(grouped).map(([cat, items]) => {
        if (items.length === 0) return null;
        return (
          <div key={cat} className="space-y-3">
            <h2 className="flex items-center gap-2 font-semibold text-slate-200">
              {categoryIcons[cat]}
              {cat === "TOURNAMENT" ? "Torneio" : cat === "COLLECTION" ? "Coleção" : cat === "SOCIAL" ? "Social" : cat === "ENGAGEMENT" ? "Engajamento" : cat === "COSMETIC" ? "Cosméticos" : "Especiais"}
              <span className="text-sm font-normal text-slate-500">({items.length})</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map(a => {
                const unlocked = myAchievementIds.has(a.id);
                const locked = a.isSecret && !unlocked;
                return (
                  <div key={a.id} className={`rounded-xl border p-4 transition-all ${
                    locked ? "border-slate-800 bg-slate-950/30 opacity-60" :
                    unlocked ? `${rarityColors[a.rarity]?.split(" ")[0]} bg-slate-950/80` :
                    "border-border bg-slate-950/50"
                  }`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${rarityColors[a.rarity]}`}>
                        {a.rarity}
                      </div>
                      {unlocked && <span className="text-[#FFCB05] text-sm">✓</span>}
                      {locked && <Lock size={12} className="text-slate-600" />}
                    </div>
                    <p className="font-semibold text-sm text-slate-200">
                      {locked ? "???" : a.name}
                    </p>
                    {!locked && a.description && (
                      <p className="mt-1 text-xs text-slate-400 line-clamp-2">{a.description}</p>
                    )}
                    {a.suggestedPoints && !locked && (
                      <p className="mt-2 text-[10px] text-[#FFCB05]">+{a.suggestedPoints}pts sugeridos</p>
                    )}
                    {a._count.playerAchievements > 0 && (
                      <p className="mt-1 text-[10px] text-slate-600">{a._count.playerAchievements} jogador(es)</p>
                    )}
                    {!a.active && adminUser && (
                      <span className="mt-1 inline-block text-[10px] text-slate-600">[inativa]</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {achievements.length === 0 && (
        <Card className="p-8 text-center">
          <Award size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-500">Nenhuma conquista cadastrada ainda.</p>
          {adminUser && <p className="mt-1 text-xs text-slate-600">Use o painel acima para criar as primeiras conquistas.</p>}
        </Card>
      )}
    </div>
  );
}
