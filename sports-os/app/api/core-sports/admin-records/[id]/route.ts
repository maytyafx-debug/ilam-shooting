import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCoreRole } from "@/lib/core-sports/auth";
import { ADMIN_RECORD_TYPES, validateAdminPayload } from "@/lib/core-sports/admin-records";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest, context: Context) {
  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid record ID." }, { status: 400 });

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > 32768) return NextResponse.json({ error: "Request is too large." }, { status: 413 });

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
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  if (input.title !== undefined) {
    if (typeof input.title !== "string" || input.title.trim().length < 2 || input.title.trim().length > 180) {
      return NextResponse.json({ error: "Invalid title." }, { status: 400 });
    }
    update.title = input.title.trim();
  }
  if (input.status !== undefined) {
    if (!["draft", "pending", "active", "approved", "rejected", "expired", "archived", "paid", "void"].includes(String(input.status))) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    update.status = input.status;
  }
  if (input.payload !== undefined) {
    const { data: existing, error: readError } = await db
      .from("sports_admin_records")
      .select("record_type")
      .eq("id", id)
      .eq("tenant_id", auth.tenantId)
      .maybeSingle();
    if (readError || !existing || !ADMIN_RECORD_TYPES.includes(existing.record_type)) {
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }
    const validated = validateAdminPayload(existing.record_type, input.payload);
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
    update.payload = validated.payload;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No supported fields to update." }, { status: 400 });
  }
  update.updated_by = auth.user.id;

  const { data, error } = await db
    .from("sports_admin_records")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .select("id,tenant_id,record_type,title,payload,status,created_at,updated_at")
    .maybeSingle();

  if (error) {
    console.error("[Sports OS] admin record update failed:", error);
    return NextResponse.json({ error: "Unable to update administrative record." }, { status: 400 });
  }
  if (!data) return NextResponse.json({ error: "Record not found." }, { status: 404 });
  return NextResponse.json({ record: data }, { headers: { "Cache-Control": "private, no-store" } });
}
