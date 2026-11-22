import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCoreRole } from "@/lib/core-sports/auth";
import { ADMIN_RECORD_TYPES, validateAdminPayload } from "@/lib/core-sports/admin-records";

export const runtime = "nodejs";

const schemaUnavailable = (error: { code?: string }) =>
  error.code === "42P01" || error.code === "PGRST205";

export async function GET(request: NextRequest) {
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], request.headers.get("x-tenant-id"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const type = request.nextUrl.searchParams.get("type");
  if (!type || !ADMIN_RECORD_TYPES.includes(type)) {
    return NextResponse.json({ error: "A valid module type is required." }, { status: 400 });
  }
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;

  const { data, error } = await db
    .from("sports_admin_records")
    .select("id,tenant_id,record_type,title,payload,status,created_at,updated_at")
    .eq("tenant_id", auth.tenantId)
    .eq("record_type", type)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (schemaUnavailable(error)) {
      return NextResponse.json({ error: "ADMIN_SCHEMA_NOT_APPLIED" }, { status: 503 });
    }
    console.error("[Sports OS] admin records list failed:", error);
    return NextResponse.json({ error: "Unable to load administrative records." }, { status: 400 });
  }

  return NextResponse.json({ records: data ?? [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > 32768) {
    return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  }

  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], request.headers.get("x-tenant-id"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid record." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  if (typeof input.record_type !== "string" || !ADMIN_RECORD_TYPES.includes(input.record_type)) {
    return NextResponse.json({ error: "Invalid module type." }, { status: 400 });
  }
  if (typeof input.title !== "string" || input.title.trim().length < 2 || input.title.trim().length > 180) {
    return NextResponse.json({ error: "Title must contain 2 to 180 characters." }, { status: 400 });
  }
  const validated = validateAdminPayload(input.record_type, input.payload);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  const { data, error } = await db
    .from("sports_admin_records")
    .insert({
      tenant_id: auth.tenantId,
      record_type: input.record_type,
      title: input.title.trim(),
      payload: validated.payload,
      status: "active",
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select("id,tenant_id,record_type,title,payload,status,created_at,updated_at")
    .single();

  if (error) {
    if (schemaUnavailable(error)) {
      return NextResponse.json({ error: "ADMIN_SCHEMA_NOT_APPLIED" }, { status: 503 });
    }
    console.error("[Sports OS] admin record create failed:", error);
    return NextResponse.json({ error: "Unable to save administrative record." }, { status: 400 });
  }

  return NextResponse.json({ record: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
