// Utilitários WebRTC do cliente (broadcaster/espectador). Sem segredos aqui.

export const SPEC_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.cloudflare.com:3478" },
];

/**
 * Pede ao navegador áudio da superfície escolhida, nunca o mix completo do
 * sistema. Chrome/Edge aplicam `systemAudio: exclude`; navegadores antigos
 * ignoram a dica com segurança. Para isolamento perfeito, o usuário ainda deve
 * escolher a aba (não a tela inteira) no seletor nativo.
 */
export function specDisplayMediaOptions(width: number, height: number, fps: number): DisplayMediaStreamOptions {
  return {
    video: { frameRate: { ideal: fps, max: fps }, width: { ideal: width }, height: { ideal: height } },
    audio: true,
    systemAudio: "exclude",
    windowAudio: "window",
    surfaceSwitching: "include",
    selfBrowserSurface: "exclude",
  } as DisplayMediaStreamOptions;
}

export function sharedDisplaySurface(stream: MediaStream): string | undefined {
  return (stream.getVideoTracks()[0]?.getSettings() as MediaTrackSettings & { displaySurface?: string })?.displaySurface;
}

// Aguarda o ICE gathering terminar (ou um timeout curto) antes de enviar o SDP,
// já que usamos negociação sem trickle contra o SFU.
export function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 3000): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => { pc.removeEventListener("icegatheringstatechange", check); clearTimeout(timer); resolve(); };
    const check = () => { if (pc.iceGatheringState === "complete") finish(); };
    const timer = setTimeout(finish, timeoutMs);
    pc.addEventListener("icegatheringstatechange", check);
  });
}
