"use client";

import { cn } from "@/lib/utils";
import { Trophy, Users, CalendarDays } from "lucide-react";
import Link from "next/link";

export type TournamentCardStatus = "DRAFT" | "REGISTRATION_OPEN" | "IN_PROGRESS" | "FINISHED";

const statusConfig: Record<TournamentCardStatus, { label: string; bg: string; text: string; border: string }> = {
  DRAFT:             { label: "Rascunho",        bg: "bg-slate-500/15",  text: "text-slate-400",  border: "border-slate-500/30" },
  REGISTRATION_OPEN: { label: "Inscrições abertas", bg: "bg-[#7AC74C]/15", text: "text-[#7AC74C]", border: "border-[#7AC74C]/40" },
  IN_PROGRESS:       { label: "Em andamento",    bg: "bg-[#F7D02C]/15",  text: "text-[#F7D02C]",  border: "border-[#F7D02C]/40" },
  FINISHED:          { label: "Encerrado",        bg: "bg-[#6390F0]/15",  text: "text-[#6390F0]",  border: "border-[#6390F0]/40" }
};

interface TournamentCardProps {
  name: string;
  edition?: string | null;
  description?: string | null;
  status: TournamentCardStatus;
  slug: string;
  playerCount: number;
  maxPlayers?: number | null;
  startDate: Date | string;
  endDate?: Date | string | null;
  bannerColor?: string;
  className?: string;
}

export function TournamentCard({
  name,
  edition,
  description,
  status,
  slug,
  playerCount,
  maxPlayers,
  startDate,
  endDate,
  bannerColor = "#735797",
  className
}: TournamentCardProps) {
  const sc = statusConfig[status];

  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <Link href={`/torneios/${slug}`}>
      <div
        className={cn(
          "group relative overflow-hidden rounded-2xl border border-border bg-slate-950/70 shadow-card backdrop-blur",
          "transition-all duration-300 ease-out",
          "hover:-translate-y-1 hover:rotate-[0.3deg] hover:shadow-card-hover hover:border-[rgba(255,203,5,0.3)]",
          className
        )}
      >
        {/* Banner top com cor temática */}
        <div
          className="h-2 w-full"
          style={{ background: `linear-gradient(90deg, ${bannerColor}, ${bannerColor}88)` }}
        />

        {/* Shimmer no hover */}
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: `linear-gradient(135deg, transparent 40%, rgba(255,203,5,0.04) 50%, transparent 60%)`
          }}
        />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {edition && (
                <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                  {edition}
                </p>
              )}
              <h3 className="line-clamp-2 text-base font-bold text-white leading-snug">
                {name}
              </h3>
            </div>
            <Trophy
              size={20}
              className="mt-0.5 shrink-0 text-[#FFCB05] opacity-60 transition-opacity group-hover:opacity-100"
            />
          </div>

          {description && (
            <p className="mt-2 line-clamp-2 text-xs text-slate-400">{description}</p>
          )}

          {/* Status badge */}
          <div className="mt-3">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                sc.bg, sc.text, sc.border
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {sc.label}
            </span>
          </div>

          {/* Footer stats */}
          <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Users size={12} />
              {playerCount}{maxPlayers ? `/${maxPlayers}` : ""} jogadores
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays size={12} />
              {formatDate(startDate)}
              {endDate && ` – ${formatDate(endDate)}`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
