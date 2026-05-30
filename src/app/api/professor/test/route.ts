import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  const results: Record<string, unknown> = {
    gemini_key_present: !!geminiKey,
    gemini_key_prefix: geminiKey ? geminiKey.substring(0, 10) + "..." : null,
    anthropic_key_present: !!anthropicKey,
    anthropic_key_prefix: anthropicKey ? anthropicKey.substring(0, 10) + "..." : null,
    groq_key_present: !!groqKey,
    groq_key_prefix: groqKey ? groqKey.substring(0, 10) + "..." : null,
  };

  // Testar Groq
  if (groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          max_tokens: 10,
          messages: [{ role: "user", content: "ok" }]
        })
      });
      const body = await res.text();
      results["groq:llama-3.1-8b-instant"] = { status: res.status, ok: res.ok, body: body.slice(0, 100) };
    } catch (e) {
      results["groq:llama-3.1-8b-instant"] = { error: String(e) };
    }
  }

  // Testar modelos Gemini
  if (geminiKey) {
    const models = ["gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-2.5-flash-preview-05-20"];
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "ok" }] }],
            generationConfig: { maxOutputTokens: 5 }
          })
        });
        const body = await res.text();
        results[`gemini:${model}`] = { status: res.status, ok: res.ok, body: body.slice(0, 150) };
        if (res.ok) break; // Para no primeiro que funcionar
      } catch (e) {
        results[`gemini:${model}`] = { error: String(e) };
      }
    }
  }

  // Testar Claude
  if (anthropicKey) {
    const models = ["claude-haiku-4-5", "claude-3-haiku-20240307", "claude-3-5-haiku-20241022"];
    for (const model of models) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model,
            max_tokens: 10,
            messages: [{ role: "user", content: "ok" }]
          })
        });
        const body = await res.text();
        results[`claude:${model}`] = { status: res.status, ok: res.ok, body: body.slice(0, 150) };
        if (res.ok) break;
      } catch (e) {
        results[`claude:${model}`] = { error: String(e) };
      }
    }
  }

  return NextResponse.json(results);
}
