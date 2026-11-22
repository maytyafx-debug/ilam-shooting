import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCoreRole } from "@/lib/core-sports/auth";

export const runtime = "nodejs";

type SpecialistKind = "athlete" | "coach" | "referee";
const statuses = ["pending", "active", "inactive", "suspended", "expired"] as const;

function cleanText(value: unknown, max: number): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) {
    throw new Error("اطلاعات واردشده معتبر نیست.");
  }
  return value.trim();
}

function cleanDate(value: unknown): string | null {
  const date = cleanText(value, 10);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("قالب تاریخ معتبر نیست.");
  }
  return date;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const tenantId = request.headers.get("x-tenant-id");
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["owner", "admin"], tenantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "شناسه پرونده معتبر نیست." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const kind = body?.kind;
  const profile = body?.profile;
  if (
    (kind !== "athlete" && kind !== "coach" && kind !== "referee") ||
    !profile || typeof profile !== "object" || Array.isArray(profile)
  ) {
    return NextResponse.json({ error: "نوع یا اطلاعات پرونده معتبر نیست." }, { status: 400 });
  }

  const values = profile as Record<string, unknown>;
  let patch: Record<string, unknown>;
  let table: "sports_athlete_profiles" | "sports_coach_profiles" | "sports_referee_profiles";

  try {
    const status = cleanText(values.status, 20) ?? "active";
    if (!statuses.includes(status as (typeof statuses)[number])) {
      return NextResponse.json({ error: "وضعیت پرونده معتبر نیست." }, { status: 400 });
    }

    if (kind === "athlete") {
      const gender = cleanText(values.gender, 20);
      if (gender && !["female", "male", "unspecified"].includes(gender)) {
        return NextResponse.json({ error: "جنسیت معتبر نیست." }, { status: 400 });
      }
      table = "sports_athlete_profiles";
      patch = {
        athlete_code: cleanText(values.code, 50),
        gender,
        county: cleanText(values.county, 100),
        membership_status: status,
      };
    } else if (kind === "coach") {
      table = "sports_coach_profiles";
      patch = {
        coach_code: cleanText(values.code, 50),
        specialty: cleanText(values.specialty, 150),
        coaching_grade: cleanText(values.grade, 100),
        certificate_valid_until: cleanDate(values.valid_until),
        professional_status: status,
      };
    } else {
      const sports = values.permitted_sports;
      if (sports != null && !Array.isArray(sports)) {
        return NextResponse.json({ error: "فهرست رشته‌های مجاز معتبر نیست." }, { status: 400 });
      }
      const permittedSports = Array.isArray(sports)
        ? sports.filter((item): item is string => typeof item === "string")
            .map((item) => item.trim()).filter(Boolean).slice(0, 20)
        : [];
      if (permittedSports.some((item) => item.length > 100)) {
        return NextResponse.json({ error: "نام رشته بیش از حد طولانی است." }, { status: 400 });
      }
      table = "sports_referee_profiles";
      patch = {
        referee_code: cleanText(values.code, 50),
        referee_grade: cleanText(values.grade, 100),
        permitted_sports: permittedSports,
        card_valid_until: cleanDate(values.valid_until),
        activity_status: status,
      };
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "اطلاعات پرونده معتبر نیست." },
      { status: 400 },
    );
  }

  const { data: existing, error: lookupError } = await db
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (lookupError) {
    console.error("[Sports OS] specialist lookup failed:", lookupError);
    return NextResponse.json({ error: "دریافت پرونده ناموفق بود." }, { status: 400 });
  }
  if (!existing) {
    return NextResponse.json({ error: "پرونده‌ای با این شناسه پیدا نشد." }, { status: 404 });
  }

  const { error: updateError } = await db
    .from(table)
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (updateError) {
    console.error("[Sports OS] specialist update failed:", updateError);
    return NextResponse.json({ error: "ذخیره تغییرات انجام نشد." }, { status: 400 });
  }

  return NextResponse.json({ id, updated: true }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
