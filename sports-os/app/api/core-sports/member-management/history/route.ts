import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCoreRole } from "@/lib/core-sports/auth";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], request.headers.get("x-tenant-id"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const memberId = request.nextUrl.searchParams.get("memberId");
  if (!memberId || !UUID_RE.test(memberId)) {
    return NextResponse.json({ error: "شناسه پرونده معتبر نیست." }, { status: 400 });
  }

  const { data: member, error: memberError } = await db
    .from("sports_members")
    .select("id")
    .eq("id", memberId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();
  if (memberError || !member) return NextResponse.json({ error: "پرونده عضو پیدا نشد." }, { status: 404 });

  const { data, error } = await db
    .from("sports_member_history")
    .select("id,member_id,actor_id,action,changed_fields,created_at")
    .eq("tenant_id", auth.tenantId)
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[Sports OS] member history read failed:", error);
    return NextResponse.json({ error: "دریافت سوابق پرونده ناموفق بود." }, { status: 400 });
  }
  return NextResponse.json({ history: data ?? [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
