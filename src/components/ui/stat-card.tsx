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
        "rounded-2xl border border-border bg-slate-950/70 p-5 shadow-card backdrop-blur",
        highlight && "border-primary/40 bg-primary/5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold text-white">{value}</p>
          {description && <p className="mt-1 truncate text-xs text-slate-400">{description}</p>}
        </div>
        {icon && <div className="mt-0.5 shrink-0 text-slate-400">{icon}</div>}
      </div>
    </div>
  );
}
