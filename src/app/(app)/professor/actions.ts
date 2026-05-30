"use server";

import { fetchCardsByNames } from "@/lib/card-service";
import type { TcgCard } from "@/lib/card-service";
import { parseDeckList, analyzeDeck } from "@/lib/deck-parser";

export interface ChatMessage {
  role: "user" | "professor";
  content: string;
}

export interface ProfessorResponse {
  message: string;
  suggestedCards: Array<TcgCard & { reason: string }>;
  error?: string;
}

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o Professor Enguiça, o treinador de decks da Liga Zikachu.
Você é direto, animado, usa gírias leves do dia a dia e fala português brasileiro informal.
Você é especialista em Pokémon TCG (jogo de cartas) e APENAS nisso.

REGRAS OBRIGATÓRIAS:
1. NUNCA responda sobre assuntos fora de Pokémon TCG. Se perguntarem algo não relacionado (política, culinária, outros jogos, etc), diga: "Parceiro, isso tá fora do meu quadrado! Só falo de Pokémon TCG aqui. 🃏"
2. SEMPRE que sugerir cartas, use nomes EXATOS de cartas reais do Pokémon TCG.
3. Nunca invente cartas, conjuntos ou mecânicas que não existam.
4. Máximo 5 sugestões de cartas por resposta. Menos é mais.
5. Seja objetivo — foco em deck, estratégia, cartas e meta.

FORMATO DE RESPOSTA (JSON obrigatório):
{
  "message": "sua mensagem amigável aqui",
  "cards": ["Professor's Research", "Ultra Ball", "Boss's Orders"]
}

Use "cards": [] quando a pergunta não precisar de sugestão de cartas.
Lembre: o sistema busca as imagens e dados reais das cartas automaticamente.`;

// ── Gemini Flash (gratuito) ───────────────────────────────────────────────────

async function callGemini(messages: ChatMessage[]): Promise<{ message: string; cardNames: string[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { message: "", cardNames: [] };

  // Construir histórico para Gemini
  const contents = messages.map((m) => ({
    role: m.role === "professor" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
      })
    }
  );

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);

  const data = await res.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return parseAIResponse(text);
}

// ── Claude Haiku (fallback) ───────────────────────────────────────────────────

async function callClaude(messages: ChatMessage[]): Promise<{ message: string; cardNames: string[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { message: "", cardNames: [] };

  const apiMessages = messages.map((m) => ({
    role: m.role === "professor" ? "assistant" : "user",
    content: m.content
  }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: apiMessages
    })
  });

  if (!res.ok) throw new Error(`Claude error: ${res.status}`);

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
  };

  const text = data.content.find((c) => c.type === "text")?.text ?? "{}";
  return parseAIResponse(text);
}

// ── Parser de resposta da IA ──────────────────────────────────────────────────

function parseAIResponse(text: string): { message: string; cardNames: string[] } {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { message: text, cardNames: [] };

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { message?: string; cards?: string[] };
    return {
      message: parsed.message ?? text,
      cardNames: parsed.cards ?? []
    };
  } catch {
    return { message: text, cardNames: [] };
  }
}

// ── Análise de Deck ───────────────────────────────────────────────────────────

export interface DeckAnalysisResult {
  totalCards: number;
  issues: string[];
  message: string;
  suggestedCards: Array<TcgCard & { reason: string }>;
  error?: string;
}

export async function analyzeDeckAction(deckList: string): Promise<DeckAnalysisResult> {
  try {
    const parsed = parseDeckList(deckList);
    if (parsed.totalCards === 0) {
      return {
        totalCards: 0,
        issues: ["Não consegui ler o deck. Verifique se está no formato: `4 Ultra Ball`"],
        message: "Ixe, não consegui ler seu deck, parceiro! Use o formato:\n\n4 Ultra Ball\n2 Boss's Orders\n...",
        suggestedCards: []
      };
    }

    const analysis = analyzeDeck(parsed);

    // Montar lista de cartas para o prompt da IA
    const deckText = parsed.entries
      .slice(0, 40) // limitar para não estourar tokens
      .map((e) => `${e.quantity}x ${e.name}`)
      .join("\n");

    const analysisContext = [
      `Total de cartas: ${analysis.totalCards}/60`,
      `Energias estimadas: ${analysis.categories.energy}`,
      `Cartas de compra (Supporters draw): ${analysis.drawCount}`,
      `Cartas de busca: ${analysis.searchCount}`,
      analysis.hints.length > 0 ? `Problemas detectados:\n${analysis.hints.join("\n")}` : "Deck bem balanceado estruturalmente."
    ].join("\n");

    const prompt = `Analise este deck de Pokémon TCG e sugira melhorias:

