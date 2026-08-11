"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function formatRemaining(ms: number) {
  if (ms <= 0) return "encerrando";
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
  return `${minutes}min`;
}

export function PremiumCountdown({
  until,
  prefix = "Vitrine",
  className = "",
}: {
  until: Date | string;
  prefix?: string;
  className?: string;
}) {
  const endAt = new Date(until).getTime();
  const [remaining, setRemaining] = useState(() => endAt - Date.now());

  useEffect(() => {
    const update = () => setRemaining(endAt - Date.now());
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, [endAt]);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Clock size={10} /> {prefix}: {formatRemaining(remaining)}
    </span>
  );
}
