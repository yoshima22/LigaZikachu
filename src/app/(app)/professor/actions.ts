"use server";

import { searchCards, fetchCardsByNames } from "@/lib/card-service";
import type { TcgCard } from "@/lib/card-service";
import { resolveCardName, PT_TO_EN } from "@/lib/card-names-ptbr";
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

const SYSTEM_PROMPT = `Você é o Professor Enguiça, treinador de decks da Liga Zikachu.
Personalidade: engraçado, esperto, provocador leve, fala simples, útil, sem humilhar.
Frases curtas. Humor de campeonato. Português brasileiro informal.

REGRAS:
1. Só fala de Pokémon TCG. Para outros assuntos: "Parceiro, isso tá fora do meu quadrado! 🃏"
2. Quando receber dados de cartas reais, use essas informações para explicar.
3. Nunca invente nome, habilidade ou custo de carta.
4. Resposta curta e direta — sem enrolar.

FORMATO: Responda apenas com a mensagem em texto. Sem JSON, sem markdown, só o texto.`;

// ── Extrair nomes de cartas da mensagem do usuário ────────────────────────────

function extractCardNames(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  // Verificar mapeamento PT→EN
  for (const [pt, en] of Object.entries(PT_TO_EN)) {
    if (lower.includes(pt)) found.push(en);
  }

  // Palavras com maiúscula que podem ser nomes de cartas em inglês
  const possibleEN = text.match(/\b[A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+)*\b/g) ?? [];
  for (const name of possibleEN) {
    if (name.length > 3 && !["The", "A", "An", "What", "How", "Why", "When", "Can", "You", "Your"].includes(name)) {
      found.push(name);
    }
  }

  return [...new Set(found)].slice(0, 4);
}

// ── Buscar cartas relevantes para o contexto da pergunta ──────────────────────

async function findRelevantCards(message: string): Promise<TcgCard[]> {
  const lower = message.toLowerCase();

  // 1. Cartas mencionadas diretamente
  const mentioned = extractCardNames(message);
  if (mentioned.length > 0) {
    const cards = await fetchCardsByNames(mentioned);
    if (cards.length > 0) return cards;
  }

  // 2. Por categoria de pergunta
  if (/compra|draw|roub|puxar|mão vazia|consistên/.test(lower)) {
    return fetchCardsByNames(["Professor's Research", "Iono", "Colress's Experiment"]);
  }
  if (/busca|search|achar|encontrar|baralho/.test(lower)) {
    return fetchCardsByNames(["Nest Ball", "Ultra Ball", "Buddy-Buddy Poffin"]);
  }
  if (/paralis|trava|status|confus|controle|disrupt/.test(lower)) {
    return fetchCardsByNames(["Iono", "Boss's Orders", "Path to the Peak"]);
  }
  if (/energia|energy|acelera|aceleração/.test(lower)) {
    return fetchCardsByNames(["Superior Energy Retrieval", "Dark Patch", "Earthen Vessel"]);
  }
  if (/recuar|switch|fugir|benched|recuo/.test(lower)) {
    return fetchCardsByNames(["Switch", "Escape Rope", "Switch Cart"]);
  }
  if (/recupera|ressurreição|revival|cemitério/.test(lower)) {
    return fetchCardsByNames(["Night Stretcher", "Super Rod", "Rescue Board"]);
  }
  if (/estádio|stadium|campo/.test(lower)) {
    return fetchCardsByNames(["Path to the Peak", "Beach Court", "Lost City"]);
  }

  // 3. Sem contexto específico → busca genérica direto na TCG API
  const words = message.split(/\s+/).filter((w) => w.length > 4);
  if (words.length > 0) {
    const searchTerm = resolveCardName(words[0]);
    const results = await searchCards(searchTerm, 3);
    if (results.length > 0) return results;
  }

  return [];
}

// ── Gerar resposta sem IA usando dados reais da carta ─────────────────────────

