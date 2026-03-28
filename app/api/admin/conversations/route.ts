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

  const { data: conversations } = await supabase
    .from("conversations")
    .select(
      "id, session_id, listing_slug, stage, sentiment, appointment_booked, started_at, last_message_at",
    )
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (!conversations || conversations.length === 0) {
    return NextResponse.json(
      {
        conversations: [],
        hidden: { suspicious: 0, legacy: 0 },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        },
      },
    );
  }

  const validListingIds = new Set(LISTINGS.map((listing) => listing.id));

  // Для каждого разговора — количество сообщений и последнее сообщение пользователя
  const enriched = await Promise.all(
    conversations.map(async (conv) => {
      const [{ count }, { data: lastMsg }, { data: latestMessage }] = await Promise.all([
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("conversation_id", conv.id),
        supabase
          .from("messages")
          .select("content")
          .eq("conversation_id", conv.id)
          .eq("role", "user")
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("messages")
          .select("created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      const latestUserMessage = lastMsg?.[0]?.content ?? "";
      const suspicious_reason = getSuspiciousReason(latestUserMessage);
      const is_legacy = !conv.listing_slug || !validListingIds.has(conv.listing_slug);

      return {
        ...conv,
        message_count: count ?? 0,
        last_user_message:
          suspicious_reason === "prompt_injection"
            ? "Подозрительный системный запрос скрыт"
            : suspicious_reason === "toxic"
              ? "Токсичное сообщение скрыто"
              : latestUserMessage,
        activity_at:
          latestMessage?.[0]?.created_at ??
          conv.last_message_at ??
          conv.started_at,
        suspicious_reason,
        is_legacy,
      };
    }),
  );

  const cleanConversations = enriched
    .filter((conversation) => !conversation.suspicious_reason && !conversation.is_legacy)
    .sort(
      (a, b) =>
        new Date(b.activity_at).getTime() - new Date(a.activity_at).getTime(),
    )
    .slice(0, 50);

  const hidden = enriched.reduce(
    (acc, conversation) => {
      if (conversation.suspicious_reason) acc.suspicious += 1;
      if (conversation.is_legacy) acc.legacy += 1;
      return acc;
    },
    { suspicious: 0, legacy: 0 },
  );

  return NextResponse.json(
    {
      conversations: cleanConversations,
      hidden,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      },
    },
  );
}
