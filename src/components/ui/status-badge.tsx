import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "active"
  | "pending"
  | "suspended"
  | "rejected"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "draft";

const variants: Record<BadgeVariant, string> = {
  active:    "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  pending:   "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  suspended: "bg-red-500/15 text-red-400 border border-red-500/30",
  rejected:  "bg-red-500/15 text-red-400 border border-red-500/30",
  success:   "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  warning:   "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  danger:    "bg-red-500/15 text-red-400 border border-red-500/30",
  info:      "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  draft:     "bg-slate-500/15 text-slate-400 border border-slate-500/30"
};

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

export function StatusBadge({ variant, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {label}
    </span>
  );
}
