import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const [
    { count: total_conversations },
    { data: messagesData },
    { data: conversationsData },
    { data: stageCounts },
  ] =
    await Promise.all([
      supabase.from("conversations").select("*", { count: "exact", head: true }),
      supabase.from("messages").select("role, response_time_ms").eq("role", "assistant"),
      supabase.from("conversations").select("sentiment, appointment_booked"),
      supabase.from("conversations").select("stage"),
    ]);

  const total_messages = messagesData?.length ?? 0;

  const responseTimes = (messagesData ?? [])
    .map((m) => m.response_time_ms)
    .filter((t) => t != null) as number[];

  const avg_response_time_ms =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

  const appointments_booked =
    (conversationsData ?? []).filter((c) => c.appointment_booked).length;

  const sentimentCounts = { positive: 0, neutral: 0, concerned: 0, negative: 0 };
  for (const c of conversationsData ?? []) {
    const s = c.sentiment as keyof typeof sentimentCounts;
    if (s in sentimentCounts) sentimentCounts[s]++;
  }

  const funnel = [
    "greeting",
    "qualification",
    "info_exchange",
    "soft_nudge",
    "appointment",
    "closed",
  ].map((stage) => ({
    stage,
    count: stageCounts?.filter((c) => c.stage === stage).length || 0,
  }));

  return NextResponse.json({
    total_conversations: total_conversations ?? 0,
    total_messages,
    avg_response_time_ms,
    appointments_booked,
    sentiment_distribution: sentimentCounts,
    funnel,
  });
}
