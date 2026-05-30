"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Image from "next/image";
import { Send, Zap, BookOpen, Swords, FlaskConical, AlertTriangle, CheckCircle } from "lucide-react";
import { askProfessor, analyzeDeckAction, type ChatMessage, type ProfessorResponse, type DeckAnalysisResult } from "../actions";
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

// URL da foto do Professor — defina NEXT_PUBLIC_PROFESSOR_IMAGE_URL na Vercel
// ou deixe em branco para usar o ícone padrão
const PROFESSOR_IMAGE = process.env.NEXT_PUBLIC_PROFESSOR_IMAGE_URL ?? "";

function ProfAvatar({ size = 32 }: { size?: number }) {
  if (PROFESSOR_IMAGE) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={PROFESSOR_IMAGE}
        alt="Professor Enguiça"
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover border-2 border-[#FFCB05]/40"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFCB05] to-[#FFD700]"
      style={{ width: size, height: size }}
    >
      <Zap size={Math.round(size * 0.45)} className="text-[#1A1A2E]" strokeWidth={2.5} />
    </div>
  );
}

function DeckAnalyzerPanel() {
  const [deckInput, setDeckInput] = useState("");
  const [result, setResult] = useState<DeckAnalysisResult | null>(null);
  const [pending, startTransition] = useTransition();

  const analyze = () => {
    if (!deckInput.trim() || pending) return;
    setResult(null);
    startTransition(async () => {
      try {
        const r = await analyzeDeckAction(deckInput);
        setResult(r);
      } catch {
        setResult({ totalCards: 0, issues: ["Erro ao analisar."], message: "Erro inesperado.", suggestedCards: [] });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-slate-900/50 p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-200">Cole sua decklist aqui</p>
        <p className="text-xs text-slate-500">Formato: <code className="bg-slate-800 px-1 rounded">4 Ultra Ball</code> — uma carta por linha</p>
        <textarea
          value={deckInput}
          onChange={(e) => setDeckInput(e.target.value)}
          disabled={pending}
          rows={12}
          placeholder={"4 Charizard ex\n3 Charmander\n2 Charmeleon\n4 Ultra Ball\n4 Professor's Research\n..."}
          className="w-full resize-none rounded-lg border border-border bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-[#FFCB05] placeholder:text-slate-700"
        />
        <button
          type="button"
          disabled={!deckInput.trim() || pending}
          onClick={analyze}
          className="flex items-center gap-2 rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-semibold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50"
        >
          <FlaskConical size={16} />
          {pending ? "Analisando..." : "Analisar Deck"}
        </button>
      </div>

      {/* Resultado */}
      {result && (
        <div className="space-y-4">
          {/* Resumo */}
          <div className="rounded-xl border border-border bg-slate-900/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-200">Resultado da Análise</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                result.totalCards === 60 ? "bg-[#7AC74C]/20 text-[#7AC74C]" :
                result.totalCards === 0 ? "bg-red-500/20 text-red-400" :
                "bg-amber-500/20 text-amber-400"
              }`}>
                {result.totalCards}/60 cartas
              </span>
            </div>

            {/* Issues */}
            {result.issues.length > 0 && (
              <div className="space-y-1.5">
                {result.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    {issue}
                  </div>
                ))}
              </div>
            )}
            {result.issues.length === 0 && result.totalCards > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-[#7AC74C]/20 bg-[#7AC74C]/5 px-3 py-2 text-xs text-[#7AC74C]">
                <CheckCircle size={12} /> Estrutura do deck parece sólida!
              </div>
            )}

            {/* Mensagem do Professor */}
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFCB05] to-[#FFD700]">
                <Zap size={14} className="text-[#1A1A2E]" />
              </div>
              <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-slate-200 leading-relaxed flex-1">
                <p className="whitespace-pre-wrap">{result.message}</p>
              </div>
            </div>
          </div>

          {/* Cartas sugeridas */}
          {result.suggestedCards.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3 font-semibold">
                Sugestões do Professor
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {result.suggestedCards.map((card) => (
                  <CardSuggestion key={card.id} card={card} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProfessorChat() {
  const [activeTab, setActiveTab] = useState<"chat" | "deck">("chat");
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
          let loadingIdx = -1;
          for (let i = updated.length - 1; i >= 0; i--) { if (updated[i].isLoading) { loadingIdx = i; break; } }
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
          let loadingIdx = -1;
          for (let i = updated.length - 1; i >= 0; i--) { if (updated[i].isLoading) { loadingIdx = i; break; } }
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
      {/* Tabs */}
      <div className="flex rounded-xl border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === "chat" ? "bg-[#FFCB05]/10 text-[#FFCB05]" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Zap size={15} /> Chat com o Professor
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("deck")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === "deck" ? "bg-[#FFCB05]/10 text-[#FFCB05]" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FlaskConical size={15} /> Analisar Deck
        </button>
      </div>

      {/* Deck Analyzer */}
      {activeTab === "deck" && <DeckAnalyzerPanel />}

      {/* Chat */}
      {activeTab === "chat" && <>
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
            {/* Avatar do Professor */}
            {msg.role === "professor" && (
              <ProfAvatar size={32} />
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
      </>}
    </div>
  );
}
