import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCoreRole } from "@/lib/core-sports/auth";
import { CoreSportsService } from "@/lib/core-sports/services";
import type { CreateMemberInput } from "@/lib/core-sports/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin", "referee"], tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await new CoreSportsService(db, auth.tenantId).listMembers();
  if (error) {
    console.error("[Sports OS] list members failed:", error);
    return NextResponse.json({ error: "Unable to list members." }, { status: 400 });
  }
  return NextResponse.json({ members: data });
}

export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: CreateMemberInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.full_name !== "string" || !body.full_name.trim() || body.full_name.length > 150) {
    return NextResponse.json({ error: "Invalid full_name" }, { status: 400 });
  }

  const { data, error } = await new CoreSportsService(db, auth.tenantId).createMember(body);
  if (error) {
    console.error("[Sports OS] create member failed:", error);
    return NextResponse.json({ error: "Unable to create member." }, { status: 400 });
  }
  return NextResponse.json({ member: data }, { status: 201 });
}
