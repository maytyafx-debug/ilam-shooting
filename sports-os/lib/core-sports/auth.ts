import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { CoreRole } from "./types";

const CORE_ROLES: readonly CoreRole[] = ["admin", "referee", "member"];
const TENANT_ROLE_TO_CORE: Record<string, CoreRole> = {
  owner: "admin",
  admin: "admin",
  referee: "referee",
  staff: "member",
  coach: "member",
  member: "member",
};

type TenantRecord = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export async function listUserActiveTenants(
  db: SupabaseClient<any, any, any, any, any>,
  userId: string,
) {
  const { data: memberships, error: membershipError } = await db
    .from("sports_tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("status", "active");

  if (membershipError) {
    console.error("[Sports OS] Failed to read tenant memberships:", membershipError);
    return {
      ok: false as const,
      status: 500,
      error: "Unable to resolve organization membership.",
    };
  }

  if (!memberships?.length) {
    return { ok: true as const, tenants: [] as TenantRecord[] };
  }

  const tenantIds = [...new Set(memberships.map((item) => item.tenant_id))];
  const { data: tenants, error: tenantError } = await db
    .from("sports_tenants")
    .select("id, name, slug, status")
    .in("id", tenantIds)
    .eq("status", "active");

  if (tenantError) {
    console.error("[Sports OS] Failed to read active tenants:", tenantError);
    return {
      ok: false as const,
      status: 500,
      error: "Unable to resolve active organizations.",
    };
  }

  const roleByTenant = new Map(
    memberships.map((membership) => [membership.tenant_id, membership.role]),
  );

  return {
    ok: true as const,
    tenants: (tenants ?? []).map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      role: roleByTenant.get(tenant.id) ?? "member",
    })),
  };
}

export async function requireCoreRole(
  db: SupabaseClient<any, any, any, any, any>,
  allowed: readonly CoreRole[],
  requestedTenantId: string | null,
) {
  const {
    data: { user },
    error: userError,
  } = await db.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, status: 401, error: "Unauthenticated" };
  }

  // Resolve the organization from verified active memberships on the server.
  // A missing header is safe to infer only when exactly one active tenant exists.
  const activeTenants = await listUserActiveTenants(db, user.id);
  if (!activeTenants.ok) return activeTenants;

  if (activeTenants.tenants.length === 0) {
    return {
      ok: false as const,
      status: 403,
      error: "No active membership in this organization.",
    };
  }

  let tenantId = requestedTenantId;
  if (!tenantId) {
    if (activeTenants.tenants.length !== 1) {
      return {
        ok: false as const,
        status: 400,
        error: "A valid x-tenant-id header is required when multiple organizations are available.",
      };
    }
    tenantId = activeTenants.tenants[0].id;
  }

  // Make the successful tenant context explicitly non-null for downstream services.
  if (typeof tenantId !== "string" || tenantId.length === 0) {
    return {
      ok: false as const,
      status: 400,
      error: "A valid x-tenant-id header is required.",
    };
  }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      tenantId,
    )
  ) {
    return {
      ok: false as const,
      status: 400,
      error: "A valid x-tenant-id header is required.",
    };
  }

  const tenant = activeTenants.tenants.find((item) => item.id === tenantId);
  if (!tenant) {
    return {
      ok: false as const,
      status: 403,
      error: "No active membership in this organization.",
    };
  }

  const role = TENANT_ROLE_TO_CORE[tenant.role];
  if (!role || !CORE_ROLES.includes(role) || !allowed.includes(role)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return {
    ok: true as const,
    user: user as User,
    tenantId,
    profile: { id: user.id, role, full_name: user.email ?? "" },
  };
}
