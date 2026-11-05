export type PublicRoomActivity = {
  visibility: "PUBLIC" | "UNLISTED";
  activeParticipants: number;
  activeMedia: number;
  publicLastSeenAt: Date | null;
};

/** Uma sala só merece vitrine quando o anfitrião a listou, há gente e mídia ao vivo. */
export function isPublicLiveEligible(room: PublicRoomActivity, now: Date, staleAfterMs = 90_000): boolean {
  return room.visibility === "PUBLIC"
    && room.activeParticipants > 0
    && room.activeMedia > 0
    && Boolean(room.publicLastSeenAt)
    && now.getTime() - room.publicLastSeenAt.getTime() <= staleAfterMs;
}
