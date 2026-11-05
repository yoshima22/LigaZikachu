import type { Metadata } from "next";
import { ZikaChatLobby } from "./lobby-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ZikaChat",
  description: "Crie uma sala com chat, voz e compartilhamento de tela, sem cadastro.",
};

export default function QuickRoomHomePage() { return <ZikaChatLobby />; }
