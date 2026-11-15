-- METATYA Sports OS billing schema proposal
-- DESIGN ONLY: do not apply to any database before independent review and isolated tests.
-- Billing records are server-only. Keep this schema outside Supabase exposed schemas.
-- Never put provider secrets, card data, CVV, or full payment credentials in these tables.

create schema if not exists sports_private;

revoke all on schema sports_private from public, anon, authenticated;
grant usage on schema sports_private to service_role;

create table if not exists sports_private.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null check (plan_code in ('basic','professional','enterprise')),
  version integer not null check (version > 0),
  display_name text not null,
  currency char(3) not null default 'IRR',
  list_price_minor bigint check (list_price_minor is null or list_price_minor >= 0),
  is_quote_only boolean not null default true,
  entitlements jsonb not null default '{}'::jsonb,
  active_from timestamptz not null default now(),
  active_until timestamptz,
  created_at timestamptz not null default now(),
  unique (plan_code, version),
  check (active_until is null or active_until > active_from),
  check (is_quote_only or list_price_minor is not null)
);

create table if not exists sports_private.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete restrict,
  plan_id uuid not null references sports_private.subscription_plans(id) on delete restrict,
  term_months integer not null check (term_months in (3,6,12)),
  status text not null default 'pending_quote'
    check (status in ('pending_quote','pending_payment','active','past_due','grace','expired','canceled')),
  renewal_mode text not null default 'manual'
    check (renewal_mode in ('manual','automatic')),
  starts_at timestamptz,
  ends_at timestamptz,
  setup_fee_minor bigint check (setup_fee_minor is null or setup_fee_minor >= 0),
  discount_basis_points integer not null default 0
    check (discount_basis_points between 0 and 10000),
  currency char(3) not null default 'IRR',
  commercial_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((starts_at is null and ends_at is null) or (starts_at is not null and ends_at > starts_at))
);

create unique index if not exists sports_one_current_subscription_per_tenant
  on sports_private.tenant_subscriptions(tenant_id)
  where status in ('pending_payment','active','past_due','grace');

create index if not exists sports_subscriptions_end_date_idx
  on sports_private.tenant_subscriptions(status, ends_at);

create table if not exists sports_private.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.sports_tenants(id) on delete restrict,
  subscription_id uuid references sports_private.tenant_subscriptions(id) on delete restrict,
  invoice_number text not null unique,
  status text not null default 'draft'
    check (status in ('draft','issued','paid','overdue','void','refunded')),
  currency char(3) not null default 'IRR',
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (discount_minor <= subtotal_minor),
  check (total_minor = subtotal_minor - discount_minor + tax_minor)
);

create index if not exists sports_invoices_tenant_created_idx
  on sports_private.invoices(tenant_id, created_at desc);

create table if not exists sports_private.payment_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.sports_tenants(id) on delete restrict,
  provider_code text not null,
  provider_event_id text not null,
  idempotency_key text not null unique,
  event_type text not null,
  signature_verified boolean not null default false,
  processing_status text not null default 'received'
    check (processing_status in ('received','verified','processed','rejected')),
  amount_minor bigint check (amount_minor is null or amount_minor >= 0),
  currency char(3),
  redacted_metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider_code, provider_event_id)
);

create table if not exists sports_private.subscription_audit_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.sports_tenants(id) on delete restrict,
  actor_user_id uuid,
  action text not null,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sports_subscription_audit_tenant_created_idx
  on sports_private.subscription_audit_events(tenant_id, created_at desc);

alter table sports_private.subscription_plans enable row level security;
alter table sports_private.tenant_subscriptions enable row level security;
alter table sports_private.invoices enable row level security;
alter table sports_private.payment_events enable row level security;
alter table sports_private.subscription_audit_events enable row level security;

-- No anon/authenticated grants or policies are intentionally provided.
-- The trusted server uses service_role only from a protected environment.
-- Do not expose service_role credentials to browser code or tenant users.
revoke all on all tables in schema sports_private from public, anon, authenticated;
grant select, insert, update on sports_private.subscription_plans to service_role;
grant select, insert, update on sports_private.tenant_subscriptions to service_role;
grant select, insert, update on sports_private.invoices to service_role;
grant select, insert, update on sports_private.payment_events to service_role;
-- Audit records are append-only even for the billing service role.
grant select, insert on sports_private.subscription_audit_events to service_role;
grant usage, select on all sequences in schema sports_private to service_role;

alter default privileges in schema sports_private
  revoke all on tables from public, anon, authenticated;

comment on schema sports_private is
  'Server-only billing and subscription data. Not exposed through the public Data API.';
comment on table sports_private.payment_events is
  'Stores verified provider event metadata only; never store card numbers, CVV, or provider secrets.';
comment on table sports_private.subscription_audit_events is
  'Append-only audit intent; application code must not update or delete prior audit events.';
