import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRow = Record<string, unknown>;

function fail(message: string, status = 500) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET() {
  const db = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return fail("برای مشاهده پنل شخصی ابتدا وارد شوید.", 401);

  // Identity is resolved exclusively from the authenticated session. No user,
  // member, tenant, or personal-code identifier is accepted from the browser.
  const [memberResult, staffResult, membershipResult] = await Promise.all([
    db.from("sports_members")
      .select("id,tenant_id,full_name,sport_type,status,created_at")
      .eq("user_id", user.id),
    db.from("sports_staff_profiles")
      .select("id,tenant_id,user_id,staff_type,personal_code,display_name,credential_title,credential_number,credential_level,credential_expires_on,status")
      .eq("user_id", user.id),
    db.from("sports_tenant_memberships")
      .select("tenant_id,role,status")
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  const missingMigration = [memberResult.error, staffResult.error].some((error) =>
    error?.code === "42P01" || error?.code === "PGRST205"
  );
  if (missingMigration) {
    return fail("راه‌اندازی پایگاه داده پنل شخصی هنوز تکمیل نشده است. مهاجرت‌های تأییدشده باید ابتدا اجرا شوند.", 503);
  }
  if (memberResult.error || staffResult.error || membershipResult.error) {
    console.error("[Personal Portal] identity lookup failed:", {
      member: memberResult.error?.code,
      staff: staffResult.error?.code,
      membership: membershipResult.error?.code,
    });
    return fail("بازیابی هویت شخصی انجام نشد.");
  }

  const members = memberResult.data ?? [];
  const memberIds = members.map((item) => item.id);
  const tenantIds = [...new Set([
    ...members.map((item) => item.tenant_id),
    ...(staffResult.data ?? []).map((item) => item.tenant_id),
  ])];

  const [profilesResult, resultsResult, clubResult, insuranceResult, entriesResult, plansResult, assignmentsResult] = await Promise.all([
    memberIds.length
      ? db.from("sports_athlete_profiles")
          .select("member_id,tenant_id,membership_number,athlete_category,gender,athlete_code,personal_code,development_category")
          .in("member_id", memberIds)
      : Promise.resolve({ data: [], error: null }),
    memberIds.length
      ? db.from("sports_results")
          .select("id,tenant_id,event_id,member_id,score,rank,verification_status,created_at")
          .in("member_id", memberIds)
          .eq("verification_status", "verified")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    memberIds.length
      ? db.from("sports_club_memberships")
          .select("member_id,tenant_id,membership_type,status,start_date,end_date,fee_amount,currency,billing_period")
          .in("member_id", memberIds)
      : Promise.resolve({ data: [], error: null }),
    memberIds.length
      ? db.from("sports_insurance_records")
          .select("member_id,tenant_id,provider_name,coverage_start,coverage_end,status")
          .in("member_id", memberIds)
      : Promise.resolve({ data: [], error: null }),
    memberIds.length
      ? db.from("sports_event_entries")
          .select("member_id,tenant_id,event_id,status,registered_at")
          .in("member_id", memberIds)
      : Promise.resolve({ data: [], error: null }),
    db.from("sports_development_plans")
      .select("id,tenant_id,title,stage,status,review_date,updated_at")
      .eq("coach_user_id", user.id)
      .order("updated_at", { ascending: false }),
    db.from("sports_official_assignments")
      .select("id,tenant_id,event_id,assignment_role,status,assigned_at")
      .eq("referee_user_id", user.id)
      .order("assigned_at", { ascending: false }),
  ]);

  const errors = [profilesResult, resultsResult, clubResult, insuranceResult, entriesResult, plansResult, assignmentsResult]
    .filter((item) => item.error);
  if (errors.length) {
    const missing = errors.some((item) => item.error?.code === "42P01" || item.error?.code === "PGRST205");
    if (missing) return fail("ساختار اطلاعات شخصی هنوز به‌طور کامل در پایگاه داده فعال نشده است.", 503);
    console.error("[Personal Portal] personal data lookup failed:", errors.map((item) => item.error?.code));
    return fail("دریافت اطلاعات پنل شخصی ناموفق بود.");
  }

  const eventIds = [...new Set([
    ...(resultsResult.data ?? []).map((item) => item.event_id),
    ...(entriesResult.data ?? []).map((item) => item.event_id),
    ...(assignmentsResult.data ?? []).map((item) => item.event_id),
  ])];
  const eventResult = eventIds.length
    ? await db.from("sports_events")
        .select("id,tenant_id,title,sport_type,event_date,location,status")
        .in("id", eventIds)
    : { data: [], error: null };

  if (eventResult.error) {
    console.error("[Personal Portal] event lookup failed:", eventResult.error.code);
    return fail("دریافت برنامه رویدادها ناموفق بود.");
  }

  const eventById = new Map((eventResult.data ?? []).map((event) => [event.id, event]));
  const profileByMember = new Map((profilesResult.data ?? []).map((profile) => [profile.member_id, profile]));

  const athleteProfiles = members.map((member) => ({
    type: "athlete",
    tenant_id: member.tenant_id,
    member: {
      id: member.id,
      full_name: member.full_name,
      sport_type: member.sport_type,
      status: member.status,
      created_at: member.created_at,
    },
    identity: profileByMember.get(member.id) ?? null,
    results: (resultsResult.data ?? [])
      .filter((result) => result.member_id === member.id)
      .map((result) => ({
        id: result.id,
        score: result.score,
        rank: result.rank,
        created_at: result.created_at,
        event: eventById.get(result.event_id) ?? null,
      })),
    memberships: (clubResult.data ?? []).filter((item) => item.member_id === member.id),
    insurance: (insuranceResult.data ?? []).filter((item) => item.member_id === member.id),
    registrations: (entriesResult.data ?? [])
      .filter((item) => item.member_id === member.id)
      .map((item) => ({
        status: item.status,
        registered_at: item.registered_at,
        event: eventById.get(item.event_id) ?? null,
      })),
  }));

  const staffProfiles = (staffResult.data ?? []).map((staff) => ({
    type: staff.staff_type,
    tenant_id: staff.tenant_id,
    identity: {
      personal_code: staff.personal_code,
      display_name: staff.display_name ?? user.email ?? "کاربر",
      credential_title: staff.credential_title,
      credential_number: staff.credential_number,
      credential_level: staff.credential_level,
      credential_expires_on: staff.credential_expires_on,
      status: staff.status,
    },
    assignments: staff.staff_type === "referee"
      ? (assignmentsResult.data ?? [])
          .filter((item) => item.tenant_id === staff.tenant_id)
          .map((item) => ({
            id: item.id,
            role: item.assignment_role,
            status: item.status,
            assigned_at: item.assigned_at,
            event: eventById.get(item.event_id) ?? null,
          }))
      : [],
    development_plans: staff.staff_type === "coach"
      ? (plansResult.data ?? [])
          .filter((item) => item.tenant_id === staff.tenant_id)
          .map((item) => ({
            id: item.id,
            title: item.title,
            stage: item.stage,
            status: item.status,
            review_date: item.review_date,
            updated_at: item.updated_at,
          }))
      : [],
  }));

  const roles = (membershipResult.data ?? []).map((item) => ({
    tenant_id: item.tenant_id,
    role: item.role,
  }));

  return NextResponse.json({
    account: { email: user.email ?? null },
    profiles: [...athleteProfiles, ...staffProfiles],
    roles,
    needs_linking: athleteProfiles.length === 0 && staffProfiles.length === 0,
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
