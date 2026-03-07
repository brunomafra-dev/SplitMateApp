-- Validate payment integrity before accepting inserts on public.payments
-- Rules:
-- 1) amount must be positive
-- 2) amount must not be absurdly large
-- 3) payment must match a real outstanding debt in the same group/pair
-- 4) payment amount cannot exceed outstanding debt

create or replace function public.validate_payment_integrity()
returns trigger
language plpgsql
as $$
declare
  cutoff_ts timestamptz := coalesce(new.created_at, now());
  total_debt_cents bigint := 0;
  total_paid_cents bigint := 0;
  outstanding_cents bigint := 0;
  incoming_cents bigint := 0;
begin
  if new.amount is null then
    raise exception using
      errcode = '23514',
      message = 'payment amount is required';
  end if;

  if new.amount <= 0 then
    raise exception using
      errcode = '23514',
      message = 'payment amount must be positive';
  end if;

  if new.amount > 10000000 then
    raise exception using
      errcode = '23514',
      message = 'payment amount too large';
  end if;

  if new.from_user is null or new.to_user is null then
    raise exception using
      errcode = '23514',
      message = 'payment from_user/to_user are required';
  end if;

  if new.from_user = new.to_user then
    raise exception using
      errcode = '23514',
      message = 'payment from_user and to_user must be different';
  end if;

  incoming_cents := round(new.amount * 100)::bigint;

  -- Original debt for this pair in this group:
  -- debtor = from_user, creditor = to_user, split anchored on payer (to_user)
  select coalesce(sum(round(((t.splits ->> new.from_user::text)::numeric) * 100)), 0)::bigint
  into total_debt_cents
  from public.transactions t
  where t.group_id = new.group_id
    and t.payer_id = new.to_user
    and coalesce(lower((to_jsonb(t) ->> 'status')), '') <> 'paid'
    and (t.splits ? new.from_user::text)
    and coalesce(t.created_at, cutoff_ts) <= cutoff_ts;

  -- Already registered payments for the same pair/group
  select coalesce(sum(round(p.amount * 100)), 0)::bigint
  into total_paid_cents
  from public.payments p
  where p.group_id = new.group_id
    and p.from_user = new.from_user
    and p.to_user = new.to_user
    and coalesce(p.created_at, cutoff_ts) <= cutoff_ts;

  outstanding_cents := total_debt_cents - total_paid_cents;

  if outstanding_cents <= 0 then
    raise exception using
      errcode = '23514',
      message = 'no outstanding debt for this payment pair';
  end if;

  if incoming_cents > outstanding_cents then
    raise exception using
      errcode = '23514',
      message = format(
        'payment exceeds outstanding debt (incoming=%s cents, outstanding=%s cents)',
        incoming_cents,
        outstanding_cents
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_payment_integrity on public.payments;

create trigger trg_validate_payment_integrity
before insert on public.payments
for each row
execute function public.validate_payment_integrity();
