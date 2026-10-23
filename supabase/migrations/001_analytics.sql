-- Anonymous daily page-view counts for the Ilam shooting federation site.
-- Stores only: day, path, and a number. No IP, cookies, or personal data.
-- Review before applying to any project. Not applied automatically.

create table if not exists public.page_daily_views (
  day   date    not null,
  path  text    not null check (char_length(path) <= 200),
  views integer not null default 0 check (views >= 0),
  primary key (day, path)
);

alter table public.page_daily_views enable row level security;

-- No direct table access for anonymous visitors; writes go only through the function below.
revoke all on public.page_daily_views from anon, authenticated;

create or replace function public.record_pageview(p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.page_daily_views (day, path, views)
  values (current_date, left(coalesce(p_path, '/'), 200), 1)
  on conflict (day, path)
  do update set views = public.page_daily_views.views + 1;
end;
$$;

revoke all on function public.record_pageview(text) from public;
grant execute on function public.record_pageview(text) to anon, authenticated;

-- Aggregated read for the admin dashboard (daily / monthly / yearly).
-- Restricted to authenticated admins; anonymous visitors cannot read counts.
create or replace function public.get_view_stats(p_grain text default 'day')
returns table (period text, views bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    case p_grain
      when 'year'  then to_char(day, 'YYYY')
      when 'month' then to_char(day, 'YYYY-MM')
      else to_char(day, 'YYYY-MM-DD')
    end as period,
    sum(views)::bigint as views
  from public.page_daily_views
  group by 1
  order by 1 desc;
$$;

revoke all on function public.get_view_stats(text) from public, anon;
grant execute on function public.get_view_stats(text) to authenticated;
