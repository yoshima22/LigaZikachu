import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  description?: string;
  className?: string;
  highlight?: boolean;
}

export function StatCard({ label, value, icon, description, className, highlight }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-slate-950/70 p-3.5 shadow-card backdrop-blur sm:p-5",
        highlight && "border-primary/40 bg-primary/5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[9px] uppercase tracking-[0.12em] text-slate-400 sm:text-xs sm:tracking-[0.15em]">{label}</p>
          <p className="mt-1 truncate text-xl font-bold text-white sm:text-2xl">{value}</p>
          {description && <p className="mt-1 truncate text-[10px] text-slate-400 sm:text-xs">{description}</p>}
        </div>
        {icon && <div className="mt-0.5 shrink-0 text-slate-400">{icon}</div>}
      </div>
    </div>
  );
}
