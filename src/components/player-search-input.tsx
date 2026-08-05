"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export type PlayerSearchOption = { id: string; displayName: string; ptcglNick: string | null };

export function PlayerSearchInput({
  value,
  onChange,
  name,
  placeholder = "Digite o nome ou nick...",
  excludeIds = [],
  disabled = false,
  required = false,
  className = "",
}: {
  value?: string;
  onChange?: (playerId: string, player: PlayerSearchOption | null) => void;
  name?: string;
  placeholder?: string;
  excludeIds?: string[];
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PlayerSearchOption | null>(null);
  const [results, setResults] = useState<PlayerSearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const selectedId = value ?? selected?.id ?? "";
  const excludedKey = excludeIds.join("|");

  useEffect(() => {
    if (value === "" && selected) {
      setSelected(null);
      setQuery("");
      setResults([]);
    }
  }, [value, selected]);

  useEffect(() => {
    if (!value || selected?.id === value) return;
    const controller = new AbortController();
    fetch(`/api/players/search?id=${encodeURIComponent(value)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { players?: PlayerSearchOption[] }) => {
        const player = data.players?.[0];
        if (player) setSelected(player);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [value, selected?.id]);

  useEffect(() => {
    if (query.trim().length < 1 || selected) {
      setResults([]);
      setLoading(false);
      return;
    }
    const current = ++requestId.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/players/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const data = await response.json() as { players?: PlayerSearchOption[] };
        if (current === requestId.current) {
          const excluded = new Set(excludedKey.split("|").filter(Boolean));
          setResults((data.players ?? []).filter((player) => !excluded.has(player.id)));
        }
      } catch {
        if (!controller.signal.aborted && current === requestId.current) setResults([]);
      } finally {
        if (current === requestId.current) setLoading(false);
      }
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, selected, excludedKey]);

  const clear = () => {
    setSelected(null);
    setQuery("");
    setResults([]);
    onChange?.("", null);
  };

  return (
    <div className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={selectedId} />}
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        value={selected ? `${selected.displayName}${selected.ptcglNick ? ` (${selected.ptcglNick})` : ""}` : query}
        disabled={disabled}
        required={required}
        onChange={(event) => {
          if (selected) onChange?.("", null);
          setSelected(null);
          setQuery(event.target.value);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-border bg-slate-950 py-2 pl-9 pr-9 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-[#FFCB05] disabled:opacity-50"
      />
      {(selected || query) && !disabled && (
        <button type="button" onClick={clear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label="Limpar jogador">
          <X size={14} />
        </button>
      )}
      {!selected && query.trim().length >= 1 && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-slate-950 p-1 shadow-2xl">
          {loading ? (
            <p className="px-3 py-2 text-xs text-slate-500">Buscando...</p>
          ) : results.length ? <>
            <p className="px-3 pb-1 pt-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-600">Sugestões</p>
            {results.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => { setSelected(player); setQuery(""); setResults([]); onChange?.(player.id, player); }}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
            >
              <span className="font-semibold">{player.displayName}</span>
              {player.ptcglNick && <span className="ml-1.5 text-slate-500">@{player.ptcglNick}</span>}
            </button>
            ))}
          </> : (
            <p className="px-3 py-2 text-xs text-slate-500">Nenhum jogador encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}
