import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

    const groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });

    const { data: messages, error } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const messagesText = (messages || [])
      .map((message) => `${message.role === "user" ? "Арендатор" : "Агент"}: ${message.content}`)
      .join("\n");

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
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
      temperature: 0.3,
      max_tokens: 200,
    });

    const raw = response.choices[0].message.content || "{}";
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
