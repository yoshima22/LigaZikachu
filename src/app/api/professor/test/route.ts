import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Endpoint de diagnóstico — só admin pode acessar
// GET /api/professor/test
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const results: Record<string, unknown> = {
    gemini_key_present: !!geminiKey,
    gemini_key_prefix: geminiKey ? geminiKey.substring(0, 8) + "..." : null,
    anthropic_key_present: !!anthropicKey,
  };

  // Testar cada modelo Gemini
  if (geminiKey) {
    const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"];
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Diga apenas: ok" }] }],
            generationConfig: { maxOutputTokens: 10 }
          })
        });

        const body = await res.text();
        results[model] = {
          status: res.status,
          ok: res.ok,
          response: body.slice(0, 200)
        };
      } catch (e) {
        results[model] = { error: String(e) };
      }
    }
  }

  return NextResponse.json(results, { status: 200 });
}
