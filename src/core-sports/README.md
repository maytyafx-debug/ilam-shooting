# Legacy Core Sports prototype — archived

این پوشه یک نمونه اولیه قدیمی است و **مسیر اجرایی Next.js فعلی نیست**. کد فعال هسته مشترک در `sports-os/lib/core-sports/` قرار دارد و اپلیکیشن اجرایی از Supabase schema عمومی `public` استفاده می‌کند.

## Active runtime contract

The current Next.js pilot uses only these operational tables:

- `public.sports_tenants`
- `public.sports_tenant_memberships`
- `public.sports_members`
- `public.sports_events`
- `public.sports_results`

The active app's Supabase clients explicitly select the `public` schema. Tenant membership and role are verified server-side for every operational API request.

## Important migration warning

Do not follow the historical setup instructions that referred to `sports_core` or migration `004_core_sports.sql` for the connected pilot. The old `sports_core` prototype and migrations 005/006 are not part of the active runtime and must not be applied to the connected Supabase project.

For current setup and testing, follow:

- `sports-os/README_NEXTJS.md`
- `sports-os/ARCHITECTURE.md`
- `sports-os/LIVE_IMPLEMENTATION_STATUS.md`

This folder is retained as historical source material only; it is not imported by the active `sports-os/app` Next.js application.
