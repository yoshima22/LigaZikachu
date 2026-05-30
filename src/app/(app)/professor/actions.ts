"use server";

import { fetchCardsByNames } from "@/lib/card-service";
import type { TcgCard } from "@/lib/card-service";
import { parseDeckList, analyzeDeck } from "@/lib/deck-parser";
import { buildSuggestions, detectMatchIssues, fetchMatchSuggestions } from "@/lib/deck-recommender";
import type { DeckSuggestion } from "@/lib/deck-recommender";

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export interface ChatMessage { role: "user" | "professor"; content: string; }

export interface ProfessorResponse {
  message: string;
  suggestedCards: Array<TcgCard & { reason: string }>;
  error?: string;
}

export interface DeckAnalysisResult {
  totalCards: number;
  issues: string[];
  message: string;
  suggestedCards: Array<TcgCard & { reason: string }>;
  error?: string;
}

export interface MatchAnalysisResult {
  problems: string[];
  message: string;
  suggestedCards: Array<TcgCard & { reason: string }>;
  error?: string;
}

// ── System Prompt ─────────────────────────────────────────────────────────────
// A IA NUNCA decide quais cartas sugerir — ela apenas explica resultados já calculados.

const SYSTEM_PROMPT = `Você é o Professor Enguiça, treinador de decks da Liga Zikachu.
Personalidade: engraçado, esperto, meio provocador, fala simples, ajuda o jogador melhorar sem humilhar.
Use frases curtas. Pode usar humor de campeonato e treino.

REGRAS:
1. Só fala de Pokémon TCG. Para outros assuntos: "Parceiro, isso tá fora do meu quadrado! 🃏"
2. Você NUNCA inventa cartas ou sugere nomes de cartas por conta própria.
3. Quando der para análise de deck/combate, o sistema já calculou os problemas e escolheu as cartas.
   Você APENAS transforma esses dados em uma explicação amigável e motivadora.
4. Resposta curta e direta — não enrole.

Tom desejado:
"Olha só, parceiro... teu deck tem ideia boa, mas tá enguiçando na largada. Tem pouca carta de busca e isso faz você depender demais da sorte. Testaria mais consistência antes de mexer nos atacantes."

FORMATO (JSON):
{ "message": "resposta aqui" }

Não liste cartas na mensagem — o sistema já mostra os cards visuais. Só explique os problemas e o raciocínio.`;

// ── Chamadas de IA ─────────────────────────────────────────────────────────────

async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("no_key");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: 512,
      temperature: 0.8,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content ?? "{}";
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("no_key");

  for (const model of ["gemini-2.0-flash-lite", "gemini-2.0-flash"]) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 512, temperature: 0.8 }
        })
      });
      if (!res.ok) continue;
      const data = await res.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      if (text) return text;
    } catch { continue; }
  }
  throw new Error("Gemini unavailable");
}

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("no_key");

  for (const model of ["claude-haiku-4-5", "claude-3-haiku-20240307"]) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model, max_tokens: 512, system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (!res.ok) continue;
      const data = await res.json() as { content?: Array<{ type: string; text: string }> };
      return data.content?.find((c) => c.type === "text")?.text ?? "{}";
    } catch { continue; }
  }
  throw new Error("Claude unavailable");
}

async function getAIExplanation(prompt: string): Promise<string> {
  // Groq primeiro (gratuito e rápido)
  if (process.env.GROQ_API_KEY) {
    try { return await callGroq(prompt); }
    catch (e) { console.warn("[Prof] Groq:", e instanceof Error ? e.message : e); }
  }
  // Gemini
  if (process.env.GEMINI_API_KEY) {
    try { return await callGemini(prompt); }
    catch (e) { console.warn("[Prof] Gemini:", e instanceof Error ? e.message : e); }
  }
  // Claude
  if (process.env.ANTHROPIC_API_KEY) {
    try { return await callClaude(prompt); }
    catch (e) { console.warn("[Prof] Claude:", e instanceof Error ? e.message : e); }
  }
  return ""; // sem IA → fallback
}

function parseMessage(text: string): string {
  const m = text.match(/\{[\s\S]*?\}/);
  if (!m) return text.trim();
  try { return (JSON.parse(m[0]) as { message?: string }).message ?? text; }
  catch { return text.trim(); }
}

// ── Fallback de regras (sem IA) ───────────────────────────────────────────────

const FALLBACK_DRAW = "Parceiro, suas cartas de compra estão na miséria! Adiciona mais Professor's Research e Iono que a vida melhora muito.";
const FALLBACK_SEARCH = "Tô vendo que você não acha seus Pokémon fácil. Enfia mais Nest Ball e Ultra Ball que o deck fica bem mais consistente!";
const FALLBACK_ENERGY = "Energia demais não é força, é peso! Trocar o excesso por aceleração faz muito mais diferença.";
const FALLBACK_GENERIC = "Teu deck tem potencial, parceiro! Ativa o servidor de IA (GROQ_API_KEY) que te dou uma análise completa. Por ora, os clássicos aqui nunca decepcionam.";
const FALLBACK_MATCH = "Combate difícil! Com base no que você descreveu, aqui estão os ajustes principais. Ativa a IA pra eu conseguir explicar melhor cada ponto.";

// ── ACTION: Chat geral ────────────────────────────────────────────────────────

