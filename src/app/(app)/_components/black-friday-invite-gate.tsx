"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { InviteModal } from "../amigo-oculto/_components/invite-modal";
import { BF_INVITE_IMAGE } from "@/lib/black-friday-core";

const KEY = "bf-invite-seen-2026";

// Convite da Black Friday: uma vez por aparelho, fora da página do evento.
export function BlackFridayInviteGate() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (pathname.startsWith("/black-friday")) return;
    try { if (localStorage.getItem(KEY)) return; } catch { /* sem storage: mostra mesmo assim */ }
    const t = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(t);
  }, [pathname]);
  if (!show) return null;
  const close = () => { try { localStorage.setItem(KEY, "1"); } catch { /* ignora */ } setShow(false); };
  return <InviteModal onClose={close} href="/black-friday" image={BF_INVITE_IMAGE} alt="Black Friday do Miauvadão: descontos na ZikaShop, pacotes de LC e sorteio de 1000 LC" label="Ver a Black Friday do Miauvadão" snow={false} emojis={["🖤", "💛", "🏷️", "⚡", "🎟️", "💛"]} />;
}
