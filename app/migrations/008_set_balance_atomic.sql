-- ─────────────────────────────────────────────────────────────────────────────
-- set_balance_atomic migration
--
-- Replaces the read-modify-write sequence in /api/rpc/sync-balance
-- (fetch balance → credit_balance OR spend_balance) with one row-locked
-- transaction, closing the TOCTOU race where two concurrent syncs — or a
-- sync racing a vote — could double-apply or clobber the balance.
--
-- Run in the Supabase SQL editor after supabase-schema.sql.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function set_balance_atomic(p_wallet text, p_target bigint)
returns json as $$
declare
  v_user record;
begin
  if p_target < 0 then
    return json_build_object('success', false, 'error', 'invalid_target');
  end if;

  select * into v_user from users where wallet = p_wallet for update;
  if not found then
    return json_build_object('success', false, 'error', 'user_not_found');
  end if;

  update users set balance = p_target where wallet = p_wallet
    returning * into v_user;

  return json_build_object('success', true, 'new_balance', v_user.balance);
end;
$$ language plpgsql security definer;
