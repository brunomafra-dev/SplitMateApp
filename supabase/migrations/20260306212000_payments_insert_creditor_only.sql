-- Payments insert hardening: only creditor can register settlement

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and cmd = 'INSERT'
  loop
    execute format('drop policy if exists %I on public.payments', pol.policyname);
  end loop;
end $$;

create policy payments_insert_creditor_only
on public.payments
for insert
to authenticated
with check (
  auth.uid() = to_user
  and from_user <> to_user
  and amount > 0
  and exists (
    select 1
    from public.participants p
    where p.group_id = payments.group_id
      and p.user_id = payments.from_user
  )
  and exists (
    select 1
    from public.participants p
    where p.group_id = payments.group_id
      and p.user_id = payments.to_user
  )
);
