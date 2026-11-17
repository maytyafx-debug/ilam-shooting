import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoreRole } from "./types";

const CORE_ROLES: readonly CoreRole[] = ["admin", "referee", "member"];
const TENANT_ROLE_TO_CORE: Record<string, CoreRole> = {
  tenant_admin: "admin",
  referee: "referee",
  athlete: "member",
};

export async function requireCoreRole(
  db: SupabaseClient<any, any, any, any, any>,
  allowed: readonly CoreRole[],
  tenantId: string | null,
) {
  if (!tenantId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
    return { ok: false as const, status: 400, error: "A valid x-tenant-id header is required." };
  }

  const { data: { user }, error: userError } = await db.auth.getUser();
  if (userError || !user) {
    return { ok: false as const, status: 401, error: "Unauthenticated" };
  }

  const { data: profile, error: profileError } = await db
    .from("sports_profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false as const, status: 403, error: "Profile not provisioned" };
  }

  const { data: membership, error: membershipError } = await db
    .from("sports_tenant_memberships")
    .select("role,status")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    return { ok: false as const, status: 403, error: "No active membership in this organization." };
  }

  const role = TENANT_ROLE_TO_CORE[membership.role];
  if (!role || !CORE_ROLES.includes(role) || !allowed.includes(role)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return {
    ok: true as const,
    user,
    tenantId,
    profile: { id: profile.id, role, full_name: profile.full_name },
  };
}
