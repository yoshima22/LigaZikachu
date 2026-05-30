"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Image from "next/image";
import { Send, Zap, BookOpen, Swords } from "lucide-react";
import { askProfessor, type ChatMessage, type ProfessorResponse } from "../actions";
import type { TcgCard } from "@/lib/card-service";

const WELCOME: ChatMessage = {
  role: "professor",
  content: "Salve, parceiro! Sou o Professor Enguiça, o treinador de decks da Liga Zikachu. 🔥\n\nManda teu deck ou fala o que quer melhorar que eu te ajudo a evoluir!"
};

const QUICK_PROMPTS = [
  { label: "Melhorar consistência", icon: BookOpen, text: "Como posso melhorar a consistência do meu deck?" },
  { label: "Mais compra de cartas", icon: BookOpen, text: "Quais cartas de compra são mais eficientes no TCG atual?" },
  { label: "Contra meta agressivo", icon: Swords, text: "Quais cartas me ajudam contra decks agressivos rápidos?" }
];

const rarityColors: Record<string, string> = {
  "Common": "border-slate-600",
  "Uncommon": "border-[#7AC74C]/50",
  "Rare": "border-[#6390F0]/50",
  "Rare Holo": "border-[#6390F0]/60",
  "Rare Ultra": "border-[#735797]/60",
  "Special Illustration Rare": "border-[#FFCB05]/60",
  "Illustration Rare": "border-[#FFCB05]/50"
};

function CardSuggestion({ card }: { card: TcgCard & { reason: string } }) {
  const [enlarged, setEnlarged] = useState(false);
  const border = rarityColors[card.rarity ?? ""] ?? "border-border";

  return (
    <>
      <div className={`rounded-xl border ${border} bg-slate-950/70 overflow-hidden hover:scale-[1.02] transition-transform cursor-pointer`}
        onClick={() => setEnlarged(true)}>
        <div className="relative h-36 w-full bg-slate-900">
          {card.imageSmall && (
            <Image src={card.imageSmall} alt={card.name} fill className="object-contain p-1" unoptimized sizes="160px" />
          )}
        </div>
        <div className="p-2 space-y-1">
          <p className="text-xs font-semibold text-white leading-tight truncate">{card.name}</p>
          <p className="text-[10px] text-slate-500">{card.supertype}{card.subtypes[0] ? ` · ${card.subtypes[0]}` : ""}</p>
          {card.text && (
            <p className="text-[10px] text-slate-400 line-clamp-2">{card.text}</p>
          )}
          <p className="text-[10px] text-slate-600">{card.set.name}</p>
        </div>
      </div>

      {/* Modal de imagem ampliada */}
      {enlarged && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setEnlarged(false)}>
          <div className="relative max-w-xs w-full">
            <Image src={card.imageLarge || card.imageSmall} alt={card.name}
              width={400} height={560} className="rounded-2xl shadow-2xl" unoptimized />
          </div>
        </div>
      )}
    </>
  );
}

interface DisplayMessage {
  role: "user" | "professor";
  content: string;
  cards?: Array<TcgCard & { reason: string }>;
  isLoading?: boolean;
}

export function ProfessorChat() {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [display, setDisplay] = useState<DisplayMessage[]>([
    { role: "professor", content: WELCOME.content }
  ]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [display]);

  const sendMessage = (text: string) => {
    if (!text.trim() || pending) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const newHistory = [...history, userMsg];

    setDisplay((d) => [
      ...d,
      { role: "user", content: text.trim() },
      { role: "professor", content: "", isLoading: true }
    ]);
    setHistory(newHistory);
    setInput("");

    startTransition(async () => {
      try {
        const response: ProfessorResponse = await askProfessor(newHistory);

        setDisplay((d) => {
          const updated = [...d];
          const loadingIdx = updated.findLastIndex((m) => m.isLoading);
          if (loadingIdx >= 0) {
            updated[loadingIdx] = {
              role: "professor",
              content: response.message,
              cards: response.suggestedCards.length > 0 ? response.suggestedCards : undefined,
              isLoading: false
            };
          }
          return updated;
        });

        setHistory([...newHistory, { role: "professor", content: response.message }]);
      } catch {
        setDisplay((d) => {
          const updated = [...d];
          const loadingIdx = updated.findLastIndex((m) => m.isLoading);
          if (loadingIdx >= 0) {
            updated[loadingIdx] = {
              role: "professor",
              content: "Ixe, erro na linha! Tenta de novo, parceiro. 📻",
              isLoading: false
            };
          }
          return updated;
        });
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Quick prompts */}
      {history.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((p) => (
            <button key={p.label} type="button" onClick={() => sendMessage(p.text)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-slate-900/50 px-3 py-2 text-xs text-slate-300 hover:border-[#FFCB05]/30 hover:text-[#FFCB05] transition-colors">
              <p.icon size={12} /> {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-slate-950/50 p-4 min-h-[400px] max-h-[600px] overflow-y-auto">
        {display.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {/* Avatar */}
            {msg.role === "professor" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFCB05] to-[#FFD700]">
                <Zap size={14} className="text-[#1A1A2E]" strokeWidth={2.5} />
              </div>
            )}

            <div className={`max-w-[80%] space-y-3 ${msg.role === "user" ? "items-end" : ""}`}>
              {/* Bubble */}
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#FFCB05] text-[#1A1A2E] font-medium"
                  : "bg-slate-900 text-slate-200"
              }`}>
                {msg.isLoading ? (
                  <div className="flex items-center gap-1.5">
                    <span className="animate-bounce">●</span>
                    <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>●</span>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>

              {/* Card suggestions */}
              {msg.cards && msg.cards.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-semibold">
                    Sugestões de Cartas
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {msg.cards.map((card) => (
                      <CardSuggestion key={card.id} card={card} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 rounded-2xl border border-border bg-slate-900/50 p-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={pending}
          rows={2}
          placeholder="Pergunte algo sobre seu deck, estratégias ou peça sugestões de cartas... (Enter para enviar)"
          className="flex-1 resize-none bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none"
        />
        <button
          type="button"
          disabled={!input.trim() || pending}
          onClick={() => sendMessage(input)}
          className="self-end flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50 transition-colors"
        >
          <Send size={16} />
        </button>
      </div>

      <p className="text-center text-[10px] text-slate-600">
        As cartas sugeridas são buscadas em tempo real na <a href="https://pokemontcg.io" target="_blank" rel="noreferrer" className="underline hover:text-slate-500">Pokemon TCG API</a>.
        Clique em uma carta para ampliar.
      </p>
    </div>
  );
}
