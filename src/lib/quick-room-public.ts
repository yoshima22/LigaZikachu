export type PublicRoomActivity = {
  visibility: "PUBLIC" | "UNLISTED";
  activeParticipants: number;
  activeMedia: number;
  publicLastSeenAt: Date | null;
};

/** Uma sala pública aparece na vitrine assim que alguém entra; vídeo e tela são detalhes opcionais do cartão. */
export function isPublicLiveEligible(room: PublicRoomActivity, now: Date, staleAfterMs = 90_000): boolean {
  const lastSeenAt = room.publicLastSeenAt;
  return room.visibility === "PUBLIC"
    && room.activeParticipants > 0
    && Boolean(lastSeenAt)
    && now.getTime() - (lastSeenAt?.getTime() ?? 0) <= staleAfterMs;
}

export function countActiveMedia(leases: Array<{ cameraOn: boolean; screenOn: boolean }>): number {
  return leases.reduce((total, lease) => total + Number(lease.cameraOn) + Number(lease.screenOn), 0);
}
