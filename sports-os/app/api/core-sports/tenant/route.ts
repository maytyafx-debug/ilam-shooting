import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listUserActiveTenants } from "@/lib/core-sports/auth";

export const runtime = "nodejs";

export async function GET() {
  const db = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await db.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const result = await listUserActiveTenants(db, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.tenants.length === 0) {
    return NextResponse.json(
      { error: "No active organization membership was found." },
      { status: 403 },
    );
  }

  if (result.tenants.length > 1) {
    return NextResponse.json(
      {
        error: "More than one active organization is available; an organization must be selected.",
        tenants: result.tenants,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ tenant: result.tenants[0] });
}
