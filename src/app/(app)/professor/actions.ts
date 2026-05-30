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

REGRAS:
1. NUNCA responda sobre assuntos fora de Pokémon TCG.
2. Use nomes EXATOS de cartas reais do Pokémon TCG.
3. Máximo 5 sugestões de cartas por resposta.
4. Seja objetivo — foco em deck, estratégia e meta.

FORMATO OBRIGATÓRIO (sempre JSON):
{
  "message": "sua mensagem amigável",
  "cards": ["Professor's Research", "Ultra Ball"]
}

Use "cards": [] quando não precisar sugerir cartas.`;

// ── Banco de cartas por categoria (fallback sem IA) ───────────────────────────

const CARD_DB: Record<string, string[]> = {
  DRAW:   ["Professor's Research", "Iono", "Colress's Experiment", "Cynthia", "Marnie"],
  SEARCH: ["Ultra Ball", "Nest Ball", "Arven", "Pokégear 3.0", "Level Ball"],
  RECOVERY: ["Superior Energy Retrieval", "Rescue Carrier", "Bravery Charm"],
  ENGINE: ["Rotom V", "Radiant Greninja", "Lumineon V"],
  ENERGY_ACCEL: ["Dark Patch", "Magma Basin", "Superior Energy Retrieval"],
  STADIUM: ["Lost City", "Path to the Peak", "Beach Court"]
};

// Respostas com personalidade do Professor sem IA
const PROF_LINES = {
  greeting: "Salve, parceiro! Aqui vai minha análise do seu deck:",
  draw: "Cara, seu deck tá na seca de compra! Bota mais Supporters de draw que a vida melhora:",
  search: "Tá difícil achar seus Pokémon né? Adiciona buscadores que isso some:",
  both: "Parceiro, você precisa de mais compra E mais busca. Olha isso aqui:",
  energy_excess: "Tá colocando muita energia não, brother! Deck moderno anda com 8-12. Troca algumas por suporte:",
  balanced: "Deck com estrutura boa! Se quiser dar um upgrade, considera essas cartas:",
  incomplete: "Deck incompleto ainda, mas posso ajudar a completar! Olha essas pedras:",
  general: "Deixa eu analisar isso pra você, parceiro! Aqui vai o que eu indicaria:"
};

function buildRuleBasedResponse(lastMessage: string): { message: string; cardNames: string[] } {
  const lower = lastMessage.toLowerCase().trim();

  // Saudações e perguntas gerais — SEM sugestão de cartas
  const isGreeting = /^(oi|olá|ola|salve|hey|hi|hello|tudo|como vai|online|funcionando|aí|ae|e aí|eai|test)/.test(lower)
    || lower.length < 20;

  if (isGreeting) {
    return {
      message: "Salve, parceiro! 🔥 Sou o Professor Enguiça, seu treinador de decks da Liga Zikachu!\n\nPode mandar sua lista de deck ou me perguntar sobre cartas, estratégias e meta. Tô aqui pra te ajudar a evoluir! ⚡",
      cardNames: []
    };
  }

  // Perguntas fora do TCG
  if (!/deck|carta|pokémon|pokemon|tcg|energy|trainer|energia|type|tipo|compra|busca|meta|estratégi/.test(lower)) {
    return {
      message: "Parceiro, isso tá fora do meu quadrado! 🃏 Só falo de Pokémon TCG aqui. Me manda seu deck ou pergunta sobre cartas que eu te ajudo!",
      cardNames: []
    };
  }

  // Perguntas sobre TCG com sugestões
  if (lower.includes("compra") || lower.includes("draw") || lower.includes("consistên")) {
    return { message: PROF_LINES.draw, cardNames: CARD_DB.DRAW.slice(0, 3) };
  }
  if (lower.includes("busca") || lower.includes("search") || lower.includes("achar")) {
    return { message: PROF_LINES.search, cardNames: CARD_DB.SEARCH.slice(0, 3) };
  }
  if (lower.includes("energia") || lower.includes("energy")) {
    return { message: PROF_LINES.energy_excess, cardNames: CARD_DB.ENGINE.slice(0, 2) };
  }

  return {
    message: PROF_LINES.general,
    cardNames: [...CARD_DB.DRAW.slice(0, 2), ...CARD_DB.SEARCH.slice(0, 2)]
  };
}

// ── Chamadas de IA com cascata ────────────────────────────────────────────────

async function callGemini(
  messages: ChatMessage[],
  model = "gemini-2.0-flash"
): Promise<{ message: string; cardNames: string[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("no_key");

  const contents = messages.map((m) => ({
    role: m.role === "professor" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
    })
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${err.slice(0, 100)}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
    error?: { message: string };
  };

  if (data.error) throw new Error(data.error.message);

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return parseAIResponse(text);
}

// ── Groq (Llama 3 — gratuito, 14.400 req/dia) ────────────────────────────────

async function callGroq(messages: ChatMessage[]): Promise<{ message: string; cardNames: string[] }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("no_key");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: 1024,
      temperature: 0.7,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.map((m) => ({
          role: m.role === "professor" ? "assistant" : "user",
          content: m.content
        }))
      ]
    })
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${err.slice(0, 100)}`);
  }

  const data = await res.json() as {
    choices?: Array<{ message: { content: string } }>;
    error?: { message: string };
  };
  if (data.error) throw new Error(data.error.message);

  const text = data.choices?.[0]?.message?.content ?? "{}";
  return parseAIResponse(text);
}

