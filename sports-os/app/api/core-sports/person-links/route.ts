import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCoreRole } from "@/lib/core-sports/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { email?: unknown; person_type?: unknown; member_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "درخواست معتبر نیست." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const personType = body.person_type;
  const memberId = body.member_id;

  if (
    email.length < 5 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !["athlete", "coach", "referee"].includes(String(personType)) ||
    (personType === "athlete" && (typeof memberId !== "string" || !/^[0-9a-f-]{36}$/i.test(memberId))) ||
    (personType !== "athlete" && memberId != null)
  ) {
    return NextResponse.json({ error: "اطلاعات اتصال حساب معتبر نیست." }, { status: 400 });
  }

  const { data, error } = await db.rpc("sports_admin_link_person", {
    p_tenant_id: auth.tenantId,
    p_email: email,
    p_person_type: personType,
    p_member_id: personType === "athlete" ? memberId : null,
  });

  if (error || !data?.length) {
    console.error("[Sports OS] personal account link failed:", error?.code);
    const message = error?.message?.includes("No confirmed account")
      ? "حساب تأییدشده‌ای با این ایمیل پیدا نشد."
      : error?.message?.includes("already linked")
        ? "این پرونده قبلاً به حساب دیگری متصل شده است."
        : "اتصال حساب انجام نشد؛ نقش و عضویت سازمان را بررسی کنید.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({
    linked: true,
    personal_code: data[0].personal_code,
    display_name: data[0].display_name,
    person_type: personType,
  }, {
    status: 201,
    headers: { "Cache-Control": "private, no-store" },
  });
}
