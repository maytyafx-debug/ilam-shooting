import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCoreRole } from "@/lib/core-sports/auth";
import { CoreSportsService } from "@/lib/core-sports/services";
import type { CreateResultInput } from "@/lib/core-sports/types";

export const runtime = "nodejs";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await new CoreSportsService(db, auth.tenantId).listResults();
  if (error) {
    console.error("[Sports OS] list results failed:", error);
    return NextResponse.json({ error: "Unable to list results." }, { status: 400 });
  }
  return NextResponse.json({ results: data ?? [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin", "referee"], tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: CreateResultInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid result data" }, { status: 400 });
  }

  const score = body.score == null ? null : Number(body.score);
  const rank = body.rank == null ? null : Number(body.rank);
  if (
    typeof body.event_id !== "string" || !UUID_RE.test(body.event_id) ||
    typeof body.member_id !== "string" || !UUID_RE.test(body.member_id) ||
    (score !== null && (!Number.isFinite(score) || score < 0)) ||
    (rank !== null && (!Number.isInteger(rank) || rank < 1)) ||
    (body.notes != null && (typeof body.notes !== "string" || body.notes.length > 2000))
  ) {
    return NextResponse.json({ error: "Invalid result data" }, { status: 400 });
  }

  const { error } = await new CoreSportsService(db, auth.tenantId).createResult({
    ...body,
    score,
    rank,
  });
  if (error) {
    console.error("[Sports OS] create result failed:", error);
    const duplicate = error.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "A result already exists for this member and event." : "Unable to record result." },
      { status: duplicate ? 409 : 400 },
    );
  }
  return NextResponse.json({ success: true }, { status: 201 });
}
