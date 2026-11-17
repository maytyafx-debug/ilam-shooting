import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/";
  const redirectUrl = new URL(next, requestUrl.origin);

  // Also reject backslash-based URL normalization and any cross-origin target.
  if (redirectUrl.origin !== requestUrl.origin) {
    return NextResponse.redirect(new URL("/login?error=auth_callback_failed", requestUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth_callback_failed", requestUrl.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth_callback_failed", requestUrl.origin));
  }

  return NextResponse.redirect(redirectUrl);
}
