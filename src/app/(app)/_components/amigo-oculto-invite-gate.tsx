"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { InviteModal } from "../amigo-oculto/_components/invite-modal";

// Mostra o convite do Amigo Oculto uma vez por edição (por aparelho), fora da própria página do evento.
export function AmigoOcultoInviteGate({ editionId }: { editionId: string }) {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const key = `ao-invite-seen-${editionId}`;
  useEffect(() => {
    if (pathname.startsWith("/amigo-oculto")) return;
    try { if (localStorage.getItem(key)) return; } catch { /* sem storage: mostra mesmo assim */ }
    const t = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(t);
  }, [pathname, key]);
  if (!show) return null;
  const close = () => { try { localStorage.setItem(key, "1"); } catch { /* ignora */ } setShow(false); };
  return <InviteModal onClose={close} />;
}
