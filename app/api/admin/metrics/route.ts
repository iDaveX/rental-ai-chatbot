import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LISTINGS } from "@/data/listings";
import { getSuspiciousReason } from "@/lib/moderation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const validListingIds = new Set(LISTINGS.map((listing) => listing.id));

  const { data: allConversations } = await supabase
    .from("conversations")
    .select("id, listing_slug, sentiment, appointment_booked, stage");

  const candidateConversations = (allConversations ?? []).filter(
    (conversation) =>
      conversation.listing_slug && validListingIds.has(conversation.listing_slug),
  );

  const conversationIds = candidateConversations.map((conversation) => conversation.id);

  const { data: userMessages } =
    conversationIds.length > 0
      ? await supabase
          .from("messages")
          .select("conversation_id, content, created_at")
          .eq("role", "user")
          .in("conversation_id", conversationIds)
      : { data: [] };

  const latestUserMessageByConversation = (userMessages ?? []).reduce<
    Record<string, { content: string; created_at: string }>
  >((acc, message) => {
    const existing = acc[message.conversation_id];
    if (!existing || new Date(message.created_at).getTime() > new Date(existing.created_at).getTime()) {
      acc[message.conversation_id] = {
        content: message.content,
        created_at: message.created_at,
      };
    }
    return acc;
  }, {});

  const cleanConversations = candidateConversations.filter((conversation) => {
    const latestUserMessage = latestUserMessageByConversation[conversation.id]?.content;
    return !getSuspiciousReason(latestUserMessage);
  });

  const cleanConversationIds = cleanConversations.map((conversation) => conversation.id);

  const [{ data: renterMessagesData }, { data: assistantMessagesData }] =
    cleanConversationIds.length > 0
      ? await Promise.all([
          supabase
            .from("messages")
            .select("id")
            .eq("role", "user")
            .in("conversation_id", cleanConversationIds),
          supabase
            .from("messages")
            .select("response_time_ms")
            .eq("role", "assistant")
            .in("conversation_id", cleanConversationIds),
        ])
      : [{ data: [] }, { data: [] }];

  const total_messages = renterMessagesData?.length ?? 0;

  const responseTimes = (assistantMessagesData ?? [])
    .map((m) => m.response_time_ms)
    .filter((t) => t != null) as number[];

  const avg_response_time_ms =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

  const appointments_booked =
    cleanConversations.filter((c) => c.appointment_booked).length;

  const sentimentCounts = { positive: 0, neutral: 0, concerned: 0, negative: 0 };
  for (const c of cleanConversations) {
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
    count: cleanConversations.filter((c) => c.stage === stage).length,
  }));

  const sentimentByListing = cleanConversations.reduce<
    Record<string, { positive: number; neutral: number; negative: number }>
  >((acc, row) => {
    const slug = row.listing_slug ?? "unknown";
    if (!acc[slug]) {
      acc[slug] = { positive: 0, neutral: 0, negative: 0 };
    }

    if (row.sentiment === "positive") acc[slug].positive += 1;
    else if (row.sentiment === "negative") acc[slug].negative += 1;
    else acc[slug].neutral += 1;

    return acc;
  }, {});

  return NextResponse.json(
    {
      total_conversations: cleanConversations.length,
      total_messages,
      avg_response_time_ms,
      appointments_booked,
      sentiment_distribution: sentimentCounts,
      funnel,
      sentimentByListing,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      },
    },
  );
}
