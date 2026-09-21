"use client";

import { useState, useTransition } from "react";
import { Bell, Smartphone, Monitor, Check } from "lucide-react";
import {
  NOTIF_CATEGORIES,
  COOLDOWN_MIN,
  COOLDOWN_MAX,
  parseNotificationSettings,
  type NotificationSettings,
} from "@/lib/notification-preferences";
import { updateNotificationSettings } from "../actions";

export function NotificationSettingsCard({ initial }: { initial: unknown }) {
  const [settings, setSettings] = useState<NotificationSettings>(() => parseNotificationSettings(initial));
  const [cooldownOn, setCooldownOn] = useState(() => settings.cooldownMinutes > 0);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const setChannel = (key: (typeof NOTIF_CATEGORIES)[number]["key"], channel: "inGame" | "push", value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      categories: { ...prev.categories, [key]: { ...prev.categories[key], [channel]: value } },
    }));
    setSaved(false);
  };

  const setCooldown = (value: number) => {
    setSettings((prev) => ({ ...prev, cooldownMinutes: value }));
    setSaved(false);
  };

  const toggleCooldown = (on: boolean) => {
    setCooldownOn(on);
    setCooldown(on ? Math.min(COOLDOWN_MAX, Math.max(COOLDOWN_MIN, settings.cooldownMinutes || 15)) : 0);
  };

  const save = () => {
    const payload: NotificationSettings = { ...settings, cooldownMinutes: cooldownOn ? settings.cooldownMinutes : 0 };
    startTransition(async () => {
      const res = await updateNotificationSettings(payload);
      if (res.ok) setSaved(true);
    });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Bell size={18} className="text-[#FFCB05]" />
        <h3 className="text-sm font-black text-white">Notificações</h3>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Escolha o que você recebe e em qual canal: <span className="inline-flex items-center gap-1 text-slate-300"><Monitor size={11} /> no jogo</span> e/ou <span className="inline-flex items-center gap-1 text-slate-300"><Smartphone size={11} /> no celular</span>.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        <div className="grid grid-cols-[1fr_3.5rem_3.5rem] items-center border-b border-white/10 bg-slate-900/70 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          <span>Tipo</span>
          <span className="flex items-center justify-center gap-1"><Monitor size={12} /> Jogo</span>
          <span className="flex items-center justify-center gap-1"><Smartphone size={12} /> Celular</span>
        </div>
        {NOTIF_CATEGORIES.map(({ key, label, hint }) => (
          <div key={key} className="grid grid-cols-[1fr_3.5rem_3.5rem] items-center border-b border-white/5 px-3 py-2.5 last:border-b-0">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-200">{label}</p>
              <p className="truncate text-[10px] text-slate-500">{hint}</p>
            </div>
            <input
              type="checkbox"
              aria-label={`${label} no jogo`}
              checked={settings.categories[key].inGame}
              onChange={(e) => setChannel(key, "inGame", e.target.checked)}
              className="mx-auto h-4 w-4 accent-[#FFCB05]"
            />
            <input
              type="checkbox"
              aria-label={`${label} no celular`}
              checked={settings.categories[key].push}
              onChange={(e) => setChannel(key, "push", e.target.checked)}
              className="mx-auto h-4 w-4 accent-[#FFCB05]"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/40 p-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <input type="checkbox" checked={cooldownOn} onChange={(e) => toggleCooldown(e.target.checked)} className="h-4 w-4 accent-[#FFCB05]" />
          Intervalo mínimo entre notificações no celular (cooldown)
        </label>
        {cooldownOn && (
          <div className="mt-3 flex items-center gap-3">
            <input
              type="range"
              min={COOLDOWN_MIN}
              max={COOLDOWN_MAX}
              value={settings.cooldownMinutes || COOLDOWN_MIN}
              onChange={(e) => setCooldown(Number(e.target.value))}
              className="h-1 flex-1 accent-[#FFCB05]"
            />
            <span className="w-20 shrink-0 text-right text-xs font-black text-[#FFCB05]">{settings.cooldownMinutes} min</span>
          </div>
        )}
        <p className="mt-2 text-[10px] text-slate-500">
          Com o cooldown ligado, novos pushes no celular só chegam após esse tempo desde o último. O sino dentro do jogo não é afetado.
        </p>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        {saved && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-300"><Check size={14} /> Salvo</span>}
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-[#FFCB05] px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Salvar preferências"}
        </button>
      </div>
    </div>
  );
}