export async function askProfessor(messages: ChatMessage[]): Promise<ProfessorResponse> {
  try {
    const lastMsg = messages[messages.length - 1]?.content ?? "";
    const lower = lastMsg.toLowerCase();

    // Tópicos fora do TCG
    const offTopic = /receita|culinária|política|futebol|música|filme|série|novela|notícia|matemática/.test(lower);
    if (offTopic) {
      return { message: "Parceiro, isso tá fora do meu quadrado! 🃏 Só falo de Pokémon TCG aqui!", suggestedCards: [] };
    }

    // Saudação curta
    if (lower.length < 15 || /^(oi|olá|salve|hey|test|online)/.test(lower)) {
      return {
        message: "Salve, parceiro! 🔥 Sou o Professor Enguiça, treinador de decks da Liga Zikachu!\n\nManda seu deck, pergunta sobre uma carta ou me conta como foi seu último combate. Tô aqui pra te evoluir! ⚡",
        suggestedCards: []
      };
    }

    // Tentar resposta da IA
    const prompt = `Usuário perguntou: "${lastMsg}"\n\nResponda como Professor Enguiça. Se precisar sugerir cartas específicas, NÃO cite nomes — apenas explique o que o deck precisa. Formato JSON: { "message": "..." }`;
    const rawText = await getAIExplanation(prompt);
    const message = rawText ? parseMessage(rawText) : FALLBACK_GENERIC;

    // Para perguntas gerais no chat, não buscar cartas automaticamente
    // (cartas só aparecem quando há contexto de deck ou análise)
    return { message, suggestedCards: [] };

  } catch (err) {
    console.error("[Prof chat error]", err);
    return { message: "Ixe, deu ruim no servidor! Tenta de novo em alguns segundos. 📡", suggestedCards: [] };
  }
}

// ── ACTION: Análise de deck ───────────────────────────────────────────────────

export async function analyzeDeckAction(deckList: string): Promise<DeckAnalysisResult> {
  try {
    const parsed = parseDeckList(deckList);
    if (parsed.totalCards === 0) {
      return { totalCards: 0, issues: ["Formato inválido"], message: "Ixe, não consegui ler seu deck! Use o formato:\n4 Ultra Ball\n2 Boss's Orders", suggestedCards: [] };
    }

    // 1. DeckAnalyzer calcula problemas objetivos
    const analysis = analyzeDeck(parsed);

    // 2. DeckRecommender busca cartas reais
    const suggestions: DeckSuggestion[] = await buildSuggestions(analysis);

    // 3. IA apenas explica o resultado já calculado
    const deckSummary = `Deck com ${analysis.totalCards} cartas. Problemas detectados: ${analysis.issues.join("; ") || "nenhum crítico"}.
Draw cards: ${analysis.drawCount}. Search cards: ${analysis.searchCount}. Energias: ${analysis.categories.energy}.
Cartas sugeridas pelo sistema: ${suggestions.map((s) => s.card.name).join(", ")}.`;

    const prompt = `${deckSummary}\n\nExplique brevemente como Professor Enguiça. NÃO cite nomes de cartas — só explique os problemas. JSON: { "message": "..." }`;
    const rawText = await getAIExplanation(prompt);

    const fallback = analysis.drawCount < 3 ? FALLBACK_DRAW
      : analysis.searchCount < 3 ? FALLBACK_SEARCH
      : analysis.categories.energy > 15 ? FALLBACK_ENERGY
      : FALLBACK_GENERIC;

    const message = rawText ? parseMessage(rawText) : fallback;

    return {
      totalCards: analysis.totalCards,
      issues: analysis.issues,
      message,
      suggestedCards: suggestions.map((s) => ({ ...s.card, reason: s.reason }))
    };
  } catch (err) {
    console.error("[DeckAnalyzer error]", err);
    return { totalCards: 0, issues: [], message: "Deu erro ao analisar! Tenta de novo. 📻", suggestedCards: [] };
  }
}

// ── ACTION: Análise de combate ────────────────────────────────────────────────

export async function analyzeMatchAction(matchSummary: string): Promise<MatchAnalysisResult> {
  try {
    if (matchSummary.trim().length < 10) {
      return { problems: [], message: "Conta mais sobre o combate, parceiro! O que aconteceu? Placar, problemas que teve...", suggestedCards: [] };
    }

    // 1. Detectar problemas por regras
    const issues = detectMatchIssues(matchSummary);

    // 2. Buscar cartas reais para os problemas
    const suggestions = await fetchMatchSuggestions(issues);

    // 3. IA explica o diagnóstico
    const context = issues.length > 0
      ? `Problemas detectados: ${issues.map((i) => i.problem).join("; ")}. Cartas sugeridas pelo sistema: ${suggestions.map((s) => s.card.name).join(", ")}.`
      : "Nenhum problema específico detectado pelas regras.";

    const prompt = `Relato de combate: "${matchSummary}"\n${context}\n\nExplique como Professor Enguiça: problema principal, causa provável no deck, sugestão estratégica. NÃO cite nomes de cartas. JSON: { "message": "..." }`;
    const rawText = await getAIExplanation(prompt);
    const message = rawText ? parseMessage(rawText) : FALLBACK_MATCH;

    return {
      problems: issues.map((i) => i.problem),
      message,
      suggestedCards: suggestions.map((s) => ({ ...s.card, reason: s.reason }))
    };
  } catch (err) {
    console.error("[MatchAnalyzer error]", err);
    return { problems: [], message: "Deu erro ao analisar o combate. Tenta de novo! 📻", suggestedCards: [] };
  }
}
