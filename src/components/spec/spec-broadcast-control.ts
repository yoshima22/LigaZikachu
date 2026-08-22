"use client";

export type SpecBroadcastControlState = {
  streamId: string;
  title: string;
  state: "live" | "paused" | "ended";
};

export type SpecBroadcastCommand = "pause" | "play" | "stop" | "focus";

export const SPEC_BROADCAST_CONTROL_KEY = "zika-tv-own-broadcast";
export const SPEC_BROADCAST_CONTROL_EVENT = "zika-tv-own-broadcast-change";
export const SPEC_BROADCAST_CHANNEL = "zika-tv-broadcast-control-v1";

export function publishSpecBroadcastState(state: SpecBroadcastControlState) {
  if (state.state === "ended") localStorage.removeItem(SPEC_BROADCAST_CONTROL_KEY);
  else localStorage.setItem(SPEC_BROADCAST_CONTROL_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(SPEC_BROADCAST_CONTROL_EVENT, { detail: state }));
  try {
    const channel = new BroadcastChannel(SPEC_BROADCAST_CHANNEL);
    channel.postMessage({ type: "state", state });
    channel.close();
  } catch { /* sem suporte */ }
}

export function sendSpecBroadcastCommand(command: SpecBroadcastCommand) {
  try {
    const channel = new BroadcastChannel(SPEC_BROADCAST_CHANNEL);
    channel.postMessage({ type: "command", command });
    channel.close();
  } catch { /* sem suporte */ }
}