DECK:
${deckText}

ANÁLISE AUTOMÁTICA:
${analysisContext}

Com base nisso, sugira melhorias específicas com cartas reais. Formato JSON obrigatório.`;

    const messages: ChatMessage[] = [{ role: "user", content: prompt }];

    let result = { message: "", cardNames: [] as string[] };
    if (process.env.GEMINI_API_KEY) {
      result = await callGemini(messages);
    } else if (process.env.ANTHROPIC_API_KEY) {
      result = await callClaude(messages);
    } else {
      // Fallback sem IA: usar apenas as regras locais
      const fallbackCards: Record<string, string> = {
        DRAW: "Professor's Research",
        SEARCH: "Ultra Ball",
        ENERGY: "Nest Ball"
      };
      const suggestions: string[] = [];
      if (analysis.drawCount < 3) suggestions.push(fallbackCards.DRAW, "Iono");
      if (analysis.searchCount < 3) suggestions.push(fallbackCards.SEARCH, "Nest Ball");

      result = {
        message: [
          analysis.issues.length > 0
            ? `Detectei alguns pontos a melhorar no seu deck, parceiro! ${analysis.issues[0]}`
            : "Deck com estrutura razoável! Aqui vão algumas sugestões gerais:",
          ...analysis.issues.slice(1)
        ].join("\n"),
        cardNames: suggestions.slice(0, 4)
      };
    }

    let suggestedCards: Array<TcgCard & { reason: string }> = [];
    if (result.cardNames.length > 0) {
      const cards = await fetchCardsByNames(result.cardNames);
      suggestedCards = cards.map((c) => ({ ...c, reason: c.name }));
    }

    return {
      totalCards: analysis.totalCards,
      issues: analysis.issues,
      message: result.message,
      suggestedCards
    };
  } catch (err) {
    console.error("[DeckAnalyzer error]", err);
    return {
      totalCards: 0,
      issues: [],
      message: "Deu um erro ao analisar o deck. Tenta de novo! 📻",
      suggestedCards: [],
      error: err instanceof Error ? err.message : "Erro"
    };
  }
}

// ── Action principal ──────────────────────────────────────────────────────────

export async function askProfessor(messages: ChatMessage[]): Promise<ProfessorResponse> {
  try {
    // Prioridade: Gemini (gratuito) → Claude (pago) → mensagem de fallback
    let result = { message: "", cardNames: [] as string[] };

    if (process.env.GEMINI_API_KEY) {
      result = await callGemini(messages);
    } else if (process.env.ANTHROPIC_API_KEY) {
      result = await callClaude(messages);
    } else {
      return {
        message: "E aí, parceiro! Sou o Professor Enguiça, mas meu servidor de IA não está configurado ainda. Peça pro admin adicionar a GEMINI_API_KEY nas configurações da Vercel! 🔧",
        suggestedCards: []
      };
    }

    const { message, cardNames } = result;

    let suggestedCards: Array<TcgCard & { reason: string }> = [];
    if (cardNames.length > 0) {
      const cards = await fetchCardsByNames(cardNames);
      suggestedCards = cards.map((card) => ({ ...card, reason: card.name }));
    }

    return { message, suggestedCards };
  } catch (err) {
    console.error("[Professor Enguiça error]", err);
    return {
      message: "Ixe, deu um erro aqui no meu rádio! Tenta de novo, parceiro. 📻",
      suggestedCards: [],
      error: err instanceof Error ? err.message : "Erro desconhecido"
    };
  }
}
