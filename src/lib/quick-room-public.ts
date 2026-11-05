export type PublicRoomActivity = {
  visibility: "PUBLIC" | "UNLISTED";
  activeParticipants: number;
  activeMedia: number;
  publicLastSeenAt: Date | null;
};

/** Uma sala só merece vitrine quando o anfitrião a listou, há gente e mídia ao vivo. */
export function isPublicLiveEligible(room: PublicRoomActivity, now: Date, staleAfterMs = 90_000): boolean {
  const lastSeenAt = room.publicLastSeenAt;
  return room.visibility === "PUBLIC"
    && room.activeParticipants > 0
    && room.activeMedia > 0
    && Boolean(lastSeenAt)
    && now.getTime() - (lastSeenAt?.getTime() ?? 0) <= staleAfterMs;
}

export function countActiveMedia(leases: Array<{ cameraOn: boolean; screenOn: boolean }>): number {
  return leases.reduce((total, lease) => total + Number(lease.cameraOn) + Number(lease.screenOn), 0);
}
