import { ReactNode } from "react";

interface EmptyStateProps {
  message: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ message, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      {icon && <div className="text-slate-600">{icon}</div>}
      <p className="text-sm text-slate-400">{message}</p>
      {action}
    </div>
  );
}
