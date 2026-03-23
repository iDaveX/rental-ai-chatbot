import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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
    .limit(50);

  if (!conversations || conversations.length === 0) {
    return NextResponse.json([]);
  }

  // Для каждого разговора — количество сообщений и последнее сообщение пользователя
  const enriched = await Promise.all(
    conversations.map(async (conv) => {
      const [{ count }, { data: lastMsg }] = await Promise.all([
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("conversation_id", conv.id),
        supabase
          .from("messages")
          .select("content")
          .eq("conversation_id", conv.id)
          .eq("role", "user")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      return {
        ...conv,
        message_count: count ?? 0,
        last_user_message: lastMsg?.[0]?.content ?? "",
      };
    }),
  );

  return NextResponse.json(enriched);
}
