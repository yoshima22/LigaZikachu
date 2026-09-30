import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Press_Start_2P } from "next/font/google";
import "./globals.css";
import "./themes.css";
import { THEME_INIT_SCRIPT } from "@/lib/site-theme";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Liga Zikachu Live",
  description: "App web/PWA da Liga Zikachu para torneios, partidas, ranking e auditoria.",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#1A1A2E",
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} ${pressStart.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>
      <body>{children}</body>
    </html>
  );
}
