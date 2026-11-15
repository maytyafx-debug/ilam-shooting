-- Restrict legacy analytics RPCs to their intended audiences.
-- get_view_stats now verifies the authenticated user is an administrator.
-- is_admin is not exposed to anonymous callers.
revoke execute on function public.is_admin() from public, anon;

create or replace function public.get_view_stats(p_grain text default 'day')
returns table (period text, views bigint)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  if p_grain not in ('day', 'month', 'year') then
    raise exception 'invalid_grain' using errcode = '22023';
  end if;

  return query
  select
    case p_grain
      when 'year' then to_char(day, 'YYYY')
      when 'month' then to_char(day, 'YYYY-MM')
      else to_char(day, 'YYYY-MM-DD')
    end as period,
    sum(views)::bigint as views
  from public.page_daily_views
  group by 1
  order by 1 desc;
end;
$$;

revoke all on function public.get_view_stats(text) from public, anon;
grant execute on function public.get_view_stats(text) to authenticated;