function buildSmartFallback(message: string, cards: TcgCard[]): string {
  const lower = message.toLowerCase();

  if (cards.length === 0) {
    if (/o que|como|explica|fala sobre|me conta/.test(lower)) {
      return "Parceiro, não achei essa carta no banco agora. Tenta buscar na Pokédex ou me diz o nome em inglês! 🔍";
    }
    return "Parceiro, configura a GROQ_API_KEY na Vercel e eu te respondo direitinho. Por enquanto, usa as abas de 'Analisar Deck' ou 'Analisar Combate' que funcionam sem IA! 💪";
  }

  const card = cards[0];
  const isSupporter = card.subtypes?.includes("Supporter");
  const isItem = card.subtypes?.includes("Item");
  const isPokemon = card.supertype === "Pokémon";

  // Pergunta sobre uma carta específica
  if (/o que|como funciona|explica|fala sobre|me conta|sabe sobre/.test(lower)) {
    const cardType = isSupporter ? "Apoiador" : isItem ? "Item" : isPokemon ? "Pokémon" : "carta";
    const effect = card.text ?? card.flavorText ?? "Essa carta tem efeitos especiais — veja a imagem para os detalhes!";
    return `${card.name} é um(a) ${cardType} do set ${card.set.name}. ${effect.slice(0, 120)}${effect.length > 120 ? "..." : ""} ${isSupporter ? "⚡ Apoiadores são jogados uma vez por turno, parceiro!" : ""}`;
  }

  // Sugestão por categoria
  if (/compra|draw/.test(lower)) return `Pra comprar mais cartas, ${cards.map(c => c.name).join(", ")} são os melhores do momento. Professor's Research é o mais forte! 🃏`;
  if (/busca|search/.test(lower)) return `Pra buscar Pokémon, ${cards.map(c => c.name).join(", ")} são essenciais. Sem eles o deck depende demais da sorte!`;

  return `Achei ${cards.length} carta(s) relacionada(s). Olha os cards abaixo — configura a IA na Vercel pra eu explicar melhor cada uma! 👇`;
}

// ── Chamadas de IA (simples, sem JSON) ────────────────────────────────────────

async function callAI(prompt: string): Promise<string> {
  // 1. Groq (recomendado — grátis)
  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant", max_tokens: 300, temperature: 0.9,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }]
        })
      });
      if (res.ok) {
        const d = await res.json() as { choices?: Array<{ message: { content: string } }> };
        const text = d.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch (e) { console.warn("[Prof Groq]", e); }
  }

  // 2. Gemini
  if (process.env.GEMINI_API_KEY) {
    for (const model of ["gemini-2.0-flash-lite", "gemini-2.0-flash"]) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 300, temperature: 0.9 }
          })
        });
        if (res.ok) {
          const d = await res.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> };
          const text = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) return text;
        }
      } catch { continue; }
    }
  }

  // 3. Claude
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5", max_tokens: 300, system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (res.ok) {
        const d = await res.json() as { content?: Array<{ type: string; text: string }> };
        const text = d.content?.find(c => c.type === "text")?.text?.trim();
        if (text) return text;
      }
    } catch (e) { console.warn("[Prof Claude]", e); }
  }

  return ""; // sem IA
}

// ── ACTION: Chat geral ────────────────────────────────────────────────────────

export async function askProfessor(messages: ChatMessage[]): Promise<ProfessorResponse> {
  try {
    const lastMsg = messages[messages.length - 1]?.content ?? "";
    const lower = lastMsg.toLowerCase();

    // Off-topic
    if (/receita|culinária|política|futebol|música|filme|série|novela|notícia|matemática/.test(lower)) {
      return { message: "Parceiro, isso tá fora do meu quadrado! 🃏 Só falo de Pokémon TCG aqui!", suggestedCards: [] };
    }

    // Saudação
    if (lower.length < 15 || /^(oi|olá|salve|hey|test|online|tudo)/.test(lower.trim())) {
      return {
        message: "Salve, parceiro! 🔥 Sou o Professor Enguiça!\n\nMe pergunta sobre cartas, manda seu deck pra análise ou conta como foi seu último combate. Tô aqui pra te evoluir! ⚡",
        suggestedCards: []
      };
    }

    // Buscar cartas relevantes SEMPRE
    const cards = await findRelevantCards(lastMsg);

    // Montar prompt com contexto real
    const cardContext = cards.length > 0
      ? `\n\nCartas encontradas no banco:\n${cards.map(c => `- ${c.name} (${c.supertype}${c.subtypes?.length ? "/" + c.subtypes[0] : ""}): ${(c.text ?? "").slice(0, 100)}`).join("\n")}`
      : "";

    const prompt = `${lastMsg}${cardContext}\n\nResponda como Professor Enguiça. Máximo 2 frases. Se tiver cartas acima, mencione uma pelo nome. Sem JSON.`;

    const aiText = await callAI(prompt);
    const message = aiText || buildSmartFallback(lastMsg, cards);

    return {
      message,
      suggestedCards: cards.map(c => ({ ...c, reason: c.subtypes?.[0] ?? c.supertype }))
    };
  } catch (err) {
    console.error("[Prof error]", err);
    return { message: "Ixe, deu ruim no servidor! Tenta de novo. 📡", suggestedCards: [] };
  }
}

