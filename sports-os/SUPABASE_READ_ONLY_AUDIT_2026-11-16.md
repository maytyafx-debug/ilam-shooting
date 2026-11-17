# METATYA Sports OS — Read-Only Supabase Baseline Audit
Audit date: 2026-11-16
Target: existing Supabase project named ilam-shooting-federation
Mode: read-only inspection only
No database schema, data, policies, functions, credentials or project settings were changed.

## 1. Project state
- Supabase project status: ACTIVE_HEALTHY.
- Region: eu-central-1.
- PostgreSQL major version: 17.
- Existing project is dedicated by name to the Ilam shooting federation pilot.
- Existing migrations include analytics, members, admins, legacy membership submission shutdown, and analytics RPC restriction.
- No Edge Functions are currently listed.
- Observed row counts: public.members = 0; public.admins = 0; public.page_daily_views = 0.

## 2. Existing database surface
Observed public tables:
- page_daily_views — RLS enabled, no user-facing policies.
- members — RLS enabled; policies permit authenticated admin-only SELECT and UPDATE.
- admins — RLS enabled, no user-facing policies.

The current database does not yet contain the operational Sports OS domain model described in MASTER_BLUEPRINT.md and FOUNDATION_SPEC.md. In particular, there are no dedicated operational athlete, guardian, coach, referee, competition, result, talent-development, finance, insurance or facility-management tables in the inspected public schema.

The members table is a legacy membership-submission structure, not a complete athlete registry. It currently contains zero rows. Do not silently repurpose it as the future athlete domain.

## 3. Security advisor findings
### WARN — Public SECURITY DEFINER analytics writer
- public.record_pageview(p_path text) is SECURITY DEFINER.
- EXECUTE is currently granted to anon and authenticated.
- The function writes a bounded path string into page_daily_views.
- This may have been intended for public page analytics, but it is a publicly callable write surface and should be explicitly justified, rate-limited and monitored or replaced by a narrower server-side ingestion path.
- Repository code search on the current default branch did not find a reference to record_pageview. This does not rule out external callers or deployed code.

### WARN — Authenticated SECURITY DEFINER analytics reader
- public.get_view_stats(p_grain text) is SECURITY DEFINER and executable by authenticated.
- Its body checks auth.uid() and public.is_admin() before returning aggregates.
- The authorization check is present in the inspected function definition. Keep it covered by negative tests; do not assume that a SECURITY DEFINER function is safe merely because it checks a role.

### WARN — Authenticated SECURITY DEFINER role helper
- public.is_admin() is SECURITY DEFINER and executable by authenticated.
- It returns whether auth.uid() appears in public.admins.
- It is also used by the members RLS policies. Replacing or moving it requires preserving policy semantics and testing grants carefully.

### INFO — RLS enabled with no policies
- public.admins and public.page_daily_views have RLS enabled and no user-facing policies.
- Current grants show these tables are not directly granted to anon/authenticated; postgres and service_role retain access.
- This is restrictive rather than evidence of public table exposure. Review whether the no-policy design is intentional and document it.

### WARN — Leaked password protection disabled
- Supabase Auth leaked-password protection is currently disabled according to the security advisor.
- Enablement should be planned after reviewing current Auth configuration and expected user onboarding. No Auth setting was changed during this audit.

### INFO — Unindexed foreign key
- public.members.reviewed_by has a foreign key to auth.users without a covering index.
- The table currently has zero rows. Consider adding the index only if the legacy table remains in use; avoid unnecessary schema churn if it is being retired.

### Health
- The health advisor returned no findings at audit time.

## 4. Required remediation decisions
1. Decide whether public page-view analytics is still required. If not, plan revocation/removal of the public writer after checking all deployed consumers. If required, replace or constrain it with a documented, rate-limited, low-privilege ingestion design.
2. Keep get_view_stats restricted to authenticated administrators and add negative tests for non-admin users, anonymous users and invalid aggregation grain.
3. Review is_admin function grants and its dependency in RLS policies before changing it.
4. Confirm whether admins and page_daily_views should remain inaccessible directly to client roles.
5. Review and enable leaked-password protection with a controlled Auth configuration change.
6. Decide whether the legacy members table is retired or maintained; do not use it as the new athlete registry without a separately reviewed migration.
7. Do not import real athlete or minor data until the new scoped identity, consent, access and retention model has been implemented and tested.

## 5. Verification boundary
This report is based on live read-only project metadata, table definitions, migration history, policy definitions, grants, function definitions and Supabase advisors at the audit time. It is not a penetration test, independent security certification, full backup/restore test or production-readiness approval.

No database changes were made. Any remediation that changes live RPC behavior, grants, RLS policies, Auth settings or schema requires a reviewed migration, impact assessment and explicit authorization.
