import { cn } from "@/lib/utils";
import { User } from "lucide-react";

interface TrainerAvatarProps {
  displayName: string;
  image?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  accentColor?: string;
  className?: string;
}

const sizeMap = {
  sm: { container: "h-7 w-7 text-xs",   ring: "ring-1",  icon: 14 },
  md: { container: "h-10 w-10 text-sm", ring: "ring-2",  icon: 18 },
  lg: { container: "h-14 w-14 text-lg", ring: "ring-2",  icon: 24 },
  xl: { container: "h-20 w-20 text-2xl",ring: "ring-[3px]", icon: 32 }
};

export function TrainerAvatar({
  displayName,
  image,
  size = "md",
  accentColor = "#FFCB05",
  className
}: TrainerAvatarProps) {
  const sz = sizeMap[size];
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-slate-700 font-bold text-white",
        "ring-offset-2 ring-offset-slate-950",
        sz.container, sz.ring,
        className
      )}
      style={{ boxShadow: `0 0 0 2px ${accentColor}40` }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={displayName}
          className="h-full w-full object-cover"
        />
      ) : initials ? (
        <span className="flex h-full w-full items-center justify-center">{initials}</span>
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          <User size={sz.icon} className="text-slate-400" />
        </span>
      )}
    </div>
  );
}
