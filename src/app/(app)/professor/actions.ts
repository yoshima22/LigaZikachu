"use server";

import { searchCards, fetchCardsByNames, searchStandardByFunction, searchSimilarEffect, isStandardLegal } from "@/lib/card-service";
import { buildMetaContext, getMetaSnapshot, getArchetypeResults } from "@/lib/limitless-service";
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
2. Nunca invente nome ou efeito de carta — use apenas cartas que você conhece do TCG.
3. Lembre do contexto anterior da conversa.
4. Quando sugerir cartas, priorize cartas legais no Standard atual (2025).
5. IMPORTANTE sobre legalidade:
   - Se uma carta saiu do Standard por ROTAÇÃO, diga "saiu do Standard por rotação" — NÃO diga "está banida"
   - Banimento é quando a Pokémon Company proíbe explicitamente — muito raro no Standard
   - Rotação é normal e acontece todo ano — a carta ainda pode ser usada em Expanded
6. Quando sugerir cartas específicas, liste os nomes em inglês no campo "cards".

FORMATO DE RESPOSTA (JSON obrigatório):
{
  "message": "sua resposta aqui (2-4 frases no máximo)",
  "cards": ["Professor's Research", "Iono"]
}

Use "cards": [] quando não precisar sugerir cartas.
Os cards serão buscados na TCG API e mostrados como imagens reais — não repita o nome deles na mensagem.`;

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

// ── Buscar cartas relevantes via TCG API (sem hardcode de nomes) ──────────────

function deduplicateCards(cards: TcgCard[]): TcgCard[] {
  const seen = new Set<string>();
  return cards.filter(c => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });
}

// Extrair contexto acumulado de toda a conversa
function buildConversationContext(messages: ChatMessage[]): string {
  // Últimas 6 mensagens do usuário para entender o tema
  return messages
    .filter(m => m.role === "user")
    .slice(-6)
    .map(m => m.content.toLowerCase())
    .join(" ");
}

async function findRelevantCards(messages: ChatMessage[]): Promise<TcgCard[]> {
  const lastMsg = messages[messages.length - 1]?.content ?? "";
  const fullContext = buildConversationContext(messages);
  const allCards: TcgCard[] = [];

  // 1. Cartas mencionadas explicitamente (com filtro Standard automático)
  const mentioned = extractCardNames(lastMsg);
  if (mentioned.length > 0) {
    const namedCards = await fetchCardsByNames(mentioned, true);
    // fetchCardsByNames já filtra por regulation mark — só retorna Standard-legais
    allCards.push(...namedCards);
  }

  // 2. Busca dinâmica por contexto acumulado da conversa
  const ctx = fullContext; // inclui mensagens anteriores

  const tasks: Promise<TcgCard[]>[] = [];

  if (/compra|draw|roub|puxar|mão vazia|similar.*iono|alternativa.*iono|parecid.*iono|apoiador.*draw/.test(ctx)) {
    tasks.push(searchStandardByFunction("DRAW", 8));
  }
  if (/busca|search|achar|encontrar|baralho|bola/.test(ctx)) {
    tasks.push(searchStandardByFunction("SEARCH", 8));
  }
  if (/paralis|trava|disrupt|embaralha|mão adversário|bagunça/.test(ctx)) {
    tasks.push(searchStandardByFunction("DISRUPTION", 6));
    tasks.push(searchSimilarEffect("shuffle", "Supporter", 4));
  }
  if (/recuar|switch|fugir|recuo|mover/.test(ctx)) {
    tasks.push(searchStandardByFunction("SWITCH", 6));
  }
  if (/energia|acelera|aceleração|attach energy/.test(ctx)) {
    tasks.push(searchStandardByFunction("ACCELERATION", 6));
  }
  if (/recupera|ressurreição|cemitério|discard|recuperar/.test(ctx)) {
    tasks.push(searchStandardByFunction("RECOVERY", 6));
  }

  if (tasks.length > 0) {
    const results = await Promise.allSettled(tasks);
    for (const r of results) {
      if (r.status === "fulfilled") allCards.push(...r.value);
    }
  }

  // 3. Fallback: busca por palavras-chave significativas
  if (allCards.length < 3) {
    const words = lastMsg.split(/\s+/).filter(w =>
      w.length > 4 &&
      !/^(que|como|para|isso|meu|minha|você|uma|um|com|não|mais|tem|quando|deck|carta|seria)$/i.test(w)
    );
    for (const word of words.slice(0, 2)) {
      const found = await searchCards(resolveCardName(word), 6);
      // Filtrar por Standard antes de adicionar
      allCards.push(...found.filter(isStandardLegal));
    }
  }

  // Deduplicar e retornar até 6 cartas (Standard legais garantidas)
  return deduplicateCards(allCards.filter(isStandardLegal)).slice(0, 6);
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

// Modelos Groq disponíveis — do mais inteligente para o mais rápido
const GROQ_MODELS = [
  "llama-3.3-70b-versatile",   // 70B — principal, muito mais inteligente
  "llama-3.1-70b-versatile",   // fallback 70B
  "llama3-70b-8192",            // outro 70B
  "llama-3.1-8b-instant",      // último recurso — rápido mas menor
];

interface AIResult { message: string; cardNames: string[] }

async function callAI(
  messages: ChatMessage[],
  extraContext?: string
): Promise<AIResult> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return { message: "", cardNames: [] };

  // Passar histórico completo (últimas 10 mensagens para não estourar tokens)
  const history = messages.slice(-10).map(m => ({
    role: m.role === "professor" ? "assistant" : "user",
    content: m.content
  }));

  // Injetar contexto extra como mensagem de sistema adicional
  const systemFull = extraContext
    ? `${SYSTEM_PROMPT}\n\nCONTEXTO ADICIONAL:\n${extraContext}`
    : SYSTEM_PROMPT;

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model,
          max_tokens: 500,
          temperature: 0.85,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemFull },
            ...history
          ]
        })
      });

      if (!res.ok) {
        console.warn(`[Prof/${model}] ${res.status}`);
        continue;
      }

      const d = await res.json() as { choices?: Array<{ message: { content: string } }> };
      const raw = d.choices?.[0]?.message?.content?.trim() ?? "{}";

      try {
        const parsed = JSON.parse(raw) as { message?: string; cards?: string[] };
        if (parsed.message) {
          console.log(`[Prof] ${model} → ${parsed.cards?.length ?? 0} cards`);
          return {
            message: parsed.message,
            cardNames: parsed.cards ?? []
          };
        }
      } catch {
        // Se não parseou como JSON, usa como texto direto
        if (raw.length > 5) return { message: raw, cardNames: [] };
      }
    } catch (e) {
      console.warn(`[Prof/${model}]:`, e instanceof Error ? e.message : e);
    }
  }

  return { message: "", cardNames: [] };
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

    // 0. Buscar contexto real do meta no Limitless TCG (se disponível)
    const metaCtx = await buildMetaContext(lastMsg);

    // 1. Chamar IA com histórico completo + dados reais do meta
    const { message: aiMessage, cardNames } = await callAI(messages, metaCtx || undefined);

    // 2. Resolver nomes PT→EN e buscar cartas reais na TCG API
    const resolvedNames = cardNames.map(resolveCardName);
    const rawAiCards = resolvedNames.length > 0
      ? await fetchCardsByNames(resolvedNames, true)
      : [];

    // 3. Filtrar apenas cartas Standard legais pela Regulation Mark
    const aiCards = rawAiCards.filter(isStandardLegal);

    // 4. Se a IA não sugeriu cards válidos, busca contextual com histórico completo
    const contextCards = aiCards.length < 3
      ? await findRelevantCards(messages)
      : [];

    // Mesclar: cartas da IA + contexto, sem repetir
    const finalCards = deduplicateCards([...aiCards, ...contextCards])
      .filter(isStandardLegal)
      .slice(0, 6); // sempre pelo menos 5-6 cartas

    // 4. Fallback de mensagem se a IA falhou
    const message = aiMessage || buildSmartFallback(lastMsg, finalCards);

    return {
      message,
      suggestedCards: finalCards.map(c => ({ ...c, reason: c.subtypes?.[0] ?? c.supertype }))
    };
  } catch (err) {
    console.error("[Prof error]", err);
    return { message: "Ixe, deu ruim no servidor! Tenta de novo. 📡", suggestedCards: [] };
  }
}

// ── ACTION: Dados do meta Limitless TCG ──────────────────────────────────────

export interface MetaData {
  available: boolean;
  archetypes: Array<{ name: string; count: number; topFinishes: number }>;
  error?: string;
}

export async function getMetaData(): Promise<MetaData> {
  if (!process.env.LIMITLESS_API_KEY) {
    return { available: false, archetypes: [], error: "LIMITLESS_API_KEY não configurada. Adicione na Vercel para dados do meta." };
  }
  try {
    const archetypes = await getMetaSnapshot(4);
    return { available: true, archetypes };
  } catch (err) {
    return { available: false, archetypes: [], error: String(err) };
  }
}

export interface ArchetypeDecksResult {
  decks: Array<{ tournament: string; placement: number; deckName?: string; mainCards: string[] }>;
}

export async function getArchetypeData(archetype: string): Promise<ArchetypeDecksResult> {
  try {
    // Funciona sem chave — getArchetypeResults usa endpoints públicos
    const raw = await getArchetypeResults(archetype, 3);
    return {
      decks: raw.map(d => ({
        tournament: d.tournament,
        placement: d.placing,
        deckName: archetype,
        mainCards: [`${d.player} · ${d.record}`]
      }))
    };
  } catch { return { decks: [] }; }
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
    const cardList = suggestions.map(s => s.card.name).join(", ");
    const context = `${deckSummary}\nO sistema já selecionou estas cartas para mostrar: ${cardList}. Explique POR QUÊ cada uma resolve os problemas do deck. Seja direto.`;

    const { message: aiText } = await callAI(
      [{ role: "user", content: `Analise meu deck e explique as sugestões.` }],
      context
    );
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

    const context = `Relato do jogador: "${matchSummary}"
Problemas detectados pelo sistema: ${issues.map(i => i.problem).join("; ") || "nenhum específico"}
Cartas selecionadas para mostrar: ${suggestions.map(s => s.card.name).join(", ") || "nenhuma"}
Explique o problema principal, a causa provável no deck e o que as cartas sugeridas resolvem.`;

    const { message: aiText } = await callAI(
      [{ role: "user", content: matchSummary }],
      context
    );
    const fallback = issues.length > 0
      ? `Parceiro, identificamos ${issues.length} problema(s): ${issues.map(i => i.problem.toLowerCase()).join(" e ")}. As cartas abaixo podem resolver isso!`
      : "Combate difícil! Olha as sugestões abaixo e adapta ao seu estilo.";

    return { problems: issues.map(i => i.problem), message: aiText || fallback, suggestedCards: suggestions.map(s => ({ ...s.card, reason: s.reason })) };
  } catch (err) {
    console.error("[MatchAnalyzer]", err);
    return { problems: [], message: "Deu erro ao analisar o combate. Tenta de novo! 📻", suggestedCards: [] };
  }
}
