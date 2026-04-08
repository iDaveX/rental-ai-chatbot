import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function getAnthropicClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

function getGroqClient() {
  return new OpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
  });
}

async function callLLM(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens = 200,
  temperature = 0.3,
) {
  const anthropic = getAnthropicClient();

  try {
    const res = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: maxTokens,
      system,
      messages,
      temperature,
    });

    return res.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("Anthropic unavailable, falling back to Groq:", message);

    const groq = getGroqClient();
    const res = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        ...(system ? [{ role: "system" as const, content: system }] : []),
        ...messages,
      ],
      temperature,
      max_tokens: maxTokens,
    });

    return res.choices[0].message.content?.trim() ?? "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: messages, error } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const messagesText = (messages || [])
      .map((message) => `${message.role === "user" ? "Арендатор" : "Агент"}: ${message.content}`)
      .join("\n");

    const raw =
      (await callLLM(
        "",
        [
          {
            role: "user",
            content: `Ты аналитик диалогов по аренде. Проанализируй диалог и верни ТОЛЬКО валидный JSON.
ВАЖНО: не используй эмодзи в ответе. Только текст.

ДИАЛОГ:
${messagesText || "(пусто)"}

Верни JSON:
{
  "lead_quality": <число 1-10, где 10 = очень горячий лид>,
  "outcome": "<Запись на просмотр | Интерес без записи | Отказ | В процессе>",
  "appointment": "<время просмотра если договорились, иначе null>",
  "key_concern": "<главное возражение арендатора если было, иначе null>",
  "summary": "<1-2 предложения: кто, что хотел, чем закончилось>"
}`,
          },
        ],
        200,
        0.3,
      )) || "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    try {
      return NextResponse.json(JSON.parse(cleaned));
    } catch {
      return NextResponse.json({
        lead_quality: 5,
        outcome: "В процессе",
        appointment: null,
        key_concern: null,
        summary: "Не удалось уверенно извлечь саммари. Проверьте диалог вручную.",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
