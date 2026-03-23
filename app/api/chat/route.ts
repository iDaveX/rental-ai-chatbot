import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import {
  buildExtractionPrompt,
  buildGenerationPrompt,
  buildStrategy,
  determineNextStage,
} from "@/lib/prompts";
import { getListingById, LISTINGS } from "@/data/listings";
import { Stage, Signals } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { message, sessionId, listingId = "usacheva-11" } = await req.json();
    const listing = getListingById(listingId) || LISTINGS[0];
    const KB = listing.kb;

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: "message and sessionId are required" },
        { status: 400 },
      );
    }

    // 1. Получить или создать conversation
    let { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (!conversation) {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          listing_slug: listingId,
          session_id: sessionId,
          stage: "greeting",
          signals: {
            interest_level: 0,
            has_objection: false,
            urgency: "low",
            readiness_to_view: 0,
            sentiment: "neutral",
          },
        })
        .select()
        .single();

      if (error) throw error;
      conversation = data;
    }

    // 2. Получить историю (последние 10 сообщений)
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(10);

    const historyText = (history || [])
      .map((m) => `${m.role === "user" ? "Арендатор" : "Агент"}: ${m.content}`)
      .join("\n");

    // 3. Сохранить сообщение пользователя
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "user",
      content: message,
    });

    // 4. EXTRACTION — извлечь сигналы (отдельный быстрый вызов)
    const extractionResponse = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: buildExtractionPrompt(message, historyText),
        },
      ],
      temperature: 0.1,
      max_tokens: 300,
    });

    let signals: Partial<Signals> = {};
    try {
      const raw = extractionResponse.choices[0].message.content || "{}";
      // Убираем markdown если модель всё же добавила ```json
      const cleaned = raw
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      signals = JSON.parse(cleaned);
    } catch {
      signals = {
        intent: "general_question",
        interest_level: 3,
        has_objection: false,
        objection_type: "none",
        urgency: "low",
        readiness_to_view: 0,
        sentiment: "neutral",
      };
    }

    const currentStage = conversation.stage as Stage;

    // Если уже в appointment и пользователь подтверждает — фиксируем
    const previousSignals = conversation.signals as { appointment_time?: string } | null;
    if (currentStage === "appointment" && previousSignals?.appointment_time) {
      signals = { ...signals, appointment_time: previousSignals.appointment_time } as Partial<
        Signals
      >;
    }

    // Извлекаем время просмотра из сообщения если оно упоминается
    if ((signals as { intent?: string }).intent === "appointment_request" || currentStage === "appointment") {
      const timeMatch = message.match(/(\d{1,2}[:h]\d{0,2}|\d{1,2}\s*(час|утра|вечера|дня))/i);
      const dayMatch = message.match(
        /(понедельник|вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ею]|завтра|сегодня)/i,
      );
      if (timeMatch || dayMatch) {
        signals = {
          ...signals,
          appointment_time: `${dayMatch?.[0] || ""} ${timeMatch?.[0] || ""}`.trim(),
        } as Partial<Signals>;
      }
    }

    // 5. STAGE TRANSITION
    const nextStage = determineNextStage(currentStage, signals);

    // 6. STRATEGY
    const strategy = buildStrategy(nextStage, signals);

    // 7. GENERATION — финальный ответ агента
    const tone = listing.tone;
    const agentName = listing.agentName;
    const systemPrompt = buildGenerationPrompt(
      nextStage,
      tone,
      signals,
      strategy,
      agentName,
      KB,
      listing.personality,
    );

    const messagesForLLM: {
      role: "system" | "user" | "assistant";
      content: string;
    }[] = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const generationResponse = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: messagesForLLM,
      temperature: 0.7,
      max_tokens: 200,
    });

    const agentReply =
      generationResponse.choices[0].message.content || "Одну секунду...";
    const responseTime = Date.now() - startTime;

    // 8. Сохранить ответ агента
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: agentReply,
      intent: signals,
      strategy: strategy,
      response_time_ms: responseTime,
    });

    // 9. Обновить conversation
    await supabase
      .from("conversations")
      .update({
        stage: nextStage,
        signals: signals,
        sentiment: (signals as Signals).sentiment || "neutral",
        last_message_at: new Date().toISOString(),
        appointment_booked:
          nextStage === "appointment" &&
          (signals as Signals).intent === "appointment_request",
      })
      .eq("id", conversation.id);

    return NextResponse.json({
      reply: agentReply,
      stage: nextStage,
      signals,
      responseTime,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("Chat API error:", message);
    console.error("Stack:", stack);
    return NextResponse.json(
      { error: "Internal server error", detail: message },
      { status: 500 },
    );
  }
}
