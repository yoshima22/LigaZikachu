"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, UserCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminResetUserPassword, adminReactivateUser } from "../actions";

interface User { id: string; name: string | null; email: string; status: string }

export function UserAccountPanel({ users }: { users: User[] }) {
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const filtered = users.filter(u =>
    (u.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8);

  const STATUS_COLOR: Record<string, string> = {
    ACTIVE: "text-green-400", SUSPENDED: "text-red-400",
    PENDING_APPROVAL: "text-amber-400", REJECTED: "text-slate-500",
  };

  const handleReset = () => {
    if (!selectedUser || newPassword.length < 8) { toast.error("Senha deve ter ao menos 8 caracteres."); return; }
    if (!confirm(`Resetar senha de ${selectedUser.name ?? selectedUser.email}?`)) return;
    startTransition(async () => {
      const r = await adminResetUserPassword(selectedUser.id, newPassword);
      if (r.error) { toast.error(r.error); return; }
      toast.success("Senha redefinida e conta reativada!");
      setNewPassword("");
    });
  };

  const handleReactivate = () => {
    if (!selectedUser) return;
    if (!confirm(`Reativar conta de ${selectedUser.name ?? selectedUser.email}?`)) return;
    startTransition(async () => {
      const r = await adminReactivateUser(selectedUser.id);
      if (r.error) { toast.error(r.error); return; }
      toast.success("Conta reativada!");
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound size={16} className="text-[#FFCB05]" />
        <h3 className="font-semibold text-slate-200">Gerenciar Conta de Usuário</h3>
      </div>
      <p className="text-xs text-slate-500">
        Redefina a senha ou reative contas bloqueadas. Útil quando um jogador não consegue entrar.
      </p>

      {/* Busca */}
      <div className="relative">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input value={search}
          onChange={e => { setSearch(e.target.value); setShowDropdown(true); setSelectedUser(null); }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Buscar usuário por nome ou email…"
          className="w-full rounded-xl border border-border bg-slate-900 pl-8 pr-3 py-2 text-xs text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600"
        />
        {showDropdown && search.length > 0 && !selectedUser && filtered.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-slate-900 shadow-xl overflow-hidden">
            {filtered.map(u => (
              <button key={u.id} type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-800"
                onClick={() => { setSelectedUser(u); setSearch(u.name ?? u.email); setShowDropdown(false); }}>
                <div className="text-left">
                  <p className="text-xs font-medium text-slate-200">{u.name ?? "Sem nome"}</p>
                  <p className="text-[10px] text-slate-500">{u.email}</p>
                </div>
                <span className={`text-[10px] font-semibold shrink-0 ${STATUS_COLOR[u.status] ?? "text-slate-400"}`}>
                  {u.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selecionado */}
      {selectedUser && (
        <div className="rounded-xl border border-border bg-slate-900/50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">{selectedUser.name ?? "Sem nome"}</p>
              <p className="text-[10px] text-slate-500">{selectedUser.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-semibold ${STATUS_COLOR[selectedUser.status] ?? "text-slate-400"}`}>
                {selectedUser.status}
              </span>
              <button onClick={() => { setSelectedUser(null); setSearch(""); }} className="text-slate-500 hover:text-slate-300 text-xs px-1">✕</button>
            </div>
          </div>

          {/* Reativar */}
          {selectedUser.status !== "ACTIVE" && (
            <Button type="button" size="sm" disabled={pending} onClick={handleReactivate}
              className="gap-1.5 h-8 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs">
              <UserCheck size={12} /> Reativar conta
            </Button>
          )}

          {/* Reset de senha */}
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500">Nova senha (mín. 8 caracteres):</p>
            <div className="flex gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Nova senha…"
                minLength={8}
                className="flex-1 rounded-lg border border-border bg-slate-950 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-[#FFCB05]"
              />
              <Button type="button" size="sm" disabled={pending || newPassword.length < 8} onClick={handleReset}
                className="gap-1.5 h-8 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700] text-xs disabled:opacity-40">
                <KeyRound size={12} /> Redefinir senha
              </Button>
            </div>
            <p className="text-[10px] text-slate-600">Ao redefinir a senha, a conta é reativada automaticamente.</p>
          </div>
        </div>
      )}
    </div>
  );
}
