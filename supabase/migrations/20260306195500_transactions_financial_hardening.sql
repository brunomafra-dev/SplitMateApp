-- Financial hardening for transaction consistency
-- 1) Replace all transaction RLS policies with strict participant-based policies
-- 2) Enforce split integrity in DB (non-empty, positive, member-only keys, sum in cents)

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transactions'
  loop
    execute format('drop policy if exists %I on public.transactions', pol.policyname);
  end loop;
end $$;

create policy transactions_select_member
on public.transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.participants p
    where p.group_id = transactions.group_id
      and p.user_id = auth.uid()
  )
);

create policy transactions_insert_member
on public.transactions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.participants p
    where p.group_id = transactions.group_id
      and p.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.participants payer_member
    where payer_member.group_id = transactions.group_id
      and payer_member.user_id = transactions.payer_id
  )
);

create policy transactions_update_payer
on public.transactions
for update
to authenticated
using (
  transactions.payer_id = auth.uid()
  and exists (
    select 1
    from public.participants p
    where p.group_id = transactions.group_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.participants p
    where p.group_id = transactions.group_id
      and p.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.participants payer_member
    where payer_member.group_id = transactions.group_id
      and payer_member.user_id = transactions.payer_id
  )
);

create policy transactions_delete_payer
on public.transactions
for delete
to authenticated
using (
  transactions.payer_id = auth.uid()
  and exists (
    select 1
    from public.participants p
    where p.group_id = transactions.group_id
      and p.user_id = auth.uid()
  )
);

create or replace function public.validate_transaction_splits()
returns trigger
language plpgsql
as $$
declare
  split_key text;
  split_raw text;
  split_value numeric;
  splits_total_cents bigint := 0;
  tx_value_cents bigint;
begin
  if new.value is null or new.value <= 0 then
    raise exception using
      errcode = '23514',
      message = 'transaction value must be greater than zero';
  end if;

  if new.payer_id is null then
    raise exception using
      errcode = '23514',
      message = 'transaction payer_id is required';
  end if;

  if new.splits is null
     or jsonb_typeof(new.splits) <> 'object'
     or new.splits = '{}'::jsonb then
    raise exception using
      errcode = '23514',
      message = 'transaction splits must be a non-empty json object';
  end if;

  tx_value_cents := round(new.value * 100)::bigint;

  for split_key, split_raw in
    select key, value
    from jsonb_each_text(new.splits)
  loop
    split_key := trim(coalesce(split_key, ''));
    split_raw := trim(coalesce(split_raw, ''));

    if split_key = '' then
      raise exception using
        errcode = '23514',
        message = 'transaction split key cannot be empty';
    end if;

    begin
      split_value := split_raw::numeric;
    exception
      when others then
        raise exception using
          errcode = '23514',
          message = format('transaction split value is invalid for key %s', split_key);
    end;

    if split_value <= 0 then
      raise exception using
        errcode = '23514',
        message = format('transaction split value must be positive for key %s', split_key);
    end if;

    if not exists (
      select 1
      from public.participants p
      where p.group_id = new.group_id
        and p.user_id::text = split_key
    ) then
      raise exception using
        errcode = '23514',
        message = format('transaction split key %s is not a group participant', split_key);
    end if;

    splits_total_cents := splits_total_cents + round(split_value * 100)::bigint;
  end loop;

  if not (new.splits ? new.payer_id::text) then
    raise exception using
      errcode = '23514',
      message = 'transaction splits must include payer_id';
  end if;

  if splits_total_cents <> tx_value_cents then
    raise exception using
      errcode = '23514',
      message = format(
        'transaction splits sum mismatch (expected %s cents, got %s cents)',
        tx_value_cents,
        splits_total_cents
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_transaction_splits on public.transactions;
create trigger trg_validate_transaction_splits
before insert or update on public.transactions
for each row
execute function public.validate_transaction_splits();
