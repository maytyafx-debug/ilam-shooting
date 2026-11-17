import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCoreRole } from "@/lib/core-sports/auth";
import { CoreSportsService } from "@/lib/core-sports/services";
import type { CreateEventInput } from "@/lib/core-sports/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const db = await createSupabaseServerClient(tenantId);
  const auth = await requireCoreRole(db, ["admin", "referee"], tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await new CoreSportsService(db).listEvents();
  if (error) return NextResponse.json({ error: "Unable to list events" }, { status: 400 });
  return NextResponse.json({ events: data });
}

export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const db = await createSupabaseServerClient(tenantId);
  const auth = await requireCoreRole(db, ["admin"], tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: CreateEventInput;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    typeof body.title !== "string" || !body.title.trim() || body.title.length > 200 ||
    typeof body.sport_type !== "string" || !body.sport_type.trim() ||
    typeof body.event_date !== "string" || !Number.isFinite(Date.parse(body.event_date))
  ) return NextResponse.json({ error: "Invalid event data" }, { status: 400 });

  const { data, error } = await new CoreSportsService(db).createEvent(body, auth.user.id);
  if (error) return NextResponse.json({ error: "Unable to create event" }, { status: 400 });
  return NextResponse.json({ event: data }, { status: 201 });
}
