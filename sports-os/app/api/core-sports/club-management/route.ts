import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCoreRole } from "@/lib/core-sports/auth";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
type Body = Record<string, unknown>;

function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length >= min && normalized.length <= max ? normalized : null;
}
function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) return undefined;
  return value.trim() || null;
}
function validDate(value: unknown, optional = false): string | null | undefined {
  if (value === undefined || value === "") return optional ? null : undefined;
  if (typeof value !== "string" || !DATE_RE.test(value)) return undefined;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : value;
}
function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], request.headers.get("x-tenant-id"));
  if (!auth.ok) return fail(auth.error, auth.status);

  const tenantId = auth.tenantId;
  const [memberships, insurance, entries, plans, finances, consents, profiles] = await Promise.all([
    db.from("sports_club_memberships").select("id,member_id,membership_type,status,start_date,end_date,fee_amount,currency,billing_period,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(200),
    db.from("sports_insurance_records").select("id,member_id,provider_name,coverage_start,coverage_end,status,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(200),
    db.from("sports_event_entries").select("id,event_id,member_id,status,registered_at,reviewed_at").eq("tenant_id", tenantId).order("registered_at", { ascending: false }).limit(200),
    db.from("sports_development_plans").select("id,member_id,title,stage,goals,status,review_date,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(200),
    db.from("sports_financial_transactions").select("id,member_id,transaction_type,category,amount,currency,transaction_date,description,reverses_transaction_id,created_at").eq("tenant_id", tenantId).order("transaction_date", { ascending: false }).limit(200),
    db.from("sports_guardian_consents").select("id,member_id,guardian_name,relationship,guardian_contact,consent_scope,consent_version,consented_at,expires_at,revoked_at").eq("tenant_id", tenantId).order("consented_at", { ascending: false }).limit(200),
    db.from("sports_athlete_profiles").select("id,member_id,birth_date,membership_number,athlete_category,gender,athlete_code,development_category,emergency_contact_name,emergency_contact_phone").eq("tenant_id", tenantId).limit(200),
  ]);
  const results = [memberships, insurance, entries, plans, finances, consents, profiles];
  if (results.some((item) => item.error)) {
    console.error("[Sports OS] club management load failed:", results.filter((item) => item.error).map((item) => item.error));
    return fail("بارگذاری اطلاعات مدیریت باشگاه ناموفق بود.", 400);
  }
  return NextResponse.json({
    memberships: memberships.data ?? [],
    insurance: insurance.data ?? [],
    entries: entries.data ?? [],
    plans: plans.data ?? [],
    finances: finances.data ?? [],
    consents: consents.data ?? [],
    profiles: profiles.data ?? [],
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], request.headers.get("x-tenant-id"));
  if (!auth.ok) return fail(auth.error, auth.status);

  let body: { module?: unknown; data?: unknown };
  try { body = await request.json(); }
  catch { return fail("درخواست JSON معتبر نیست."); }
  if (!body || typeof body !== "object" || typeof body.module !== "string" ||
      !body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
    return fail("ساختار اطلاعات ارسالی معتبر نیست.");
  }
  const data = body.data as Body;
  const tenant_id = auth.tenantId;
  const actor = auth.user.id;
  let table: string;
  let payload: Body;

  switch (body.module) {
    case "membership": {
      if (!isUuid(data.member_id)) return fail("عضو انتخاب‌شده معتبر نیست.");
      const membership_type = text(data.membership_type ?? "standard", 2, 60);
      const start_date = validDate(data.start_date, true);
      const end_date = validDate(data.end_date, true);
      const fee = data.fee_amount === "" || data.fee_amount == null ? null : Number(data.fee_amount);
      const billing = data.billing_period == null || data.billing_period === "" ? null : data.billing_period;
      if (!membership_type || start_date === undefined || end_date === undefined ||
          (fee !== null && (!Number.isFinite(fee) || fee < 0)) ||
          (billing !== null && !["monthly","quarterly","semiannual","annual","one_time"].includes(String(billing))) ||
          (start_date && end_date && end_date < start_date)) return fail("اطلاعات دوره عضویت معتبر نیست.");
      const currency = text(data.currency ?? "IRR", 3, 3);
      if (!currency || !/^[A-Z]{3}$/.test(currency)) return fail("واحد پول معتبر نیست.");
      table = "sports_club_memberships";
      payload = { tenant_id, member_id: data.member_id, membership_type, start_date: start_date ?? undefined,
        end_date, fee_amount: fee, currency, billing_period: billing, notes: optionalText(data.notes, 1000) ?? null, created_by: actor };
      break;
    }
    case "insurance": {
      if (!isUuid(data.member_id)) return fail("عضو انتخاب‌شده معتبر نیست.");
      const provider_name = text(data.provider_name, 2, 160);
      const coverage_start = validDate(data.coverage_start, true);
      const coverage_end = validDate(data.coverage_end);
      if (!provider_name || coverage_start === undefined || !coverage_end ||
          (coverage_start && coverage_end < coverage_start)) return fail("اطلاعات بیمه معتبر نیست.");
      table = "sports_insurance_records";
      payload = { tenant_id, member_id: data.member_id, provider_name, coverage_start: coverage_start ?? null,
        coverage_end, status: "pending", created_by: actor };
      break;
    }
    case "entry": {
      if (!isUuid(data.member_id) || !isUuid(data.event_id)) return fail("عضو یا رویداد انتخاب‌شده معتبر نیست.");
      table = "sports_event_entries";
      payload = { tenant_id, member_id: data.member_id, event_id: data.event_id, status: "registered" };
      break;
    }
    case "plan": {
      if (!isUuid(data.member_id)) return fail("عضو انتخاب‌شده معتبر نیست.");
      const title = text(data.title, 2, 180);
      const stage = data.stage ?? "foundation";
      const goals = Array.isArray(data.goals) ? data.goals : [];
      if (!title || !["discovery","foundation","development","performance","maintenance"].includes(String(stage)) ||
          goals.length > 20 || goals.some((goal) => typeof goal !== "string" || goal.trim().length > 180)) {
        return fail("اطلاعات برنامه رشد معتبر نیست.");
      }
      const review_date = validDate(data.review_date, true);
      if (review_date === undefined) return fail("تاریخ بازبینی معتبر نیست.");
      table = "sports_development_plans";
      payload = { tenant_id, member_id: data.member_id, title, stage, goals: goals.map((goal) => String(goal).trim()).filter(Boolean),
        status: "draft", review_date, created_by: actor };
      break;
    }
    case "finance": {
      const transaction_type = data.transaction_type;
      const category = text(data.category, 2, 100);
      const amount = Number(data.amount);
      const currency = text(data.currency ?? "IRR", 3, 3);
      const transaction_date = validDate(data.transaction_date, true);
      const description = optionalText(data.description, 1000);
      const reverses = data.reverses_transaction_id;
      if (!["income","expense","refund","reversal"].includes(String(transaction_type)) ||
          !category || !Number.isFinite(amount) || amount <= 0 || !currency || !/^[A-Z]{3}$/.test(currency) ||
          transaction_date === undefined || description === undefined ||
          (transaction_type === "reversal" ? !isUuid(reverses) : reverses != null && reverses !== "")) {
        return fail("اطلاعات سند مالی معتبر نیست.");
      }
      if (data.member_id != null && data.member_id !== "" && !isUuid(data.member_id)) return fail("عضو انتخاب‌شده معتبر نیست.");
      table = "sports_financial_transactions";
      payload = { tenant_id, member_id: data.member_id || null, transaction_type, category, amount, currency,
        transaction_date: transaction_date ?? undefined, description: description ?? null,
        reverses_transaction_id: transaction_type === "reversal" ? reverses : null, created_by: actor };
      break;
    }
    case "consent": {
      if (!isUuid(data.member_id)) return fail("عضو انتخاب‌شده معتبر نیست.");
      const guardian_name = text(data.guardian_name, 2, 150);
      const relationship = text(data.relationship, 2, 80);
      const guardian_contact = optionalText(data.guardian_contact, 80);
      const consent_version = text(data.consent_version, 1, 40);
      const consent_scope = data.consent_scope;
      const expires_at = validDate(data.expires_at, true);
      if (!guardian_name || !relationship || guardian_contact === undefined || !consent_version ||
          !["registration","training","competition","media","data_processing"].includes(String(consent_scope)) ||
          expires_at === undefined) return fail("اطلاعات رضایت سرپرست معتبر نیست.");
      table = "sports_guardian_consents";
      payload = { tenant_id, member_id: data.member_id, guardian_name, relationship, guardian_contact: guardian_contact ?? null,
        consent_scope, consent_version, expires_at, recorded_by: actor };
      break;
    }
    case "profile": {
      if (!isUuid(data.member_id)) return fail("عضو انتخاب‌شده معتبر نیست.");
      const birth_date = validDate(data.birth_date, true);
      const membership_number = optionalText(data.membership_number, 40);
      const athlete_category = optionalText(data.athlete_category, 80);
      const athlete_code = optionalText(data.athlete_code, 60);
      const development_category = optionalText(data.development_category, 80);
      const emergency_contact_name = optionalText(data.emergency_contact_name, 150);
      const emergency_contact_phone = optionalText(data.emergency_contact_phone, 30);
      const gender = data.gender == null || data.gender === "" ? null : data.gender;
      if (birth_date === undefined || membership_number === undefined || athlete_category === undefined ||
          athlete_code === undefined || development_category === undefined ||
          emergency_contact_name === undefined || emergency_contact_phone === undefined ||
          (gender !== null && !["female","male","unspecified"].includes(String(gender))) ||
          (birth_date && birth_date > new Date().toISOString().slice(0,10))) return fail("اطلاعات پرونده محرمانه ورزشکار معتبر نیست.");
      table = "sports_athlete_profiles";
      payload = { tenant_id, member_id: data.member_id, birth_date: birth_date ?? null,
        membership_number: membership_number ?? null, athlete_category: athlete_category ?? null,
        athlete_code: athlete_code ?? null, development_category: development_category ?? null,
        emergency_contact_name: emergency_contact_name ?? null, emergency_contact_phone: emergency_contact_phone ?? null,
        gender };
      const { data: saved, error } = await db.from(table).upsert(payload, { onConflict: "member_id,tenant_id" }).select("id,member_id,birth_date,membership_number,athlete_category,gender").single();
      if (error) {
        console.error("[Sports OS] athlete profile save failed:", error);
        return fail("ذخیره پرونده ورزشکار ناموفق بود.", error.code === "23505" ? 409 : 400);
      }
      return NextResponse.json({ record: saved }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
    }
    default:
      return fail("ماژول درخواستی پشتیبانی نمی‌شود.");
  }

  const { data: saved, error } = await db.from(table).insert(payload).select("*").single();
  if (error) {
    console.error("[Sports OS] club module write failed:", { module: body.module, error });
    return fail(error.code === "23505" ? "این رکورد قبلاً ثبت شده است." : "ثبت اطلاعات ناموفق بود.", error.code === "23505" ? 409 : 400);
  }
  return NextResponse.json({ record: saved }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: NextRequest) {
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], request.headers.get("x-tenant-id"));
  if (!auth.ok) return fail(auth.error, auth.status);

  let body: { module?: unknown; id?: unknown; data?: unknown };
  try { body = await request.json(); }
  catch { return fail("درخواست JSON معتبر نیست."); }
  if (!body || typeof body !== "object" || !isUuid(body.id) || !body.data ||
      typeof body.data !== "object" || Array.isArray(body.data)) return fail("اطلاعات ویرایش معتبر نیست.");
  const data = body.data as Body;
  let table: string;
  let patch: Body;

  if (body.module === "membership") {
    table = "sports_club_memberships";
    const status = data.status;
    const end_date = validDate(data.end_date, true);
    if (!["pending","active","expired","suspended","cancelled"].includes(String(status)) || end_date === undefined) {
      return fail("وضعیت دوره عضویت معتبر نیست.");
    }
    patch = { status, end_date };
  } else if (body.module === "entry") {
    table = "sports_event_entries";
    const status = data.status;
    if (!["registered","approved","waitlisted","withdrawn","disqualified"].includes(String(status))) return fail("وضعیت حضور معتبر نیست.");
    patch = { status, reviewed_by: auth.user.id, reviewed_at: new Date().toISOString() };
  } else if (body.module === "plan") {
    table = "sports_development_plans";
    const status = data.status;
    const review_date = validDate(data.review_date, true);
    if (!["draft","active","completed","paused"].includes(String(status)) || review_date === undefined) return fail("وضعیت برنامه رشد معتبر نیست.");
    patch = { status, review_date };
  } else if (body.module === "consent" && data.action === "revoke") {
    table = "sports_guardian_consents";
    patch = { revoked_at: new Date().toISOString() };
  } else {
    return fail("این نوع ویرایش مجاز نیست.");
  }

  const { data: saved, error } = await db.from(table).update(patch).eq("id", body.id)
    .eq("tenant_id", auth.tenantId).select("*").maybeSingle();
  if (error || !saved) {
    console.error("[Sports OS] club module update failed:", error);
    return fail("ویرایش رکورد ناموفق بود.", 400);
  }
  return NextResponse.json({ record: saved }, { headers: { "Cache-Control": "private, no-store" } });
}
