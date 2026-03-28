import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type ToneValue = "friendly" | "formal" | "warm" | "business";

function parseToneMap(raw: string | null | undefined): Record<string, ToneValue> {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, ToneValue>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  const { slug, tone } = (await req.json()) as { slug?: string; tone?: ToneValue };

  if (!slug || !tone) {
    return NextResponse.json({ error: "slug and tone are required" }, { status: 400 });
  }

  const { data: current, error: selectError } = await supabase
    .from("settings")
    .select("tone_preset")
    .eq("id", 1)
    .single();

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  const toneMap = parseToneMap(current?.tone_preset);
  toneMap[slug] = tone;

  const { error } = await supabase
    .from("settings")
    .update({ tone_preset: JSON.stringify(toneMap) })
    .eq("id", 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
