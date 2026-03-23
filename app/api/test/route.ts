import { NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 30;

export async function GET() {
  const results: Record<string, string> = {};

  // Тест 1: env-переменные видны?
  results.groq_key = process.env.GROQ_API_KEY
    ? `present (${process.env.GROQ_API_KEY.slice(0, 8)}...)`
    : "MISSING";
  results.supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL ? "present" : "MISSING";
  results.supabase_service = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? "present"
    : "MISSING";

  // Тест 2: Groq API вызов
  try {
    const groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: 'Say "ok"' }],
      max_tokens: 5,
    });
    results.groq_call = `ok: ${response.choices[0].message.content}`;
  } catch (e) {
    results.groq_call = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Тест 3: Supabase
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { error } = await supabase.from("conversations").select("id").limit(1);
    results.supabase_call = error ? `error: ${error.message}` : "ok";
  } catch (e) {
    results.supabase_call = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json(results);
}
