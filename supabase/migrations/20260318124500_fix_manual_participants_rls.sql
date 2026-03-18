-- Harden manual participants support by normalizing schema and INSERT policies.

alter table public.participants
  add column if not exists display_name text;

alter table public.participants
  alter column user_id drop not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'participants_manual_identity_check'
      and conrelid = 'public.participants'::regclass
  ) then
    alter table public.participants
      drop constraint participants_manual_identity_check;
  end if;
end $$;

alter table public.participants
  add constraint participants_manual_identity_check
  check (
    user_id is not null
    or nullif(btrim(display_name), '') is not null
  );

-- Remove any previous INSERT policy that may still block manual participants.
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'participants'
      and cmd = 'INSERT'
  loop
    execute format('drop policy if exists %I on public.participants', pol.policyname);
  end loop;
end $$;

create policy participants_insert_owner_or_self
on public.participants
for insert
to authenticated
with check (
  (
    user_id = auth.uid()
    and exists (
      select 1
      from public.groups g
      where g.id = participants.group_id
    )
  )
  or exists (
    select 1
    from public.groups g
    where g.id = participants.group_id
      and g.owner_id = auth.uid()
  )
);

