-- Disable the legacy public membership RPC.
-- Safe on fresh databases where the legacy function does not exist.
do $$
begin
  if to_regprocedure('public.submit_membership(text,text,text,text,text)') is not null then
    execute 'revoke execute on function public.submit_membership(text, text, text, text, text) from public, anon, authenticated';
  end if;
end
$$;
