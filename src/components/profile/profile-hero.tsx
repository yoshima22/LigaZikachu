import Link from "next/link";
import { ExternalLink, User } from "lucide-react";
import { RarityShimmer } from "@/components/ui/rarity-shimmer";
import { StatusBadge } from "@/components/ui/status-badge";
import { TitleDisplay, type TitleRarity, type TitleTheme } from "@/components/ui/title-display";

type VisualItem = {
  name: string;
  imageUrl: string | null;
  metadata: unknown;
  rarity?: string;
  theme?: string | null;
  flavorText?: string | null;
  entranceEffect?: string | null;
};

type OrderStamp = {
  displayedCode: string;
  greenIndex: number;
} | null;

export function ProfileHero({
  player,
  banner,
  frame,
  title,
  status,
  role,
  seasonName,
  orderStamp,
  graffiti = false,
  actionHref,
  actionLabel,
}: {
  player: { displayName: string; ptcglNick: string | null; avatarUrl: string | null };
  banner?: VisualItem;
  frame?: VisualItem;
  title?: VisualItem;
  status: { variant: "active" | "pending" | "suspended" | "rejected" | "draft" | "info"; label: string };
  role?: string;
  seasonName?: string | null;
  orderStamp?: OrderStamp;
  graffiti?: boolean;
  actionHref?: string;
  actionLabel?: string;
}) {
  const AVATAR = 80;
  const AVATAR_LEFT = 20;
  const STATUS_HEIGHT = 44;
  const frameMeta = frame?.metadata as { frameScale?: number; frameOffsetX?: number; frameOffsetY?: number } | null | undefined;
  const frameScale = frameMeta?.frameScale ?? 2;
  const frameSize = AVATAR * frameScale;
  const anchorLeft = AVATAR / 2 + (frameMeta?.frameOffsetX ?? 0);
  const anchorTop = AVATAR / 2 + (frameMeta?.frameOffsetY ?? 0);
  const bannerMeta = banner?.metadata as { brightnessPct?: number; focusX?: number; focusY?: number } | null | undefined;
  const bannerRarity = banner?.rarity ?? "COMMON";
  const frameRarity = frame?.rarity ?? "COMMON";

  return (
    <div data-tutorial="profile-avatar" className="relative rounded-2xl border border-border bg-slate-950">
      {graffiti && !orderStamp && (
        <div className="pointer-events-none absolute right-4 top-4 z-30 rotate-6 rounded-xl border-2 border-purple-400/60 bg-purple-950/80 px-4 py-2 text-center shadow-[0_0_24px_rgba(168,85,247,0.35)]">
          <p className="text-[10px] uppercase tracking-[0.2em] text-purple-200">Ordem da Trapaça</p>
          <p className="font-pixel text-lg text-[#FFCB05]">TRAPACEADO</p>
        </div>
      )}
      {orderStamp && (
        <div className="absolute right-4 top-4 z-40 rotate-3 rounded-2xl border-2 border-[#FFCB05]/60 bg-slate-950/90 px-4 py-3 text-center shadow-[0_0_28px_rgba(255,203,5,0.28)]">
          <p className="text-[10px] uppercase tracking-[0.24em] text-purple-200">Ordem da Trapaça</p>
          <p className="font-pixel text-lg leading-none text-[#FFCB05]">TRAPACEADO</p>
          <div className="mt-2 flex items-center justify-center gap-1 font-pixel text-xl">
            {orderStamp.displayedCode.split("").map((digit, index) => (
              <span
                key={`${digit}-${index}`}
                className="text-[#FFCB05]"
                style={index === orderStamp.greenIndex ? { WebkitTextStroke: "1px #FFF4A3", textShadow: "0 0 8px rgba(255,203,5,0.65)" } : undefined}
              >
                {digit}
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        className="relative overflow-hidden rounded-2xl"
        style={{ height: banner?.imageUrl ? "clamp(180px, 25vw, 280px)" : 160 }}
      >
        {banner?.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={banner.imageUrl}
              alt="Banner"
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                filter: `brightness(${Math.min(300, Math.max(50, bannerMeta?.brightnessPct ?? 115)) / 100})`,
                objectPosition: `${bannerMeta?.focusX ?? 50}% ${bannerMeta?.focusY ?? 50}%`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f1a]/85 via-[#0f0f1a]/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a]/80 via-transparent to-transparent" />
            {(["RARE", "EPIC", "LEGENDARY"] as string[]).includes(bannerRarity) && (
              <RarityShimmer rarity={bannerRarity} className="absolute inset-0" />
            )}
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />
        )}

        <div className="absolute bottom-0 left-0 right-0 p-5" style={{ paddingLeft: AVATAR_LEFT + AVATAR + 20 }}>
          <h1 className="text-2xl font-bold leading-tight text-white drop-shadow-lg">{player.displayName}</h1>
          {title && (
            <div className="mt-0.5">
              <TitleDisplay
                name={title.name}
                rarity={(title.rarity ?? "COMMON") as TitleRarity}
                theme={(title.theme ?? "NEUTRAL") as TitleTheme}
                flavorText={title.flavorText ?? null}
                context="profile"
                entranceEffect={title.entranceEffect ?? "NONE"}
              />
            </div>
          )}
          {player.ptcglNick && <p className="text-sm text-slate-300/80 drop-shadow">@{player.ptcglNick}</p>}
        </div>
      </div>

      <div className="absolute z-20" style={{ left: AVATAR_LEFT, bottom: STATUS_HEIGHT }}>
        <div className="relative" style={{ width: AVATAR, height: AVATAR }}>
          <div className="overflow-hidden rounded-2xl border-2 border-[#0f0f1a]/80 bg-slate-700 shadow-xl" style={{ width: AVATAR, height: AVATAR }}>
            {player.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.avatarUrl} alt={player.displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center"><User size={32} className="text-slate-400" /></div>
            )}
          </div>
          {frame?.imageUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={frame.imageUrl}
                alt="Moldura"
                className="pointer-events-none absolute z-10 object-contain"
                style={{ left: anchorLeft, top: anchorTop, width: frameSize, height: frameSize, maxWidth: "none", maxHeight: "none", transform: "translate(-50%, -50%)" }}
              />
              {(["RARE", "EPIC", "LEGENDARY"] as string[]).includes(frameRarity) && (
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute z-20 ${frameRarity === "LEGENDARY" ? "glint-legendary" : frameRarity === "EPIC" ? "glint-epic" : "glint-rare"}`}
                  style={{
                    left: anchorLeft,
                    top: anchorTop,
                    width: frameSize,
                    height: frameSize,
                    maxWidth: "none",
                    maxHeight: "none",
                    transform: "translate(-50%, -50%)",
                    background: frameRarity === "LEGENDARY"
                      ? "linear-gradient(105deg, transparent 25%, rgba(253,224,71,0.25) 42%, rgba(255,255,255,0.65) 50%, rgba(253,224,71,0.25) 58%, transparent 75%)"
                      : frameRarity === "EPIC"
                        ? "linear-gradient(105deg, transparent 25%, rgba(192,132,252,0.22) 42%, rgba(255,255,255,0.55) 50%, rgba(192,132,252,0.22) 58%, transparent 75%)"
                        : "linear-gradient(105deg, transparent 25%, rgba(147,197,253,0.20) 42%, rgba(255,255,255,0.55) 50%, rgba(147,197,253,0.20) 58%, transparent 75%)",
                  }}
                />
              )}
            </>
          )}
          {frame && !frame.imageUrl && <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-[#FFCB05]" />}
        </div>
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 bg-slate-950/60"
        style={{ height: STATUS_HEIGHT, paddingLeft: AVATAR_LEFT + AVATAR + 16, paddingRight: 20 }}
      >
        <div className="flex flex-wrap gap-2">
          <StatusBadge variant={status.variant} label={status.label} />
          {role && role !== "PLAYER" && <StatusBadge variant="info" label={role} />}
          {seasonName && <StatusBadge variant="draft" label={seasonName} />}
        </div>
        {actionHref && actionLabel && (
          <Link href={actionHref} className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-[#FFCB05]/40 hover:text-[#FFCB05]">
            <ExternalLink size={12} /> {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