async function callClaude(
  messages: ChatMessage[],
  model = "claude-haiku-4-5"
): Promise<{ message: string; cardNames: string[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("no_key");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({
        role: m.role === "professor" ? "assistant" : "user",
        content: m.content
      }))
    })
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${err.slice(0, 100)}`);
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  const text = data.content.find((c) => c.type === "text")?.text ?? "{}";
  return parseAIResponse(text);
}

// ── Parser da resposta da IA ──────────────────────────────────────────────────

function parseAIResponse(text: string): { message: string; cardNames: string[] } {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { message: text, cardNames: [] };
  try {
    const p = JSON.parse(jsonMatch[0]) as { message?: string; cards?: string[] };
    return { message: p.message ?? text, cardNames: p.cards ?? [] };
  } catch {
    return { message: text, cardNames: [] };
  }
}

// ── Orquestrador com cascata ──────────────────────────────────────────────────

async function getAIResponse(messages: ChatMessage[]): Promise<{ message: string; cardNames: string[]; usedFallback: boolean }> {
  // 1. Gemini 2.0 Flash Lite (quota mais generosa no free tier)
  if (process.env.GEMINI_API_KEY) {
    for (const model of ["gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-2.5-flash-preview-05-20"]) {
      try { return { ...await callGemini(messages, model), usedFallback: false }; }
      catch (e) { console.warn(`[Prof] ${model} falhou:`, e instanceof Error ? e.message : e); }
    }
  }

  // 2. Groq / Llama (gratuito — recomendado)
  if (process.env.GROQ_API_KEY) {
    try { return { ...await callGroq(messages), usedFallback: false }; }
    catch (e) { console.warn("[Prof] Groq falhou:", e instanceof Error ? e.message : e); }
  }

  // 3. Claude (tenta múltiplos modelos)
  if (process.env.ANTHROPIC_API_KEY) {
    for (const model of ["claude-haiku-4-5", "claude-3-haiku-20240307", "claude-3-5-haiku-20241022"]) {
      try { return { ...await callClaude(messages, model), usedFallback: false }; }
      catch (e) { console.warn(`[Prof] Claude ${model} falhou:`, e instanceof Error ? e.message : e); }
    }
  }

  // 5. Fallback baseado em regras (sem IA — sempre funciona)
  console.log("[Prof] Usando fallback baseado em regras");
  const lastMsg = messages[messages.length - 1]?.content ?? "";
  return { ...buildRuleBasedResponse(lastMsg), usedFallback: true };
}

// ── Action principal: chat ────────────────────────────────────────────────────

export async function askProfessor(messages: ChatMessage[]): Promise<ProfessorResponse> {
  try {
    const { message, cardNames, usedFallback } = await getAIResponse(messages);

    const finalMessage = usedFallback && !process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY
      ? `${message}\n\n_(Dica pro admin: adicione GEMINI_API_KEY na Vercel para respostas personalizadas!)_`
      : message;

    let suggestedCards: Array<TcgCard & { reason: string }> = [];
    if (cardNames.length > 0) {
      const cards = await fetchCardsByNames(cardNames);
      suggestedCards = cards.map((c) => ({ ...c, reason: c.name }));
    }

    return { message: finalMessage, suggestedCards };
  } catch (err) {
    console.error("[Professor Enguiça fatal]", err);
    return {
      message: "Ixe, deu ruim no servidor! Tenta de novo em alguns segundos. 📡",
      suggestedCards: [],
      error: err instanceof Error ? err.message : "Erro"
    };
  }
}

// ── Action: análise de deck ───────────────────────────────────────────────────

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
        issues: ["Não consegui ler o deck. Verifique o formato."],
        message: "Ixe, não consegui ler seu deck, parceiro! Use o formato:\n\n4 Ultra Ball\n2 Boss's Orders",
        suggestedCards: []
      };
    }

    const analysis = analyzeDeck(parsed);

    // Usar IA se disponível, senão usar fallback de regras
    const deckText = parsed.entries.slice(0, 40).map((e) => `${e.quantity}x ${e.name}`).join("\n");
    const analysisContext = [
      `Total: ${analysis.totalCards}/60`,
      `Energias: ~${analysis.categories.energy}`,
      `Draw cards: ${analysis.drawCount}`,
      `Search cards: ${analysis.searchCount}`,
      ...(analysis.hints.length > 0 ? analysis.hints : ["Deck estruturalmente equilibrado."])
    ].join("\n");

    const prompt = `Analise este deck de Pokémon TCG:\n\nDECK:\n${deckText}\n\nANÁLISE:\n${analysisContext}\n\nSugira melhorias com cartas reais. JSON obrigatório.`;

    const { message, cardNames } = await getAIResponse([{ role: "user", content: prompt }]);

    // Se IA não sugeriu cartas, usar regras
    const finalCardNames = cardNames.length > 0 ? cardNames : (() => {
      const suggestions: string[] = [];
      if (analysis.drawCount < 3) suggestions.push(...CARD_DB.DRAW.slice(0, 2));
      if (analysis.searchCount < 3) suggestions.push(...CARD_DB.SEARCH.slice(0, 2));
      if (analysis.categories.energy > 15) suggestions.push(...CARD_DB.ENGINE.slice(0, 1));
      return suggestions.slice(0, 5);
    })();

    let suggestedCards: Array<TcgCard & { reason: string }> = [];
    if (finalCardNames.length > 0) {
      const cards = await fetchCardsByNames(finalCardNames);
      suggestedCards = cards.map((c) => ({ ...c, reason: c.name }));
    }

    return { totalCards: analysis.totalCards, issues: analysis.issues, message, suggestedCards };
  } catch (err) {
    console.error("[DeckAnalyzer error]", err);
    return {
      totalCards: 0, issues: [],
      message: "Deu um erro ao analisar o deck. Tenta de novo! 📻",
      suggestedCards: [],
      error: err instanceof Error ? err.message : "Erro"
    };
  }
}
