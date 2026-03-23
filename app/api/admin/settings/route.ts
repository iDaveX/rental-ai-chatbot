import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("settings")
    .select("agent_name, tone_preset")
    .single();

  if (error) return NextResponse.json({ agent_name: "Марина", tone_preset: "friendly" });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  const body = await req.json();

  const payload: { agent_name?: string; tone_preset?: string } = {};
  if (typeof body.agent_name === "string") payload.agent_name = body.agent_name;
  if (typeof body.tone_preset === "string") payload.tone_preset = body.tone_preset;

  const { error } = await supabase
    .from("settings")
    .update(payload)
    .eq("id", 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
