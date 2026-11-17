import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoreRole } from "./types";

export async function requireCoreRole(
  db: SupabaseClient<any, any, any, any, any>,
  allowed: CoreRole[],
) {
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
  if (!allowed.includes(profile.role as CoreRole)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return {
    ok: true as const,
    user,
    profile: profile as { id: string; role: CoreRole; full_name: string },
  };
}
