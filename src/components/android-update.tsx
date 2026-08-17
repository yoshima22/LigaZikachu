"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";

type Release = { versionCode: number; versionName: string; apkUrl: string; notes?: string };

declare global {
  interface Window {
    AndroidBridge?: {
      getAppVersionCode?: () => number;
      getAppVersionName?: () => string;
      checkForUpdate?: () => void;
    };
  }
}

const RELEASE_URL = "/downloads/android-update.json";
const CACHE_KEY = "liga-android-release-v1";
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;

function isAndroidMobile() {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

function installedVersionCode() {
  try { return Number(window.AndroidBridge?.getAppVersionCode?.() ?? 0); } catch { return 0; }
}

async function loadRelease(force = false): Promise<Release | null> {
  if (!isAndroidMobile()) return null;
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null") as { checkedAt: number; release: Release } | null;
      if (cached && Date.now() - cached.checkedAt < CHECK_INTERVAL) return cached.release;
    } catch {}
  }
  const response = await fetch(`${RELEASE_URL}?v=${force ? Date.now() : "current"}`, { cache: "no-store" });
  if (!response.ok) return null;
  const release = (await response.json()) as Release;
  localStorage.setItem(CACHE_KEY, JSON.stringify({ checkedAt: Date.now(), release }));
  return release;
}

export function AndroidUpdateBadge() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!isAndroidMobile()) return;
    void loadRelease().then((release) => {
      if (!release) return;
      const installed = installedVersionCode();
      setAvailable(installed === 0 || installed < release.versionCode);
    }).catch(() => {});
  }, []);
  if (!available) return null;
  return <span aria-label="Nova atualização disponível" title="Nova atualização disponível" className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#1A1A2E] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,.9)]" />;
}

export function AndroidUpdateButton() {
  const [android, setAndroid] = useState(false);
  const [installedName, setInstalledName] = useState<string | null>(null);
  const [installedCode, setInstalledCode] = useState(0);
  const [release, setRelease] = useState<Release | null>(null);
  const [checking, setChecking] = useState(true);
  const updateAvailable = Boolean(release && (installedCode === 0 || installedCode < release.versionCode));
  const check = useCallback((force = false) => {
    setChecking(true);
    void loadRelease(force).then(setRelease).catch(() => setRelease(null)).finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    const detected = isAndroidMobile();
    setAndroid(detected);
    if (detected && window.AndroidBridge?.getAppVersionCode) {
      try {
        setInstalledCode(installedVersionCode());
        setInstalledName(window.AndroidBridge.getAppVersionName?.() ?? null);
      } catch {}
    }
    if (detected) check(false); else setChecking(false);
  }, [check]);
  if (!android) return null;
  const beginUpdate = () => {
    if (window.AndroidBridge?.checkForUpdate) return window.AndroidBridge.checkForUpdate();
    if (release?.apkUrl) window.location.href = release.apkUrl;
  };
  return (
    <div className="mb-4 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">{checking ? "Verificando atualização…" : updateAvailable ? `Versão ${release?.versionName} disponível` : "Aplicativo atualizado"}</p>
          <p className="mt-1 text-xs text-slate-300">{updateAvailable ? (release?.notes || "Há uma nova versão do aplicativo Android.") : "A Liga verifica novas versões automaticamente."}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => check(true)} disabled={checking} className="rounded-lg border border-white/15 p-2 text-slate-200 disabled:opacity-50" title="Verificar novamente"><RefreshCw size={17} className={checking ? "animate-spin" : ""} /></button>
          {updateAvailable && <button type="button" onClick={beginUpdate} className="inline-flex items-center gap-2 rounded-lg bg-[#FFCB05] px-4 py-2 text-xs font-black text-slate-950"><Download size={16} /> Atualizar agora</button>}
        </div>
      </div>
      {installedCode > 0 && <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Instalada no aparelho</p><p className="mt-1 text-sm font-black text-white">v{installedName ?? installedCode}</p></div>
        <div className="rounded-xl border border-[#FFCB05]/25 bg-[#FFCB05]/5 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-amber-300/70">Mais recente disponível</p><p className="mt-1 text-sm font-black text-amber-300">v{release?.versionName ?? "—"}</p></div>
      </div>}
    </div>
  );
}
