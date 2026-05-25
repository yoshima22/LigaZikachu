import type { Metadata, Viewport } from "next";
import { Inter, Press_Start_2P } from "next/font/google";
import "./globals.css";

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
  themeColor: "#1A1A2E"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${pressStart.variable}`}>
      <body>{children}</body>
    </html>
  );
}
