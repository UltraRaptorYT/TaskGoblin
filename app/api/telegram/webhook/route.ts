import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const update = (await request.json().catch(() => null)) as unknown;
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({
      ok: true,
      persisted: false,
      message:
        "Telegram webhook received in demo mode. Configure Supabase to store bot updates.",
    });
  }

  const { error } = await supabase.from("notification_deliveries").insert({
    channel: "telegram",
    status: "received",
    provider_payload: update,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, persisted: true });
}
