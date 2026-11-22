import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCoreRole } from "@/lib/core-sports/auth";

export const runtime = "nodejs";

type SpecialistKind = "athlete" | "coach" | "referee";

function validKind(value: unknown): value is SpecialistKind {
  return value === "athlete" || value === "coach" || value === "referee";
}

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [athletes, coaches, referees] = await Promise.all([
    db.from("sports_athlete_profiles")
      .select("id,member_id,athlete_code,gender,county,membership_status,created_at,member:sports_members!inner(full_name,sport_type)")
      .eq("tenant_id", auth.tenantId).order("created_at", { ascending: false }),
    db.from("sports_coach_profiles")
      .select("id,member_id,coach_code,specialty,coaching_grade,certificate_valid_until,professional_status,created_at,member:sports_members!inner(full_name,sport_type)")
      .eq("tenant_id", auth.tenantId).order("created_at", { ascending: false }),
    db.from("sports_referee_profiles")
      .select("id,member_id,referee_code,referee_grade,permitted_sports,card_valid_until,activity_status,created_at,member:sports_members!inner(full_name,sport_type)")
      .eq("tenant_id", auth.tenantId).order("created_at", { ascending: false }),
  ]);

  const failed = [athletes, coaches, referees].find((item) => item.error);
  if (failed?.error) {
    console.error("[Sports OS] specialist bank load failed:", failed.error);
    return NextResponse.json({ error: "Unable to load specialist records." }, { status: 400 });
  }

  return NextResponse.json({
    athletes: athletes.data ?? [],
    coaches: coaches.data ?? [],
    referees: referees.data ?? [],
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body) || !validKind(body.kind)) {
    return NextResponse.json({ error: "Invalid specialist type." }, { status: 400 });
  }
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const sportType = typeof body.sport_type === "string" ? body.sport_type.trim() : "";
  const profile = body.profile && typeof body.profile === "object" && !Array.isArray(body.profile)
    ? body.profile as Record<string, unknown>
    : {};

  if (fullName.length < 2 || fullName.length > 150 || sportType.length > 120) {
    return NextResponse.json({ error: "اطلاعات پایه معتبر نیست." }, { status: 400 });
  }

  const clean = (key: string, max: number) => {
    const value = profile[key];
    if (value == null || value === "") return null;
    if (typeof value !== "string" || value.trim().length > max) throw new Error("اطلاعات تخصصی معتبر نیست.");
    return value.trim();
  };

  let profileData: Record<string, unknown>;
  try {
    if (body.kind === "athlete") {
      const gender = clean("gender", 20);
      if (gender && !["female", "male", "unspecified"].includes(gender)) {
        return NextResponse.json({ error: "جنسیت انتخاب‌شده معتبر نیست." }, { status: 400 });
      }
      profileData = {
        code: clean("code", 50),
        gender,
        county: clean("county", 100),
        status: clean("status", 20) ?? "active",
      };
    } else if (body.kind === "coach") {
      profileData = {
        code: clean("code", 50),
        specialty: clean("specialty", 150),
        grade: clean("grade", 100),
        valid_until: clean("valid_until", 10),
        status: clean("status", 20) ?? "active",
      };
    } else {
      const sports = profile.permitted_sports;
      const permittedSports = Array.isArray(sports)
        ? sports.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 20)
        : [];
      profileData = {
        code: clean("code", 50),
        grade: clean("grade", 100),
        permitted_sports: permittedSports,
        valid_until: clean("valid_until", 10),
        status: clean("status", 20) ?? "active",
      };
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid profile." }, { status: 400 });
  }

  const { data, error } = await db.rpc("create_sports_specialist", {
    p_tenant_id: auth.tenantId,
    p_kind: body.kind,
    p_full_name: fullName,
    p_phone: null,
    p_sport_type: sportType || null,
    p_profile: profileData,
  });

  if (error) {
    console.error("[Sports OS] specialist create failed:", error);
    return NextResponse.json({ error: "ثبت اطلاعات انجام نشد؛ کد یا اطلاعات را بررسی کنید." }, { status: 400 });
  }
  return NextResponse.json({ id: data }, { status: 201 });
}
