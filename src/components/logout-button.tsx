"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const handleLogout = () => {
    try { localStorage.removeItem("lz_session_backup"); } catch {}
    window.location.href = "/api/auth/signout-redirect";
  };

  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleLogout}
      className="text-slate-400 hover:text-red-400 hover:bg-red-500/10">
      <LogOut size={14} />
    </Button>
  );
}
