export const DESKTOP_CHAT_STORAGE_KEY = "liga-zikachu:desktop-chat-enabled";
export const DESKTOP_CHAT_PREFERENCE_EVENT = "desktop-chat-preference-changed";

export function readDesktopChatPreference() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(DESKTOP_CHAT_STORAGE_KEY) !== "false";
}

export function writeDesktopChatPreference(enabled: boolean) {
  window.localStorage.setItem(DESKTOP_CHAT_STORAGE_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent(DESKTOP_CHAT_PREFERENCE_EVENT, { detail: { enabled } }));
}