// ── ACTION: Análise de deck ───────────────────────────────────────────────────

export async function analyzeDeckAction(deckList: string): Promise<DeckAnalysisResult> {
  try {
    const parsed = parseDeckList(deckList);
    if (parsed.totalCards === 0) {
      return { totalCards: 0, issues: ["Formato inválido"], message: "Ixe, não consegui ler seu deck! Use o formato:\n4 Ultra Ball\n2 Boss's Orders", suggestedCards: [] };
    }

    const analysis = analyzeDeck(parsed);
    const suggestions: DeckSuggestion[] = await buildSuggestions(analysis);

    const deckSummary = `Deck: ${analysis.totalCards}/60 cartas. Draw: ${analysis.drawCount}. Search: ${analysis.searchCount}. Energias: ${analysis.categories.energy}. Problemas: ${analysis.issues.join("; ") || "nenhum crítico"}.`;
    const cardList = suggestions.map(s => `${s.card.name}: ${s.reason}`).join("; ");
    const prompt = `${deckSummary}\nCartas sugeridas pelo sistema: ${cardList}\n\nComente em 2-3 frases como Professor Enguiça. Mencione os problemas principais. Sem JSON.`;

    const aiText = await callAI(prompt);
    const fallback = analysis.drawCount < 3 ? "Parceiro, teu deck tá na seca de compra! Adiciona mais apoiadores de draw que a vida melhora muito."
      : analysis.searchCount < 3 ? "Tô vendo que você não acha seus Pokémon fácil. Mais bolas de busca resolve boa parte disso!"
      : analysis.categories.energy > 15 ? "Energia demais não é força — é peso! Troca o excesso por aceleração de energia."
      : "Deck razoável, parceiro! Mas dá pra apertar a consistência com as sugestões abaixo.";

    return { totalCards: analysis.totalCards, issues: analysis.issues, message: aiText || fallback, suggestedCards: suggestions.map(s => ({ ...s.card, reason: s.reason })) };
  } catch (err) {
    console.error("[DeckAnalyzer]", err);
    return { totalCards: 0, issues: [], message: "Deu erro ao analisar! Tenta de novo. 📻", suggestedCards: [] };
  }
}

// ── ACTION: Análise de combate ────────────────────────────────────────────────

export async function analyzeMatchAction(matchSummary: string): Promise<MatchAnalysisResult> {
  try {
    if (matchSummary.trim().length < 10) {
      return { problems: [], message: "Conta mais sobre o combate, parceiro! O que aconteceu? Placar, problemas que teve...", suggestedCards: [] };
    }

    const issues = detectMatchIssues(matchSummary);
    const suggestions = await fetchMatchSuggestions(issues);

    const context = issues.length > 0 ? `Problemas detectados: ${issues.map(i => i.problem).join("; ")}.` : "";
    const cardList = suggestions.map(s => s.card.name).join(", ");
    const prompt = `Relato: "${matchSummary}"\n${context}\nCartas sugeridas: ${cardList || "nenhuma específica"}.\n\nExplique em 2-3 frases como Professor Enguiça: problema principal e sugestão estratégica. Sem JSON.`;

    const aiText = await callAI(prompt);
    const fallback = issues.length > 0
      ? `Parceiro, identificamos ${issues.length} problema(s): ${issues.map(i => i.problem.toLowerCase()).join(" e ")}. As cartas abaixo podem resolver isso!`
      : "Combate difícil! Olha as sugestões abaixo e adapta ao seu estilo.";

    return { problems: issues.map(i => i.problem), message: aiText || fallback, suggestedCards: suggestions.map(s => ({ ...s.card, reason: s.reason })) };
  } catch (err) {
    console.error("[MatchAnalyzer]", err);
    return { problems: [], message: "Deu erro ao analisar o combate. Tenta de novo! 📻", suggestedCards: [] };
  }
}
