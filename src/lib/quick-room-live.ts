export type LiveRoomMember = {
  id: string;
  name: string;
  sharing: boolean;
  camera: boolean;
};

export type LiveRoomSource = {
  id: string;
  name: string;
  kind: "screen" | "camera";
};

export type ParticipantActivity = LiveRoomMember & {
  mic: boolean;
};

/** Screens are the primary live experience; cameras follow as optional sources. */
export function activeLiveSources(members: LiveRoomMember[]): LiveRoomSource[] {
  const screens = members.filter((member) => member.sharing).map(({ id, name }) => ({ id, name, kind: "screen" as const }));
  const cameras = members.filter((member) => member.camera).map(({ id, name }) => ({ id, name, kind: "camera" as const }));
  return [...screens, ...cameras];
}

export function participantActivityLabel(member: ParticipantActivity): string {
  const states = [
    member.mic ? "Microfone ligado" : "Microfone desligado",
    member.camera ? "câmera disponível" : null,
    member.sharing ? "tela disponível" : null,
  ].filter((state): state is string => Boolean(state));
  return states.length === 1 && !member.mic ? "Conectado, sem mídia ativa" : states.join(", ");
}
