-- Full split audit + repair in cents
-- Checks:
-- 1) expenses without splits
-- 2) incomplete splits (missing participants / wrong key count)
-- 3) inconsistent splits (invalid values or sum mismatch)

create or replace function public._resolve_tx_participants(
  p_group_id uuid,
  p_payer_id uuid,
  p_tx_row jsonb
)
returns text[]
language plpgsql
stable
as $$
declare
  ids text[];
begin
  ids := array[]::text[];

  if jsonb_typeof(p_tx_row -> 'participants') = 'array' then
    select coalesce(array_agg(distinct pid order by pid), array[]::text[])
      into ids
    from (
      select nullif(trim(elem #>> '{}'), '') as pid
      from jsonb_array_elements(p_tx_row -> 'participants') elem
      where jsonb_typeof(elem) = 'string'

      union all

      select nullif(trim(coalesce(elem ->> 'user_id', elem ->> 'id')), '') as pid
      from jsonb_array_elements(p_tx_row -> 'participants') elem
      where jsonb_typeof(elem) = 'object'
    ) s
    where pid is not null and pid <> '';
  end if;

  if coalesce(array_length(ids, 1), 0) = 0 then
    select coalesce(array_agg(distinct p.user_id::text order by p.user_id::text), array[]::text[])
      into ids
    from public.participants p
    where p.group_id = p_group_id;
  end if;

  if p_payer_id is not null and not (p_payer_id::text = any(ids)) then
    ids := array_append(ids, p_payer_id::text);
    select coalesce(array_agg(distinct pid order by pid), array[]::text[]) into ids
    from unnest(ids) pid;
  end if;

  return coalesce(ids, array[]::text[]);
end;
$$;

create or replace function public.audit_transaction_splits_full()
returns table (
  transaction_id uuid,
  issue text,
  expected_participants int,
  split_keys int,
  tx_value numeric,
  split_total numeric
)
language plpgsql
security definer
as $$
declare
  tx record;
  ids text[];
  expected_count int;
  keys_count int;
  sum_splits numeric;
  has_missing_key boolean;
  has_invalid_value boolean;
begin
  for tx in
    select t.id, t.group_id, t.payer_id, t.value, t.splits, to_jsonb(t) as row_json
    from public.transactions t
  loop
    ids := public._resolve_tx_participants(tx.group_id, tx.payer_id, tx.row_json);
    expected_count := coalesce(array_length(ids, 1), 0);

    if tx.splits is null or jsonb_typeof(tx.splits) <> 'object' or tx.splits = '{}'::jsonb then
      transaction_id := tx.id;
      issue := 'expense_sem_splits';
      expected_participants := expected_count;
      split_keys := 0;
      tx_value := tx.value;
      split_total := 0;
      return next;
      continue;
    end if;

    select count(*), coalesce(sum(value_num), 0)
      into keys_count, sum_splits
    from (
      select
        case
          when nullif(trim(v), '') is null then null
          when trim(v) ~ '^-?[0-9]+(\.[0-9]+)?$' then trim(v)::numeric
          else null
        end as value_num
      from jsonb_each_text(tx.splits) kv(k, v)
    ) s;

    has_missing_key := exists (
      select 1
      from unnest(ids) pid
      where (tx.splits ? pid) is false
    );

    has_invalid_value := exists (
      select 1
      from jsonb_each_text(tx.splits) kv(k, v)
      where
        nullif(trim(v), '') is null
        or trim(v) !~ '^-?[0-9]+(\.[0-9]+)?$'
        or trim(v)::numeric <= 0
    );

    if has_missing_key or (expected_count > 0 and keys_count <> expected_count) then
      transaction_id := tx.id;
      issue := 'splits_incompletos';
      expected_participants := expected_count;
      split_keys := keys_count;
      tx_value := tx.value;
      split_total := sum_splits;
      return next;
      continue;
    end if;

    if has_invalid_value or abs(coalesce(sum_splits, 0) - coalesce(tx.value, 0)) > 0.01 then
      transaction_id := tx.id;
      issue := 'splits_inconsistentes';
      expected_participants := expected_count;
      split_keys := keys_count;
      tx_value := tx.value;
      split_total := sum_splits;
      return next;
      continue;
    end if;
  end loop;
end;
$$;

create or replace function public.fix_transaction_splits_in_cents()
returns table (
  transaction_id uuid,
  fixed_issue text
)
language plpgsql
security definer
as $$
declare
  row_audit record;
  tx record;
  ids text[];
  expected_count int;
  total_cents bigint;
  base_cents bigint;
  rem_cents bigint;
  idx int;
  cents bigint;
  new_splits jsonb;
begin
  for row_audit in
    select *
    from public.audit_transaction_splits_full()
  loop
    select t.id, t.group_id, t.payer_id, t.value, to_jsonb(t) as row_json
      into tx
    from public.transactions t
    where t.id = row_audit.transaction_id;

    if tx.id is null then
      continue;
    end if;

    ids := public._resolve_tx_participants(tx.group_id, tx.payer_id, tx.row_json);
    expected_count := coalesce(array_length(ids, 1), 0);

    if expected_count = 0 then
      continue;
    end if;

    total_cents := round(coalesce(tx.value, 0) * 100)::bigint;
    base_cents := total_cents / expected_count;
    rem_cents := total_cents % expected_count;
    new_splits := '{}'::jsonb;

    for idx in 1..expected_count loop
      cents := base_cents + case when idx <= rem_cents then 1 else 0 end;
      new_splits := new_splits || jsonb_build_object(ids[idx], cents::numeric / 100);
    end loop;

    update public.transactions
    set splits = new_splits
    where id = tx.id;

    transaction_id := tx.id;
    fixed_issue := row_audit.issue;
    return next;
  end loop;
end;
$$;

-- Run audit + fix now
select * from public.audit_transaction_splits_full();
select * from public.fix_transaction_splits_in_cents();
