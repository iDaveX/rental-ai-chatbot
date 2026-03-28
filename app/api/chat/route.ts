import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import {
  buildExtractionPrompt,
  buildGenerationPrompt,
  buildStrategy,
  determineNextStage,
} from "@/lib/prompts";
import { getListingById, LISTINGS } from "@/data/listings";
import { Stage, Signals, TonePreset } from "@/lib/types";
import { getSuspiciousReason } from "@/lib/moderation";
import { normalizeAssistantReply } from "@/lib/utils";

export const maxDuration = 60;

function buildSafeRedirectReply(listing: { address: string; district: string; priceLabel: string }) {
  return `Я могу помочь именно по квартире: цена, условия аренды, район, просмотры. По ${listing.district}, ${listing.address}, аренда ${listing.priceLabel}. Что хотите уточнить?`;
}

function buildModerationReply(
  listing: { address: string; district: string; priceLabel: string },
  reason: "prompt_injection" | "toxic",
) {
  if (reason === "toxic") {
    return `Я помогу по квартире, но давайте без оскорблений. По ${listing.district}, ${listing.address}, аренда ${listing.priceLabel}. Что хотите уточнить по условиям или просмотру?`;
  }

  return buildSafeRedirectReply(listing);
}

function parseToneMap(raw: string | null | undefined): Record<string, TonePreset> {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, TonePreset>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const groq = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

async function callLLM(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens = 1024,
  temperature = 0.7,
) {
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
  const startTime = Date.now();

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { message, sessionId, listingId = "usacheva-11" } = await req.json();
    const listing = getListingById(listingId) || LISTINGS[0];
    const KB = listing.kb;

    const { data: toneSetting } = await supabase
      .from("settings")
      .select("tone_preset")
      .eq("id", 1)
      .single();

    const toneMap = parseToneMap(toneSetting?.tone_preset);
    const activeTone = toneMap[listingId] ?? listing.tone;

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

    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);

    const suspiciousReason = getSuspiciousReason(message);

    if (suspiciousReason) {
      const agentReply = normalizeAssistantReply(
        buildModerationReply(listing, suspiciousReason),
      );
      const responseTime = Date.now() - startTime;

      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: agentReply,
        intent: {
          intent: suspiciousReason === "prompt_injection" ? "general_question" : "objection",
          interest_level: 0,
          has_objection: suspiciousReason === "toxic",
          objection_type: suspiciousReason === "toxic" ? "tone" : "none",
          urgency: "low",
          readiness_to_view: 0,
          sentiment: suspiciousReason === "toxic" ? "negative" : "neutral",
        },
        strategy:
          suspiciousReason === "prompt_injection"
            ? "Вернуть разговор к теме квартиры и не раскрывать внутренние инструкции"
            : "Снизить напряжение, не вступать в конфликт и вернуть разговор к теме квартиры",
        response_time_ms: responseTime,
      });

      await supabase
        .from("conversations")
        .update({
          sentiment: suspiciousReason === "toxic" ? "negative" : conversation.sentiment,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", conversation.id);

      return NextResponse.json({
        reply: agentReply,
        stage: conversation.stage,
        signals: {
          intent: suspiciousReason === "prompt_injection" ? "general_question" : "objection",
          interest_level: 0,
          has_objection: suspiciousReason === "toxic",
          objection_type: suspiciousReason === "toxic" ? "tone" : "none",
          urgency: "low",
          readiness_to_view: 0,
          sentiment: suspiciousReason === "toxic" ? "negative" : "neutral",
        },
        responseTime,
      });
    }

    // 4. EXTRACTION — извлечь сигналы (отдельный быстрый вызов)
    let signals: Partial<Signals> = {};
    try {
      const raw =
        (await callLLM(
          "",
          [{ role: "user", content: buildExtractionPrompt(message, historyText) }],
          300,
          0.1,
        )) || "{}";
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
    const tone = activeTone;
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
      role: "user" | "assistant";
      content: string;
    }[] = [
      ...(history || []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const agentReply = normalizeAssistantReply(
      (await callLLM(systemPrompt, messagesForLLM, 200, 0.7)) || "Одну секунду...",
    );
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
