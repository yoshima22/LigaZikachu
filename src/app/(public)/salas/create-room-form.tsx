"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateRoomForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/salas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.code) throw new Error(data.error ?? "Não foi possível criar a sala.");
      router.push(`/salas/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar a sala.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        maxLength={72}
        placeholder="Senha (opcional)"
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
      />
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button onClick={create} disabled={busy} className="w-full rounded-lg bg-[#FFCB05] px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-50">
        {busy ? "Criando..." : "Criar sala rápida"}
      </button>
    </div>
  );
}
