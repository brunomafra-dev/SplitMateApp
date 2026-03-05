-- Audit + fix for inconsistent transaction splits
-- Rule used:
-- 1) If transaction has participants array, use it as source of truth.
-- 2) Otherwise use current group participants (public.participants).
-- 3) Ensure payer is included in participants used for split.
-- 4) Recalculate equal split in cents (no floating drift), only when split is missing/incomplete/invalid.

create or replace function public.audit_fix_transaction_splits()
returns table (transaction_id uuid, reason text)
language plpgsql
security definer
as $$
declare
  tx record;
  participant_ids text[];
  clean_participant_ids text[];
  expected_count int;
  split_key_count int;
  split_sum numeric;
  needs_fix boolean;
  total_cents bigint;
  base_cents bigint;
  remainder_cents bigint;
  idx int;
  cents bigint;
  split_value numeric;
  new_splits jsonb;
begin
  for tx in
    select
      t.id,
      t.group_id,
      t.payer_id,
      t.value,
      t.splits,
      to_jsonb(t) as row_json
    from public.transactions t
  loop
    participant_ids := array[]::text[];

    -- participants from transaction payload (if column exists in this environment)
    if jsonb_typeof(tx.row_json -> 'participants') = 'array' then
      participant_ids := coalesce(
        (
          select array_agg(distinct pid) filter (where pid is not null and pid <> '')
          from (
            select nullif(trim(elem #>> '{}'), '') as pid
            from jsonb_array_elements(tx.row_json -> 'participants') elem
            where jsonb_typeof(elem) = 'string'
            union all
            select nullif(trim(coalesce(elem ->> 'user_id', elem ->> 'id')), '') as pid
            from jsonb_array_elements(tx.row_json -> 'participants') elem
            where jsonb_typeof(elem) = 'object'
          ) s
        ),
        array[]::text[]
      );
    end if;

    -- fallback: group participants table
    if coalesce(array_length(participant_ids, 1), 0) = 0 then
      participant_ids := coalesce(
        (
          select array_agg(distinct p.user_id::text order by p.user_id::text)
          from public.participants p
          where p.group_id = tx.group_id
        ),
        array[]::text[]
      );
    end if;

    -- ensure payer is part of split basis
    if tx.payer_id is not null and not (tx.payer_id::text = any(participant_ids)) then
      participant_ids := array_append(participant_ids, tx.payer_id::text);
    end if;

    clean_participant_ids := (
      select coalesce(array_agg(distinct pid order by pid), array[]::text[])
      from unnest(participant_ids) pid
      where pid is not null and pid <> ''
    );

    expected_count := coalesce(array_length(clean_participant_ids, 1), 0);
    if expected_count = 0 then
      continue;
    end if;

    split_key_count := 0;
    split_sum := 0;
    needs_fix := false;

    if tx.splits is null or jsonb_typeof(tx.splits) <> 'object' or tx.splits = '{}'::jsonb then
      needs_fix := true;
    else
      select count(*), coalesce(sum((v)::numeric), 0)
      into split_key_count, split_sum
      from jsonb_each_text(tx.splits) kv(k, v);

      if split_key_count <> expected_count then
        needs_fix := true;
      end if;

      if not needs_fix then
        -- every expected participant must exist with positive value
        if exists (
          select 1
          from unnest(clean_participant_ids) pid
          where (tx.splits ? pid) is false
             or coalesce((tx.splits ->> pid)::numeric, 0) <= 0
        ) then
          needs_fix := true;
        end if;
      end if;

      -- sum must match transaction value within 1 cent
      if not needs_fix and abs(coalesce(split_sum, 0) - coalesce(tx.value, 0)) > 0.01 then
        needs_fix := true;
      end if;
    end if;

    if needs_fix then
      total_cents := round(coalesce(tx.value, 0) * 100)::bigint;
      base_cents := total_cents / expected_count;
      remainder_cents := total_cents % expected_count;
      new_splits := '{}'::jsonb;

      for idx in 1..expected_count loop
        cents := base_cents + case when idx <= remainder_cents then 1 else 0 end;
        split_value := cents::numeric / 100;
        new_splits := new_splits || jsonb_build_object(clean_participant_ids[idx], split_value);
      end loop;

      update public.transactions t
      set splits = new_splits
      where t.id = tx.id;

      transaction_id := tx.id;
      reason := 'missing_or_incomplete_split_recalculated';
      return next;
    end if;
  end loop;
end;
$$;

-- Execute audit/fix now
select * from public.audit_fix_transaction_splits();

