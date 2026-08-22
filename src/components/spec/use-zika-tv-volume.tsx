"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "zika-tv-volume";

export function useZikaTvVolume() {
  const [volume, setVolumeState] = useState(0.8);
  useEffect(() => {
    const saved = Number(localStorage.getItem(KEY));
    if (Number.isFinite(saved) && saved >= 0 && saved <= 1) setVolumeState(saved);
  }, []);
  const setVolume = useCallback((next: number) => {
    const safe = Math.max(0, Math.min(1, next));
    setVolumeState(safe);
    localStorage.setItem(KEY, String(safe));
  }, []);
  return { volume, setVolume };
}

export function ZikaTvVolumeControl({ volume, onChange, compact = false }: { volume: number; onChange: (value: number) => void; compact?: boolean }) {
  return <label className={`flex items-center gap-2 ${compact ? "rounded-lg bg-black/70 px-2 py-1" : "rounded-lg border border-border bg-slate-900 px-3 py-1.5"}`} title={`Volume: ${Math.round(volume * 100)}%`}>
    <button type="button" onClick={() => onChange(volume > 0 ? 0 : 0.8)} className="text-xs" aria-label={volume > 0 ? "Silenciar" : "Ativar som"}>{volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}</button>
    <input aria-label="Volume da transmissão" type="range" min="0" max="100" step="1" value={Math.round(volume * 100)} onChange={(event) => onChange(Number(event.target.value) / 100)} className={compact ? "w-20 accent-[#FFCB05]" : "w-28 accent-[#FFCB05]"} />
    {!compact && <span className="w-8 text-right text-[10px] font-bold text-slate-400">{Math.round(volume * 100)}%</span>}
  </label>;
}
