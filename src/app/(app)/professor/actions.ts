"use server";

import { fetchCardsByNames } from "@/lib/card-service";
import type { TcgCard } from "@/lib/card-service";

export interface ChatMessage {
  role: "user" | "professor";
  content: string;
}

export interface ProfessorResponse {
  message: string;
  suggestedCards: Array<TcgCard & { reason: string }>;
  error?: string;
}

const SYSTEM_PROMPT = `Você é o Professor Enguiça, o treinador de decks da Liga Zikachu.
Você é direto, animado, usa gírias leves do dia a dia e fala português brasileiro informal.
Você é especialista em Pokémon TCG e ajuda jogadores a melhorar seus decks.

Regras importantes:
- SEMPRE que sugerir cartas, liste os nomes EXATOS de cartas reais do Pokémon TCG no campo JSON.
- Nunca invente cartas. Use apenas cartas que realmente existem.
- Seja objetivo e prático — jogador quer melhorar, não uma aula.
- Máximo 3-5 sugestões de cartas por resposta.
- Se o usuário mandar uma decklist, analise os pontos fracos e sugira melhorias diretas.

Formato da sua resposta (SEMPRE use este JSON):
{
  "message": "sua mensagem amigável aqui",
  "cards": ["Professor's Research", "Ultra Ball", "Boss's Orders"]
}

O sistema vai buscar as imagens e dados reais das cartas automaticamente.
Só inclua cartas se fizer sentido para a pergunta. Para perguntas gerais sem necessidade de carta, use "cards": [].`;

async function callClaudeAPI(
  messages: ChatMessage[]
): Promise<{ message: string; cardNames: string[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      message: "E aí, parceiro! Sou o Professor Enguiça, mas parece que minha conexão com o servidor de IA está fora. Fala com o admin pra ativar a ANTHROPIC_API_KEY! 🔧",
      cardNames: []
    };
  }

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

  if (!res.ok) {
    throw new Error(`Claude API error: ${res.status}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
  };

  const text = data.content.find((c) => c.type === "text")?.text ?? "{}";

  // Extrair JSON da resposta
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { message: text, cardNames: [] };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      message?: string;
      cards?: string[];
    };
    return {
      message: parsed.message ?? text,
      cardNames: parsed.cards ?? []
    };
  } catch {
    return { message: text, cardNames: [] };
  }
}

export async function askProfessor(
  messages: ChatMessage[]
): Promise<ProfessorResponse> {
  try {
    const { message, cardNames } = await callClaudeAPI(messages);

    let suggestedCards: Array<TcgCard & { reason: string }> = [];

    if (cardNames.length > 0) {
      const cards = await fetchCardsByNames(cardNames);

      // Mapear motivos às cartas (simplificado — a IA dá o contexto na mensagem)
      suggestedCards = cards.map((card, i) => ({
        ...card,
        reason: `Sugestão ${i + 1}: ${card.name}`
      }));
    }

    return { message, suggestedCards };
  } catch (err) {
    return {
      message: "Ixe, deu um erro aqui no meu rádio! Tenta de novo, parceiro. 📻",
      suggestedCards: [],
      error: err instanceof Error ? err.message : "Erro desconhecido"
    };
  }
}
