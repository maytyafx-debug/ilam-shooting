import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCoreRole } from "@/lib/core-sports/auth";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEMBER_SELECT = "id,tenant_id,full_name,phone,sport_type,status,membership_number,birth_date,athlete_category,joined_on,created_at,updated_at";
const ALLOWED_STATUSES = ["active", "inactive", "suspended"] as const;

type MemberInput = {
  full_name?: unknown;
  phone?: unknown;
  sport_type?: unknown;
  membership_number?: unknown;
  birth_date?: unknown;
  athlete_category?: unknown;
  status?: unknown;
};

function cleanOptionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (normalized.length > maxLength) return undefined;
  return normalized || null;
}

function validateMemberInput(body: MemberInput, partial: boolean) {
  const patch: Record<string, unknown> = {};

  if (!partial || Object.prototype.hasOwnProperty.call(body, "full_name")) {
    if (typeof body.full_name !== "string" || body.full_name.trim().length < 2 || body.full_name.trim().length > 150) {
      return { error: "نام و نام خانوادگی باید بین ۲ تا ۱۵۰ نویسه باشد." };
    }
    patch.full_name = body.full_name.trim();
  }

  for (const [key, max] of [
    ["phone", 30],
    ["sport_type", 120],
    ["membership_number", 40],
    ["athlete_category", 80],
  ] as const) {
    if (!partial || Object.prototype.hasOwnProperty.call(body, key)) {
      const value = cleanOptionalText(body[key], max);
      if (value === undefined) return { error: "یکی از فیلدهای متنی معتبر نیست." };
      patch[key] = value;
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "birth_date")) {
    const value = body.birth_date;
    if (value === null || value === "") {
      patch.birth_date = null;
    } else if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value + "T00:00:00.000Z")) ||
      value > new Date().toISOString().slice(0, 10)
    ) {
      return { error: "تاریخ تولد معتبر نیست." };
    } else {
      patch.birth_date = value;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    if (typeof body.status !== "string" || !ALLOWED_STATUSES.includes(body.status as typeof ALLOWED_STATUSES[number])) {
      return { error: "وضعیت پرونده معتبر نیست." };
    }
    patch.status = body.status;
  } else if (!partial) {
    patch.status = "active";
  }

  return { patch };
}

async function writeHistory(
  db: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  memberId: string,
  actorId: string,
  action: "created" | "updated" | "archived",
  changedFields: Record<string, unknown>,
) {
  const { error } = await db.from("sports_member_history").insert({
    tenant_id: tenantId,
    member_id: memberId,
    actor_id: actorId,
    action,
    changed_fields: changedFields,
  });
  if (error) console.error("[Sports OS] member history write failed:", error);
  return !error;
}

export async function GET(request: NextRequest) {
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], request.headers.get("x-tenant-id"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await db
    .from("sports_members")
    .select(MEMBER_SELECT)
    .eq("tenant_id", auth.tenantId)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("[Sports OS] member management list failed:", error);
    return NextResponse.json({ error: "دریافت فهرست اعضا ناموفق بود." }, { status: 400 });
  }
  return NextResponse.json({ members: data ?? [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], request.headers.get("x-tenant-id"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: MemberInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "درخواست JSON معتبر نیست." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "اطلاعات پرونده معتبر نیست." }, { status: 400 });
  }

  const validated = validateMemberInput(body, false);
  if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: 400 });

  const { data, error } = await db
    .from("sports_members")
    .insert({ ...validated.patch, tenant_id: auth.tenantId })
    .select(MEMBER_SELECT)
    .single();

  if (error || !data) {
    console.error("[Sports OS] member create failed:", error);
    const duplicate = error?.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "شماره عضویت در این سازمان قبلاً استفاده شده است." : "ثبت پرونده عضو ناموفق بود." },
      { status: duplicate ? 409 : 400 },
    );
  }

  const historyRecorded = await writeHistory(
    db, auth.tenantId, data.id, auth.user.id, "created",
    Object.fromEntries(Object.entries(validated.patch).map(([key, value]) => [key, { after: value }])),
  );
  return NextResponse.json({ member: data, historyRecorded }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], request.headers.get("x-tenant-id"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: MemberInput & { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "درخواست JSON معتبر نیست." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.id !== "string" || !UUID_RE.test(body.id)) {
    return NextResponse.json({ error: "شناسه پرونده معتبر نیست." }, { status: 400 });
  }

  const validated = validateMemberInput(body, true);
  if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: 400 });
  if (Object.keys(validated.patch).length === 0) {
    return NextResponse.json({ error: "هیچ فیلدی برای ویرایش ارسال نشده است." }, { status: 400 });
  }

  const { data: before, error: readError } = await db
    .from("sports_members")
    .select(MEMBER_SELECT)
    .eq("id", body.id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();
  if (readError || !before) return NextResponse.json({ error: "پرونده عضو پیدا نشد." }, { status: 404 });

  const { data, error } = await db
    .from("sports_members")
    .update(validated.patch)
    .eq("id", body.id)
    .eq("tenant_id", auth.tenantId)
    .select(MEMBER_SELECT)
    .maybeSingle();

  if (error || !data) {
    console.error("[Sports OS] member update failed:", error);
    const duplicate = error?.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "شماره عضویت در این سازمان قبلاً استفاده شده است." : "ویرایش پرونده عضو ناموفق بود." },
      { status: duplicate ? 409 : 400 },
    );
  }

  const changedFields = Object.fromEntries(
    Object.entries(validated.patch)
      .filter(([key, value]) => before[key] !== value)
      .map(([key, value]) => [key, { before: before[key], after: value }]),
  );
  const historyRecorded = Object.keys(changedFields).length === 0
    ? true
    : await writeHistory(db, auth.tenantId, data.id, auth.user.id, "updated", changedFields);

  return NextResponse.json({ member: data, historyRecorded }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function DELETE(request: NextRequest) {
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], request.headers.get("x-tenant-id"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const memberId = request.nextUrl.searchParams.get("id");
  if (!memberId || !UUID_RE.test(memberId)) {
    return NextResponse.json({ error: "شناسه پرونده معتبر نیست." }, { status: 400 });
  }

  const { data: before, error: readError } = await db
    .from("sports_members")
    .select(MEMBER_SELECT)
    .eq("id", memberId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();
  if (readError || !before) return NextResponse.json({ error: "پرونده عضو پیدا نشد." }, { status: 404 });
  if (before.status === "inactive") return NextResponse.json({ success: true, alreadyArchived: true });

  const { data, error } = await db
    .from("sports_members")
    .update({ status: "inactive" })
    .eq("id", memberId)
    .eq("tenant_id", auth.tenantId)
    .select(MEMBER_SELECT)
    .maybeSingle();

  if (error || !data) {
    console.error("[Sports OS] member archive failed:", error);
    return NextResponse.json({ error: "غیرفعال‌سازی پرونده ناموفق بود." }, { status: 400 });
  }

  const historyRecorded = await writeHistory(
    db, auth.tenantId, memberId, auth.user.id, "archived",
    { status: { before: before.status, after: "inactive" } },
  );
  return NextResponse.json({ success: true, member: data, historyRecorded });
}
