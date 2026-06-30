"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminArenaHistorySelector({ currentViewAs }: { currentViewAs: string }) {
  const router = useRouter();
  const [value, setValue] = useState(currentViewAs);

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={e => {
        e.preventDefault();
        const trimmed = value.trim();
        const url = trimmed
          ? `/arena-z?tab=historico&viewAs=${encodeURIComponent(trimmed)}`
          : "/arena-z?tab=historico";
        router.push(url);
      }}
    >
      <input
        type="text"
        placeholder="Player ID do jogador"
        value={value}
        onChange={e => setValue(e.target.value)}
        className="w-48 rounded-lg border border-amber-500/30 bg-slate-900 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500/60 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/20"
      >
        Ver
      </button>
      {currentViewAs && (
        <button
          type="button"
          onClick={() => { setValue(""); router.push("/arena-z?tab=historico"); }}
          className="text-[10px] text-slate-500 hover:text-slate-300"
        >
          ✕ meu histórico
        </button>
      )}
    </form>
  );
}
