import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED_ADMIN_USER_ID =
  "6907e21e-eacd-4b85-95e6-7d93eb40ddac";

export async function GET() {
  const db = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await db.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { authenticated: false },
      {
        status: 401,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  // Keep this temporary diagnostic private to the expected administrator.
  if (user.id !== EXPECTED_ADMIN_USER_ID) {
    return NextResponse.json(
      { error: "Not found" },
      {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const { data: memberships, error: membershipError } = await db
    .from("sports_tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError) {
    return NextResponse.json(
      {
        authenticated: true,
        expectedAdminAccount: true,
        membershipQuery: "error",
        membershipErrorCode: membershipError.code ?? "unknown",
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const tenantIds = [...new Set((memberships ?? []).map((item) => item.tenant_id))];
  let activeTenantCount = 0;
  let tenantQuery: "ok" | "error" = "ok";
  let tenantErrorCode: string | null = null;

  if (tenantIds.length > 0) {
    const { data: tenants, error } = await db
      .from("sports_tenants")
      .select("id")
      .in("id", tenantIds)
      .eq("status", "active");

    if (error) {
      tenantQuery = "error";
      tenantErrorCode = error.code ?? "unknown";
    } else {
      activeTenantCount = tenants?.length ?? 0;
    }
  }

  return NextResponse.json(
    {
      authenticated: true,
      expectedAdminAccount: true,
      membershipQuery: "ok",
      activeMembershipCount: memberships?.length ?? 0,
      tenantQuery,
      activeTenantCount,
      ...(tenantErrorCode ? { tenantErrorCode } : {}),
    },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
