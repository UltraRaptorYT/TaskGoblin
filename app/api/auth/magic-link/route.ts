import { NextResponse } from "next/server";

import { getSupabasePublic } from "@/lib/supabase-public";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
  } | null;
  const email = body?.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json(
      { error: "Email is required for magic-link sign in." },
      { status: 400 }
    );
  }

  const supabase = getSupabasePublic();

  if (!supabase) {
    return NextResponse.json({
      sent: false,
      demoMode: true,
      message:
        "Supabase Auth is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to send magic links.",
    });
  }

  const origin = new URL(request.url).origin;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: origin,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    sent: true,
    demoMode: false,
    message: "Magic link sent. Check your email to continue.",
  });
}
