import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCoreRole } from "@/lib/core-sports/auth";
import { CoreSportsService } from "@/lib/core-sports/services";
import type { CreateResultInput } from "@/lib/core-sports/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id");
  const db = await createSupabaseServerClient(tenantId);
  const auth = await requireCoreRole(db, ["admin", "referee"], tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: CreateResultInput;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const score = body.score == null ? null : Number(body.score);
  const rank = body.rank == null ? null : Number(body.rank);
  if (
    typeof body.event_id !== "string" || typeof body.member_id !== "string" ||
    (score !== null && !Number.isFinite(score)) ||
    (rank !== null && (!Number.isInteger(rank) || rank < 1)) ||
    (body.notes != null && (typeof body.notes !== "string" || body.notes.length > 2000))
  ) return NextResponse.json({ error: "Invalid result data" }, { status: 400 });

  const { error } = await new CoreSportsService(db).createResult({ ...body, score, rank }, auth.user.id);
  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "A result already exists for this member and event." : "Unable to record result." },
      { status: duplicate ? 409 : 400 },
    );
  }
  return NextResponse.json({ success: true }, { status: 201 });
}
