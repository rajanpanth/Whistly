
-- ============================================================
-- >>> 001_schema.sql
-- ============================================================

-- ============================================================
-- Whistly — Supabase Database Schema  (v2 — atomic RPCs + tighter RLS)
-- Run this in your Supabase SQL Editor (supabase.com → project → SQL Editor)
--
-- NOTE: If upgrading from v1, run the "Migration" section at the bottom
--       separately AFTER the initial tables exist.
-- ============================================================
-- rajan
-- 1. Users table
create table if not exists users (
  wallet text primary key,
  balance bigint not null default 5000000000,
  signup_bonus_claimed boolean not null default true,
  last_weekly_reward_ts bigint not null default 0,
  total_votes_cast bigint not null default 0,
  total_polls_voted bigint not null default 0,
  polls_won bigint not null default 0,
  polls_created bigint not null default 0,
  total_spent_cents bigint not null default 0,
  total_winnings_cents bigint not null default 0,
  weekly_winnings_cents bigint not null default 0,
  monthly_winnings_cents bigint not null default 0,
  weekly_spent_cents bigint not null default 0,
  monthly_spent_cents bigint not null default 0,
  weekly_votes_cast bigint not null default 0,
  monthly_votes_cast bigint not null default 0,
  weekly_polls_won bigint not null default 0,
  monthly_polls_won bigint not null default 0,
  weekly_polls_voted bigint not null default 0,
  monthly_polls_voted bigint not null default 0,
  creator_earnings_cents bigint not null default 0,
  weekly_reset_ts bigint not null default 0,
  monthly_reset_ts bigint not null default 0,
  created_at bigint not null default 0
);

-- 2. Polls table
create table if not exists polls (
  id text primary key,
  poll_id bigint not null default 0,
  creator text not null,
  title text not null,
  description text not null default '',
  category text not null default '',
  image_url text not null default '',
  option_images text[] not null default '{}',
  options text[] not null,
  vote_counts bigint[] not null,
  unit_price_cents bigint not null,
  end_time bigint not null,
  total_pool_cents bigint not null default 0,
  creator_investment_cents bigint not null default 0,
  platform_fee_cents bigint not null default 0,
  creator_reward_cents bigint not null default 0,
  status smallint not null default 0,
  winning_option smallint not null default 255,
  total_voters bigint not null default 0,
  market_kind smallint not null default 0,
  created_at bigint not null default 0
);

-- 3. Votes table
create table if not exists votes (
  id uuid default gen_random_uuid() primary key,
  poll_id text not null references polls(id) on delete cascade,
  voter text not null,
  votes_per_option bigint[] not null,
  total_staked_cents bigint not null default 0,
  claimed boolean not null default false,
  unique(poll_id, voter)
);

-- ============================================================
-- 4. Row Level Security
--    Since we use the Supabase anon key without Supabase Auth,
--    we cannot use auth.uid(). Instead we funnel ALL writes through
--    SECURITY DEFINER RPCs below, and allow only SELECT via RLS.
--
--    For a production deployment you should add an Edge Function
--    layer that verifies wallet signatures and creates custom JWTs.
-- ============================================================
alter table users enable row level security;
alter table polls enable row level security;
alter table votes enable row level security;

-- Drop old wide-open policies if upgrading
drop policy if exists "Allow all on users" on users;
drop policy if exists "Allow all on polls"  on polls;
drop policy if exists "Allow all on votes"  on votes;
drop policy if exists "Users read"   on users;
drop policy if exists "Polls read"   on polls;
drop policy if exists "Votes read"   on votes;
drop policy if exists "Polls write"  on polls;
drop policy if exists "Polls update" on polls;
drop policy if exists "Polls delete" on polls;
drop policy if exists "Votes write"  on votes;
drop policy if exists "Votes update" on votes;
drop policy if exists "Users insert" on users;
drop policy if exists "Users update" on users;

-- SELECT only for the anon role
create policy "Users read" on users for select using (true);
create policy "Polls read" on polls for select using (true);
create policy "Votes read" on votes for select using (true);

-- No direct writes for anon role — ALL mutations go through SECURITY DEFINER RPCs.
-- This prevents any client from modifying balances, votes, or polls directly.
-- The RPCs below handle all write operations with proper validation.

-- 5. Enable Realtime on all tables
alter table users replica identity full;
alter table polls replica identity full;
alter table votes replica identity full;

do $$ begin
  alter publication supabase_realtime add table users;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table polls;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table votes;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 6. RPC Functions — atomic balance & claim operations
-- ============================================================

-- 6a. Atomic signup: insert-if-not-exists, always returns the user record.
-- p_initial_balance: Optional starting balance in lamports (e.g. the user's
-- devnet wallet balance). Defaults to 5 SOL (5000000000) if not provided or 0.
-- Only affects NEW users — existing users keep their current balance (ON CONFLICT DO NOTHING).
create or replace function signup_user(p_wallet text, p_initial_balance bigint default 5000000000)
returns json as $$
declare
  v_user record;
  v_now bigint;
  v_balance bigint;
begin
  v_now := (extract(epoch from now()) * 1000)::bigint;
  -- Use the provided initial balance, but floor at 0
  v_balance := greatest(coalesce(p_initial_balance, 5000000000), 0);

  insert into users (wallet, balance, signup_bonus_claimed, last_weekly_reward_ts, created_at, weekly_reset_ts, monthly_reset_ts)
  values (p_wallet, v_balance, true, v_now, v_now, v_now, v_now)
  on conflict (wallet) do nothing;

  select * into v_user from users where wallet = p_wallet;
  return row_to_json(v_user);
end;
$$ language plpgsql security definer;

-- 6b. Atomic daily reward claim ($100 every 24 h, server-enforced)
create or replace function claim_daily_reward(p_wallet text)
returns json as $$
declare
  v_user record;
  v_now bigint;
  v_day_ms bigint := 86400000;
begin
  v_now := (extract(epoch from now()) * 1000)::bigint;

  select * into v_user from users where wallet = p_wallet for update;
  if not found then
    return json_build_object('success', false, 'error', 'user_not_found');
  end if;

  if v_now - v_user.last_weekly_reward_ts < v_day_ms then
    return json_build_object(
      'success', false,
      'error', 'too_early',
      'remaining_ms', v_day_ms - (v_now - v_user.last_weekly_reward_ts),
      'last_claim_ts', v_user.last_weekly_reward_ts,
      'balance', v_user.balance
    );
  end if;

  update users
    set balance = balance + 2000000000,
        last_weekly_reward_ts = v_now
    where wallet = p_wallet
    returning * into v_user;

  return json_build_object(
    'success', true,
    'new_balance', v_user.balance,
    'last_claim_ts', v_user.last_weekly_reward_ts
  );
end;
$$ language plpgsql security definer;

-- 6c. Atomic balance deduction
create or replace function spend_balance(p_wallet text, p_amount bigint)
returns json as $$
declare
  v_user record;
begin
  select * into v_user from users where wallet = p_wallet for update;
  if not found then
    return json_build_object('success', false, 'error', 'user_not_found');
  end if;

  if v_user.balance < p_amount then
    return json_build_object('success', false, 'error', 'insufficient_balance', 'balance', v_user.balance);
  end if;

  update users set balance = balance - p_amount where wallet = p_wallet
    returning * into v_user;

  return json_build_object('success', true, 'new_balance', v_user.balance);
end;
$$ language plpgsql security definer;

-- 6d. Atomic balance credit
create or replace function credit_balance(p_wallet text, p_amount bigint)
returns json as $$
declare
  v_user record;
begin
  update users set balance = balance + p_amount where wallet = p_wallet
    returning * into v_user;

  if not found then
    return json_build_object('success', false, 'error', 'user_not_found');
  end if;

  return json_build_object('success', true, 'new_balance', v_user.balance);
end;
$$ language plpgsql security definer;

-- ============================================================
-- 7. Atomic cast_vote
--    Deducts balance + increments vote_counts + upserts vote in one TX
-- ============================================================
create or replace function cast_vote_atomic(
  p_wallet text,
  p_poll_id text,
  p_option_index int,   -- 0-based from the client
  p_num_coins int
)
returns json as $$
declare
  v_user record;
  v_poll record;
  v_vote record;
  v_cost bigint;
  v_new_vote_counts bigint[];
  v_new_vpo bigint[];
  v_is_first_vote boolean := false;
  v_pg_idx int;          -- 1-based for Postgres arrays
  i int;
  v_now_ms bigint;       -- current time in ms for period resets
  v_week_ms bigint := 604800000;  -- 7 days in ms
  v_month_ms bigint := 2592000000; -- 30 days in ms
begin
  v_pg_idx := p_option_index + 1;

  select * into v_user from users where wallet = p_wallet for update;
  if not found then
    return json_build_object('success', false, 'error', 'user_not_found');
  end if;

  select * into v_poll from polls where id = p_poll_id for update;
  if not found then
    return json_build_object('success', false, 'error', 'poll_not_found');
  end if;

  if v_poll.status != 0 then
    return json_build_object('success', false, 'error', 'poll_not_active');
  end if;

  -- end_time is in SECONDS
  if (extract(epoch from now()))::bigint > v_poll.end_time then
    return json_build_object('success', false, 'error', 'poll_ended');
  end if;

  if v_pg_idx < 1 or v_pg_idx > array_length(v_poll.options, 1) then
    return json_build_object('success', false, 'error', 'invalid_option');
  end if;

  if v_poll.creator = p_wallet then
    return json_build_object('success', false, 'error', 'creator_cannot_vote');
  end if;

  v_cost := p_num_coins::bigint * v_poll.unit_price_cents;

  if v_user.balance < v_cost then
    return json_build_object('success', false, 'error', 'insufficient_balance', 'balance', v_user.balance);
  end if;

  -- Deduct balance
  update users set balance = balance - v_cost where wallet = p_wallet;

  -- Increment vote_counts
  v_new_vote_counts := v_poll.vote_counts;
  v_new_vote_counts[v_pg_idx] := coalesce(v_new_vote_counts[v_pg_idx], 0) + p_num_coins;

  -- Check existing vote
  select * into v_vote from votes where poll_id = p_poll_id and voter = p_wallet for update;

  if found then
    v_new_vpo := v_vote.votes_per_option;
    v_new_vpo[v_pg_idx] := coalesce(v_new_vpo[v_pg_idx], 0) + p_num_coins;
    update votes
      set votes_per_option = v_new_vpo,
          total_staked_cents = total_staked_cents + v_cost
      where poll_id = p_poll_id and voter = p_wallet;
  else
    v_is_first_vote := true;
    v_new_vpo := array_fill(0::bigint, array[array_length(v_poll.options, 1)]);
    v_new_vpo[v_pg_idx] := p_num_coins;
    insert into votes (poll_id, voter, votes_per_option, total_staked_cents, claimed)
      values (p_poll_id, p_wallet, v_new_vpo, v_cost, false);
  end if;

  update polls
    set vote_counts = v_new_vote_counts,
        total_pool_cents = total_pool_cents + v_cost,
        total_voters = total_voters + (case when v_is_first_vote then 1 else 0 end)
    where id = p_poll_id;

  -- ── Inline period reset before incrementing weekly/monthly counters ──
  -- If the user's weekly/monthly reset_ts is expired, zero out those counters first.
  -- This ensures leaderboard data stays fresh without needing a cron job.
  v_now_ms := (extract(epoch from now()) * 1000)::bigint;

  if v_user.weekly_reset_ts < (v_now_ms - v_week_ms) then
    update users
      set weekly_winnings_cents = 0, weekly_spent_cents = 0,
          weekly_votes_cast = 0, weekly_polls_won = 0, weekly_polls_voted = 0,
          weekly_reset_ts = v_now_ms
      where wallet = p_wallet;
  end if;

  if v_user.monthly_reset_ts < (v_now_ms - v_month_ms) then
    update users
      set monthly_winnings_cents = 0, monthly_spent_cents = 0,
          monthly_votes_cast = 0, monthly_polls_won = 0, monthly_polls_voted = 0,
          monthly_reset_ts = v_now_ms
      where wallet = p_wallet;
  end if;

  update users
    set total_votes_cast  = total_votes_cast + p_num_coins,
        total_polls_voted = total_polls_voted + (case when v_is_first_vote then 1 else 0 end),
        total_spent_cents  = total_spent_cents + v_cost,
        weekly_votes_cast  = weekly_votes_cast + p_num_coins,
        monthly_votes_cast = monthly_votes_cast + p_num_coins,
        weekly_spent_cents = weekly_spent_cents + v_cost,
        monthly_spent_cents = monthly_spent_cents + v_cost,
        weekly_polls_voted = weekly_polls_voted + (case when v_is_first_vote then 1 else 0 end),
        monthly_polls_voted = monthly_polls_voted + (case when v_is_first_vote then 1 else 0 end)
    where wallet = p_wallet;

  select balance into v_user from users where wallet = p_wallet;

  return json_build_object(
    'success', true,
    'new_balance', v_user.balance,
    'cost', v_cost,
    'is_first_vote', v_is_first_vote
  );
end;
$$ language plpgsql security definer;


-- ============================================================
-- 8. Atomic settle_poll — winner determination + creator payout
-- ============================================================
create or replace function settle_poll_atomic(p_wallet text, p_poll_id text)
returns json as $$
declare
  v_poll record;
  v_max_votes bigint := 0;
  v_winning_idx int := 0;
  v_total_votes bigint := 0;
  v_creator_credit bigint;
  v_is_admin boolean;
  i int;
begin
  select * into v_poll from polls where id = p_poll_id for update;
  if not found then
    return json_build_object('success', false, 'error', 'poll_not_found');
  end if;

  if v_poll.status != 0 then
    return json_build_object('success', false, 'error', 'already_settled');
  end if;

  -- Authorization: only creator or admin can settle
  v_is_admin := EXISTS (SELECT 1 FROM admin_wallets WHERE wallet = p_wallet);
  if v_poll.creator != p_wallet and not v_is_admin then
    return json_build_object('success', false, 'error', 'not_authorized');
  end if;

  for i in 1..coalesce(array_length(v_poll.vote_counts, 1), 0) loop
    v_total_votes := v_total_votes + v_poll.vote_counts[i];
    if v_poll.vote_counts[i] > v_max_votes then
      v_max_votes := v_poll.vote_counts[i];
      v_winning_idx := i - 1;   -- 0-based to match frontend convention
    end if;
  end loop;

  -- No votes → winning_option = 255
  if v_total_votes = 0 then
    v_winning_idx := 255;
  end if;

  update polls
    set status = 1,
        winning_option = v_winning_idx
    where id = p_poll_id;

  -- Credit creator: reward + platform fee
  v_creator_credit := v_poll.creator_reward_cents + v_poll.platform_fee_cents;
  if v_creator_credit > 0 then
    update users
      set balance = balance + v_creator_credit,
          creator_earnings_cents = creator_earnings_cents + v_poll.creator_reward_cents
      where wallet = v_poll.creator;
  end if;

  return json_build_object(
    'success', true,
    'winning_option', v_winning_idx,
    'total_votes', v_total_votes,
    'creator_reward', v_poll.creator_reward_cents,
    'platform_fee', v_poll.platform_fee_cents
  );
end;
$$ language plpgsql security definer;


-- ============================================================
-- 9. Atomic claim_reward — eligibility check + balance credit + mark claimed
-- ============================================================
create or replace function claim_reward_atomic(p_wallet text, p_poll_id text)
returns json as $$
declare
  v_poll record;
  v_vote record;
  v_user record;
  v_user_winning_votes bigint;
  v_total_winning_votes bigint;
  v_reward bigint;
  v_now_ms bigint;
  v_week_ms bigint := 604800000;
  v_month_ms bigint := 2592000000;
begin
  select * into v_poll from polls where id = p_poll_id;
  if not found then
    return json_build_object('success', false, 'error', 'poll_not_found');
  end if;

  if v_poll.status != 1 then
    return json_build_object('success', false, 'error', 'poll_not_settled');
  end if;

  if v_poll.winning_option = 255 then
    return json_build_object('success', false, 'error', 'no_winner');
  end if;

  select * into v_vote from votes where poll_id = p_poll_id and voter = p_wallet for update;
  if not found then
    return json_build_object('success', false, 'error', 'no_vote_found');
  end if;

  if v_vote.claimed then
    return json_build_object('success', false, 'error', 'already_claimed');
  end if;

  -- winning_option is 0-based from frontend, convert to 1-based for Postgres arrays
  v_user_winning_votes := v_vote.votes_per_option[v_poll.winning_option + 1];
  if v_user_winning_votes is null or v_user_winning_votes = 0 then
    return json_build_object('success', false, 'error', 'did_not_win');
  end if;

  v_total_winning_votes := v_poll.vote_counts[v_poll.winning_option + 1];
  -- Use NUMERIC division + FLOOR to prevent rounding loss/leak
  v_reward := floor((v_user_winning_votes::numeric * v_poll.total_pool_cents::numeric) / v_total_winning_votes::numeric)::bigint;

  -- ── Inline period reset before incrementing weekly/monthly counters ──
  select * into v_user from users where wallet = p_wallet;
  v_now_ms := (extract(epoch from now()) * 1000)::bigint;

  if v_user.weekly_reset_ts < (v_now_ms - v_week_ms) then
    update users
      set weekly_winnings_cents = 0, weekly_spent_cents = 0,
          weekly_votes_cast = 0, weekly_polls_won = 0, weekly_polls_voted = 0,
          weekly_reset_ts = v_now_ms
      where wallet = p_wallet;
  end if;

  if v_user.monthly_reset_ts < (v_now_ms - v_month_ms) then
    update users
      set monthly_winnings_cents = 0, monthly_spent_cents = 0,
          monthly_votes_cast = 0, monthly_polls_won = 0, monthly_polls_voted = 0,
          monthly_reset_ts = v_now_ms
      where wallet = p_wallet;
  end if;

  update users
    set balance = balance + v_reward,
        total_winnings_cents = total_winnings_cents + v_reward,
        weekly_winnings_cents = weekly_winnings_cents + v_reward,
        monthly_winnings_cents = monthly_winnings_cents + v_reward,
        polls_won = polls_won + 1,
        weekly_polls_won = weekly_polls_won + 1,
        monthly_polls_won = monthly_polls_won + 1
    where wallet = p_wallet;

  update votes set claimed = true where poll_id = p_poll_id and voter = p_wallet;

  return json_build_object(
    'success', true,
    'reward', v_reward
  );
end;
$$ language plpgsql security definer;

-- ============================================================
-- 5. Comments table (for poll discussion threads)
-- ============================================================
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  poll_id text not null references polls(id) on delete cascade,
  wallet text not null,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_comments_poll_id on comments(poll_id);
create index if not exists idx_comments_created_at on comments(created_at desc);

-- RLS
alter table comments enable row level security;

drop policy if exists "Anyone can read comments" on comments;
create policy "Anyone can read comments"
  on comments for select using (true);

-- Comments are inserted via RPC — no direct inserts from anon role

-- Enable realtime for comments
do $$ begin
  alter publication supabase_realtime add table comments;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- Referrals table
-- ============================================================
create table if not exists referrals (
  referee text primary key,          -- the user who was referred (one referrer per user)
  referrer text not null,            -- the user who shared the link
  created_at bigint not null default 0
);

create index if not exists idx_referrals_referrer on referrals(referrer);

alter table referrals enable row level security;

drop policy if exists "Anyone can read referrals" on referrals;
create policy "Anyone can read referrals"
  on referrals for select using (true);

-- Referrals are inserted via RPC — no direct inserts from anon role

-- ============================================================
-- Resolution proofs table
-- ============================================================
create table if not exists resolution_proofs (
  poll_id text primary key references polls(id) on delete cascade,
  source_url text not null,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

alter table resolution_proofs enable row level security;

drop policy if exists "Anyone can read resolution proofs" on resolution_proofs;
create policy "Anyone can read resolution proofs"
  on resolution_proofs for select using (true);

-- Resolution proofs are inserted via RPC — no direct inserts from anon role

-- ============================================================
-- Live Goal Market metadata
-- ============================================================
create table if not exists live_goal_markets (
  id text primary key,
  onchain_market_pubkey text not null references polls(id) on delete cascade,
  onchain_poll_id bigint not null,
  txodds_fixture_id text not null,
  market_kind text not null default 'LIVE_GOAL_WINDOW',
  home_team text not null,
  away_team text not null,
  match_clock_at_start text not null,
  window_minutes smallint not null check (window_minutes in (5, 15, 45)),
  window_start_ts bigint not null,
  lock_ts bigint not null,
  window_end_ts bigint not null,
  start_home_score smallint not null,
  start_away_score smallint not null,
  end_home_score smallint,
  end_away_score smallint,
  status text not null default 'OPEN',
  winning_outcome text,
  winning_option_index smallint,
  settlement_tx text,
  resolution_source text not null default 'MOCK',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_live_goal_markets_fixture on live_goal_markets(txodds_fixture_id);
create index if not exists idx_live_goal_markets_status on live_goal_markets(status);

alter table live_goal_markets enable row level security;

drop policy if exists "Anyone can read live goal markets" on live_goal_markets;
create policy "Anyone can read live goal markets"
  on live_goal_markets for select using (true);

-- Demo writes use Next.js API routes. Production should add SECURITY DEFINER RPCs
-- with wallet/admin verification before enabling direct writes.

-- ============================================================
-- 10. Atomic create_poll — validates and inserts poll + deducts creator balance
-- ============================================================
create or replace function create_poll_atomic(
  p_wallet text,
  p_id text,
  p_poll_id bigint,
  p_title text,
  p_description text,
  p_category text,
  p_image_url text,
  p_option_images text[],
  p_options text[],
  p_unit_price_cents bigint,
  p_end_time bigint,
  p_creator_investment_cents bigint,
  p_market_kind smallint default 0
)
returns json as $$
declare
  v_user record;
  v_platform_fee bigint;
  v_creator_reward bigint;
  v_pool_seed bigint;
  v_now bigint;
begin
  v_now := (extract(epoch from now()))::bigint;

  -- ── Input validation ──
  if char_length(p_title) < 1 or char_length(p_title) > 200 then
    return json_build_object('success', false, 'error', 'title_invalid_length');
  end if;

  if array_length(p_options, 1) is null or array_length(p_options, 1) < 2 then
    return json_build_object('success', false, 'error', 'need_at_least_2_options');
  end if;

  if p_end_time <= v_now then
    return json_build_object('success', false, 'error', 'end_time_must_be_future');
  end if;

  if p_unit_price_cents <= 0 then
    return json_build_object('success', false, 'error', 'unit_price_must_be_positive');
  end if;

  if p_creator_investment_cents <= 0 then
    return json_build_object('success', false, 'error', 'investment_must_be_positive');
  end if;

  if p_market_kind not in (0, 1) then
    return json_build_object('success', false, 'error', 'invalid_market_kind');
  end if;

  select * into v_user from users where wallet = p_wallet for update;
  if not found then
    return json_build_object('success', false, 'error', 'user_not_found');
  end if;

  if v_user.balance < p_creator_investment_cents then
    return json_build_object('success', false, 'error', 'insufficient_balance', 'balance', v_user.balance);
  end if;

  -- Fee math
  v_platform_fee := greatest(p_creator_investment_cents / 100, 1);
  v_creator_reward := greatest(p_creator_investment_cents / 100, 1);
  v_pool_seed := p_creator_investment_cents - v_platform_fee - v_creator_reward;

  -- Deduct balance
  update users
    set balance = balance - p_creator_investment_cents,
        polls_created = polls_created + 1,
        total_spent_cents = total_spent_cents + p_creator_investment_cents
    where wallet = p_wallet;

  -- Insert poll
  insert into polls (
    id, poll_id, creator, title, description, category, image_url, option_images,
    options, vote_counts, unit_price_cents, end_time, total_pool_cents,
    creator_investment_cents, platform_fee_cents, creator_reward_cents,
    status, winning_option, total_voters, market_kind, created_at
  ) values (
    p_id, p_poll_id, p_wallet, p_title, p_description, p_category, p_image_url, p_option_images,
    p_options, array_fill(0::bigint, array[array_length(p_options, 1)]),
    p_unit_price_cents, p_end_time, v_pool_seed,
    p_creator_investment_cents, v_platform_fee, v_creator_reward,
    0, 255, 0, p_market_kind, v_now
  );

  select balance into v_user from users where wallet = p_wallet;

  return json_build_object(
    'success', true,
    'new_balance', v_user.balance,
    'platform_fee', v_platform_fee,
    'creator_reward', v_creator_reward,
    'pool_seed', v_pool_seed
  );
end;
$$ language plpgsql security definer;

-- ============================================================
-- 11. Atomic edit_poll — validates ownership & state before editing
-- ============================================================
-- 10b. Admin wallets config table
-- ============================================================
create table if not exists admin_wallets (
  wallet text primary key
);
alter table admin_wallets enable row level security;
drop policy if exists "Anyone can read admin_wallets" on admin_wallets;
create policy "Anyone can read admin_wallets" on admin_wallets for select using (true);
-- Seed with the initial admin wallet
insert into admin_wallets (wallet) values ('62PFLSvnG4Zp8jYS9AFymETvV5e8xBA2JBW2UhjqyNmS')
  on conflict do nothing;

-- ============================================================
-- 11. Atomic edit_poll — validates ownership/admin, updates poll
-- ============================================================
create or replace function edit_poll_atomic(
  p_wallet text,
  p_poll_id text,
  p_title text,
  p_description text,
  p_category text,
  p_image_url text,
  p_option_images text[],
  p_options text[],
  p_end_time bigint
)
returns json as $$
declare
  v_poll record;
  v_total_votes bigint := 0;
  v_is_admin boolean;
  i int;
begin
  -- Check admin status from admin_wallets table
  v_is_admin := EXISTS (SELECT 1 FROM admin_wallets WHERE wallet = p_wallet);

  select * into v_poll from polls where id = p_poll_id for update;
  if not found then
    return json_build_object('success', false, 'error', 'poll_not_found');
  end if;

  -- Non-admin restrictions
  if not v_is_admin then
    if v_poll.creator != p_wallet then
      return json_build_object('success', false, 'error', 'not_creator');
    end if;

    if v_poll.status != 0 then
      return json_build_object('success', false, 'error', 'poll_not_active');
    end if;

    -- Check no votes have been cast
    for i in 1..coalesce(array_length(v_poll.vote_counts, 1), 0) loop
      v_total_votes := v_total_votes + v_poll.vote_counts[i];
    end loop;

    if v_total_votes > 0 then
      return json_build_object('success', false, 'error', 'poll_has_votes');
    end if;
  end if;

  update polls
    set title = p_title,
        description = p_description,
        category = p_category,
        image_url = p_image_url,
        option_images = p_option_images,
        options = p_options,
        end_time = p_end_time
    where id = p_poll_id;

  return json_build_object('success', true);
end;
$$ language plpgsql security definer;

-- ============================================================
-- 12. Atomic delete_poll — validates ownership, refunds balances, deletes poll+votes
-- ============================================================
create or replace function delete_poll_atomic(p_wallet text, p_poll_id text)
returns json as $$
declare
  v_poll record;
  v_total_votes bigint := 0;
  v_vote record;
  v_refund_total bigint := 0;
  v_is_admin boolean := false;
  i int;
begin
  select * into v_poll from polls where id = p_poll_id for update;
  if not found then
    return json_build_object('success', false, 'error', 'poll_not_found');
  end if;

  -- Check if caller is an admin
  select exists(select 1 from admin_wallets where wallet = p_wallet) into v_is_admin;

  -- Only creator or admin can delete
  if v_poll.creator != p_wallet and not v_is_admin then
    return json_build_object('success', false, 'error', 'not_creator');
  end if;

  if v_poll.status != 0 then
    return json_build_object('success', false, 'error', 'poll_not_active');
  end if;

  for i in 1..coalesce(array_length(v_poll.vote_counts, 1), 0) loop
    v_total_votes := v_total_votes + v_poll.vote_counts[i];
  end loop;

  -- Non-admin creators cannot delete polls with votes
  if v_total_votes > 0 and not v_is_admin then
    return json_build_object('success', false, 'error', 'poll_has_votes');
  end if;

  -- Refund all voters if poll has votes (admin force-delete)
  if v_total_votes > 0 then
    for v_vote in select * from votes where poll_id = p_poll_id loop
      update users
        set balance = balance + v_vote.total_staked_cents
        where wallet = v_vote.voter;
      v_refund_total := v_refund_total + v_vote.total_staked_cents;
    end loop;
  end if;

  -- Refund creator investment
  update users
    set balance = balance + v_poll.creator_investment_cents,
        total_spent_cents = greatest(0, total_spent_cents - v_poll.creator_investment_cents),
        polls_created = greatest(0, polls_created - 1)
    where wallet = v_poll.creator;

  -- Delete votes (cascade would handle this, but be explicit)
  delete from votes where poll_id = p_poll_id;

  -- Delete poll
  delete from polls where id = p_poll_id;

  return json_build_object('success', true, 'refund', v_poll.creator_investment_cents, 'voter_refund', v_refund_total);
end;
$$ language plpgsql security definer;

-- ============================================================
-- 13. Atomic insert_comment — rate-limited, sanitized comment insert
-- ============================================================
create or replace function insert_comment_atomic(
  p_wallet text,
  p_poll_id text,
  p_text text
)
returns json as $$
declare
  v_poll record;
  v_last_comment timestamptz;
  v_comment_id uuid;
begin
  -- Validate poll exists
  select * into v_poll from polls where id = p_poll_id;
  if not found then
    return json_build_object('success', false, 'error', 'poll_not_found');
  end if;

  -- Validate text length
  if char_length(p_text) < 1 or char_length(p_text) > 500 then
    return json_build_object('success', false, 'error', 'invalid_comment_length');
  end if;

  -- Server-side rate limiting: 1 comment per 30 seconds per user per poll
  select max(created_at) into v_last_comment
    from comments
    where wallet = p_wallet and poll_id = p_poll_id;

  if v_last_comment is not null and (now() - v_last_comment) < interval '30 seconds' then
    return json_build_object('success', false, 'error', 'rate_limited');
  end if;

  insert into comments (poll_id, wallet, text)
    values (p_poll_id, p_wallet, p_text)
    returning id into v_comment_id;

  return json_build_object('success', true, 'id', v_comment_id);
end;
$$ language plpgsql security definer;

-- ============================================================
-- 14. Atomic insert_referral
-- ============================================================
create or replace function insert_referral_atomic(
  p_referrer text,
  p_referee text
)
returns json as $$
begin
  if p_referrer = p_referee then
    return json_build_object('success', false, 'error', 'self_referral');
  end if;

  insert into referrals (referrer, referee, created_at)
    values (p_referrer, p_referee, (extract(epoch from now()) * 1000)::bigint)
    on conflict (referee) do nothing;

  return json_build_object('success', true);
end;
$$ language plpgsql security definer;

-- ============================================================
-- 15. Atomic upsert_resolution_proof
-- ============================================================
create or replace function upsert_resolution_proof_atomic(
  p_poll_id text,
  p_source_url text
)
returns json as $$
begin
  insert into resolution_proofs (poll_id, source_url)
    values (p_poll_id, p_source_url)
    on conflict (poll_id) do update set source_url = excluded.source_url;

  return json_build_object('success', true);
end;
$$ language plpgsql security definer;

-- ============================================================
-- 16. User Profiles table (display names + avatars)
-- ============================================================
create table if not exists user_profiles (
  wallet text primary key,
  display_name text not null default '',
  avatar_url text not null default '',
  created_at bigint not null default 0
);

-- RLS
alter table user_profiles enable row level security;

drop policy if exists "Anyone can read user_profiles" on user_profiles;
create policy "Anyone can read user_profiles"
  on user_profiles for select using (true);

-- No direct writes — use RPC below

-- Realtime
alter table user_profiles replica identity full;
do $$ begin
  alter publication supabase_realtime add table user_profiles;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 17. Atomic upsert_user_profile
-- ============================================================
create or replace function upsert_user_profile_atomic(
  p_wallet text,
  p_display_name text,
  p_avatar_url text
)
returns json as $$
declare
  v_now bigint;
begin
  v_now := (extract(epoch from now()) * 1000)::bigint;

  insert into user_profiles (wallet, display_name, avatar_url, created_at)
    values (p_wallet, p_display_name, p_avatar_url, v_now)
    on conflict (wallet) do update
      set display_name = excluded.display_name,
          avatar_url   = excluded.avatar_url;

  return json_build_object('success', true);
end;
$$ language plpgsql security definer;

-- ============================================================
-- 18. Performance Indexes
-- ============================================================
-- These indexes speed up common query patterns used by the app.
create index if not exists idx_votes_voter on votes(voter);
create index if not exists idx_votes_poll_id on votes(poll_id);
create index if not exists idx_polls_creator on polls(creator);
create index if not exists idx_polls_status on polls(status);
create index if not exists idx_polls_created_at on polls(created_at desc);
create index if not exists idx_comments_poll_id on comments(poll_id);

-- Leaderboard indexes for fast ORDER BY queries
create index if not exists idx_users_total_winnings on users(total_winnings_cents desc);
create index if not exists idx_users_weekly_winnings on users(weekly_winnings_cents desc);
create index if not exists idx_users_monthly_winnings on users(monthly_winnings_cents desc);
create index if not exists idx_users_polls_won on users(polls_won desc);
create index if not exists idx_users_total_votes on users(total_votes_cast desc);
create index if not exists idx_users_creator_earnings on users(creator_earnings_cents desc);

-- ============================================================
-- TODO: Weekly/Monthly Reset Cron Job
-- ============================================================
-- The users table has weekly_reset_ts, monthly_reset_ts, weekly_winnings_cents,
-- monthly_winnings_cents, weekly_spent_cents, and monthly_spent_cents columns.
-- These are currently only reset client-side via withFreshPeriods() in dataConverters.ts.
--
-- For accurate leaderboards, set up a Supabase Edge Function cron job or pg_cron:
--
-- Weekly (every Monday at 00:00 UTC):
--   UPDATE users SET weekly_winnings_cents = 0, weekly_spent_cents = 0,
--     weekly_reset_ts = (extract(epoch from now()) * 1000)::bigint
--     WHERE weekly_reset_ts < (extract(epoch from now()) * 1000)::bigint - 604800000;
--
-- Monthly (1st of each month at 00:00 UTC):
--   UPDATE users SET monthly_winnings_cents = 0, monthly_spent_cents = 0,
--     monthly_reset_ts = (extract(epoch from now()) * 1000)::bigint
--     WHERE monthly_reset_ts < (extract(epoch from now()) * 1000)::bigint - 2592000000;

-- ============================================================
-- >>> 002_rls.sql
-- ============================================================

-- ====================================================================
-- InstinctFi — Supabase Row-Level Security (RLS) Migration
-- ====================================================================
-- Run this in your Supabase Dashboard → SQL Editor
-- This enables RLS on all tables and creates policies for secure access.
--
-- IMPORTANT: After running this, anonymous/public reads are still allowed,
-- but writes require the wallet address in the request JWT metadata.
-- ====================================================================

-- ── 1. Enable RLS on all tables ─────────────────────────────────────

ALTER TABLE IF EXISTS polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS poll_images ENABLE ROW LEVEL SECURITY;

-- ── 2. Polls ────────────────────────────────────────────────────────

-- Idempotency: drop this file's policies first so re-runs never collide.
DROP POLICY IF EXISTS "polls_select_all" ON polls;
DROP POLICY IF EXISTS "polls_insert_auth" ON polls;
DROP POLICY IF EXISTS "polls_update_owner" ON polls;
DROP POLICY IF EXISTS "polls_delete_owner" ON polls;
DROP POLICY IF EXISTS "votes_select_all" ON votes;
DROP POLICY IF EXISTS "votes_insert_own" ON votes;
DROP POLICY IF EXISTS "votes_update_own" ON votes;
DROP POLICY IF EXISTS "comments_select_all" ON comments;
DROP POLICY IF EXISTS "comments_insert_auth" ON comments;
DROP POLICY IF EXISTS "comments_delete_own" ON comments;
DROP POLICY IF EXISTS "users_select_all" ON users;
DROP POLICY IF EXISTS "users_insert_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;

-- Anyone can read polls
CREATE POLICY "polls_select_all" ON polls
  FOR SELECT USING (true);

-- BUG-14 FIX: Require authenticated JWT with wallet claim for inserts.
-- All production writes go through SECURITY DEFINER RPCs (which bypass RLS),
-- so these policies are defense-in-depth against direct anon table access.
CREATE POLICY "polls_insert_auth" ON polls
  FOR INSERT WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'wallet' IS NOT NULL
  );

-- Only the poll creator or an admin can update their polls.
-- Admins come from the admin_wallets table (single source of truth) instead
-- of a hardcoded pubkey that goes stale when the admin rotates.
CREATE POLICY "polls_update_owner" ON polls
  FOR UPDATE USING (
    creator = current_setting('request.jwt.claims', true)::json->>'wallet'
    OR current_setting('request.jwt.claims', true)::json->>'wallet' IN (
      SELECT wallet FROM admin_wallets
    )
  );

-- Only the poll creator or an admin can delete their polls
CREATE POLICY "polls_delete_owner" ON polls
  FOR DELETE USING (
    creator = current_setting('request.jwt.claims', true)::json->>'wallet'
    OR current_setting('request.jwt.claims', true)::json->>'wallet' IN (
      SELECT wallet FROM admin_wallets
    )
  );

-- ── 3. Votes ────────────────────────────────────────────────────────

-- Anyone can read votes (needed for vote counts, leaderboard)
CREATE POLICY "votes_select_all" ON votes
  FOR SELECT USING (true);

-- BUG-14 FIX: Require authenticated JWT with wallet claim.
CREATE POLICY "votes_insert_own" ON votes
  FOR INSERT WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'wallet' IS NOT NULL
  );

-- Only the voter can update their own vote record (for claiming)
CREATE POLICY "votes_update_own" ON votes
  FOR UPDATE USING (
    voter = current_setting('request.jwt.claims', true)::json->>'wallet'
  );

-- ── 4. Comments ─────────────────────────────────────────────────────

-- Anyone can read comments
CREATE POLICY "comments_select_all" ON comments
  FOR SELECT USING (true);

-- BUG-14 FIX: Require authenticated JWT with wallet claim.
CREATE POLICY "comments_insert_auth" ON comments
  FOR INSERT WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'wallet' IS NOT NULL
  );

-- Only the comment author can delete their own comments
CREATE POLICY "comments_delete_own" ON comments
  FOR DELETE USING (
    wallet = current_setting('request.jwt.claims', true)::json->>'wallet'
  );

-- ── 5. Users ────────────────────────────────────────────────────────

-- Anyone can read user profiles (needed for leaderboard)
CREATE POLICY "users_select_all" ON users
  FOR SELECT USING (true);

-- BUG-14 FIX: Require authenticated JWT with wallet claim.
CREATE POLICY "users_insert_own" ON users
  FOR INSERT WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'wallet' IS NOT NULL
  );

-- Only the user can update their own profile
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (
    wallet = current_setting('request.jwt.claims', true)::json->>'wallet'
  );

-- ── 6. Push Subscriptions (legacy) ──────────────────────────────────
-- The push_subscriptions table only exists in older projects (the app no
-- longer references it). Policies are applied conditionally so this file
-- runs cleanly on a fresh database.
DO $$
BEGIN
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "push_subs_select_own" ON push_subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "push_subs_insert_own" ON push_subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "push_subs_delete_own" ON push_subscriptions';
    -- Users can only read their own push subscriptions
    EXECUTE 'CREATE POLICY "push_subs_select_own" ON push_subscriptions
      FOR SELECT USING (
        wallet = current_setting(''request.jwt.claims'', true)::json->>''wallet''
      )';
    -- BUG-14 FIX: Require authenticated JWT with wallet claim.
    EXECUTE 'CREATE POLICY "push_subs_insert_own" ON push_subscriptions
      FOR INSERT WITH CHECK (
        current_setting(''request.jwt.claims'', true)::json->>''wallet'' IS NOT NULL
      )';
    -- Users can delete their own push subscriptions
    EXECUTE 'CREATE POLICY "push_subs_delete_own" ON push_subscriptions
      FOR DELETE USING (
        wallet = current_setting(''request.jwt.claims'', true)::json->>''wallet''
      )';
  END IF;
END $$;

-- ── 7. Poll Images (legacy) ─────────────────────────────────────────
-- Poll images now live in the poll-images storage bucket; the poll_images
-- table only exists in older projects. Conditional for fresh databases.
DO $$
BEGIN
  IF to_regclass('public.poll_images') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "poll_images_select_all" ON poll_images';
    EXECUTE 'DROP POLICY IF EXISTS "poll_images_insert_auth" ON poll_images';
    -- Anyone can read poll images
    EXECUTE 'CREATE POLICY "poll_images_select_all" ON poll_images
      FOR SELECT USING (true)';
    -- BUG-14 FIX: Require authenticated JWT with wallet claim.
    EXECUTE 'CREATE POLICY "poll_images_insert_auth" ON poll_images
      FOR INSERT WITH CHECK (
        current_setting(''request.jwt.claims'', true)::json->>''wallet'' IS NOT NULL
      )';
  END IF;
END $$;

-- ============================================================
-- >>> 003_revoked_tokens.sql
-- ============================================================

-- ============================================================
-- S-08 FIX: JWT revocation table
-- Run this migration in Supabase SQL Editor.
-- ============================================================

-- Stores revoked JWT IDs (jti) so tokens can be invalidated
-- before their natural expiration (e.g. on logout, password change).
create table if not exists revoked_tokens (
    jti text primary key,
    wallet text not null,
    revoked_at timestamptz not null default now(),
    expires_at timestamptz not null  -- auto-cleanup: delete after JWT would have expired anyway
);

-- Index for fast lookup during JWT verification
create index if not exists idx_revoked_tokens_jti on revoked_tokens(jti);

-- Index for cleanup job
create index if not exists idx_revoked_tokens_expires_at on revoked_tokens(expires_at);

-- RLS: No direct client access. Only service role (via SECURITY DEFINER RPCs) can read/write.
alter table revoked_tokens enable row level security;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon — all access via service role.

-- ── Cleanup function: removes expired entries (call via pg_cron or manually) ──
create or replace function cleanup_revoked_tokens()
returns void
language plpgsql
security definer
as $$
begin
    delete from revoked_tokens where expires_at < now();
end;
$$;

-- Optional: Schedule cleanup every hour (requires pg_cron extension)
-- select cron.schedule('cleanup-revoked-tokens', '0 * * * *', 'select cleanup_revoked_tokens()');

-- ============================================================
-- >>> 004_comment_reactions.sql
-- ============================================================

-- ─── Comment Reactions Schema ───────────────────────────────────────────────
-- Allows users to react to comments with emoji (👍, 🔥, 🧠).
-- One reaction per user per emoji per comment.

CREATE TABLE IF NOT EXISTS comment_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  emoji TEXT NOT NULL CHECK (emoji IN ('👍', '🔥', '🧠')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (comment_id, wallet, emoji)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_reactions_comment_id ON comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_reactions_wallet ON comment_reactions(wallet);

-- RLS policies
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read reactions" ON comment_reactions;
CREATE POLICY "Anyone can read reactions"
  ON comment_reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert reactions" ON comment_reactions;
CREATE POLICY "Authenticated users can insert reactions"
  ON comment_reactions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete own reactions" ON comment_reactions;
CREATE POLICY "Users can delete own reactions"
  ON comment_reactions FOR DELETE USING (true);

-- ─── Toggle reaction RPC ────────────────────────────────────────────────────
-- Inserts if not exists, deletes if exists (toggle behavior)
CREATE OR REPLACE FUNCTION toggle_reaction(
  p_comment_id UUID,
  p_wallet TEXT,
  p_emoji TEXT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  existing_id UUID;
  result JSON;
BEGIN
  -- Check if reaction exists
  SELECT id INTO existing_id
  FROM comment_reactions
  WHERE comment_id = p_comment_id AND wallet = p_wallet AND emoji = p_emoji;

  IF existing_id IS NOT NULL THEN
    -- Remove reaction
    DELETE FROM comment_reactions WHERE id = existing_id;
    result := json_build_object('action', 'removed', 'emoji', p_emoji);
  ELSE
    -- Add reaction
    INSERT INTO comment_reactions (comment_id, wallet, emoji)
    VALUES (p_comment_id, p_wallet, p_emoji);
    result := json_build_object('action', 'added', 'emoji', p_emoji);
  END IF;

  RETURN result;
END;
$$;

-- ─── Get reaction counts for a set of comments ─────────────────────────────
CREATE OR REPLACE FUNCTION get_reaction_counts(p_comment_ids UUID[])
RETURNS TABLE (
  comment_id UUID,
  emoji TEXT,
  count BIGINT
) LANGUAGE SQL STABLE AS $$
  SELECT cr.comment_id, cr.emoji, COUNT(*) as count
  FROM comment_reactions cr
  WHERE cr.comment_id = ANY(p_comment_ids)
  GROUP BY cr.comment_id, cr.emoji;
$$;

-- ─── Streak columns for users ───────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_streak INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_date DATE;

-- ============================================================
-- >>> 005_fan_matchday.sql
-- ============================================================

-- Whistly Matchday — Consumer & Fan Experiences schema
-- Apply once in Supabase SQL Editor. Server writes use the service-role client;
-- public clients receive read-only access through RLS.

create table if not exists fan_profiles (
  wallet text primary key,
  display_name text not null check (char_length(display_name) between 1 and 32),
  favorite_team text not null default '',
  avatar_seed text not null default '',
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists fan_rooms (
  id uuid primary key,
  invite_code text not null unique,
  creator_wallet text not null,
  fixture_id text not null,
  name text not null check (char_length(name) between 1 and 48),
  visibility text not null check (visibility in ('PRIVATE','PUBLIC')),
  status text not null check (status in ('OPEN','CLOSED')),
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists fan_room_members (
  room_id uuid not null references fan_rooms(id) on delete cascade,
  wallet text not null,
  display_name text not null check (char_length(display_name) between 1 and 32),
  role text not null check (role in ('OWNER','MEMBER')),
  joined_at bigint not null,
  primary key (room_id, wallet)
);

create table if not exists fan_challenges (
  id text primary key,
  fixture_id text not null,
  challenge_type text not null check (challenge_type in ('GOAL_WINDOW')),
  duration_minutes smallint not null check (duration_minutes in (5,15,45)),
  start_ts bigint not null,
  end_ts bigint not null check (end_ts > start_ts),
  start_clock_seconds integer not null default 0,
  start_home_score smallint not null check (start_home_score >= 0),
  start_away_score smallint not null check (start_away_score >= 0),
  end_home_score smallint,
  end_away_score smallint,
  status text not null check (status in ('SCHEDULED','OPEN','LOCKED','RESOLVING','RESOLVED','VOID','CANCELLED')),
  winning_outcome smallint check (winning_outcome in (0,1)),
  resolution_source text not null check (resolution_source in ('txline','mock','replay')),
  resolved_at bigint,
  created_at bigint not null,
  unique (fixture_id, challenge_type, duration_minutes, start_ts)
);

create table if not exists fan_predictions (
  id text primary key,
  challenge_id text not null references fan_challenges(id) on delete cascade,
  wallet text not null,
  selected_outcome smallint not null check (selected_outcome in (0,1)),
  submitted_at bigint not null,
  correct boolean,
  base_points integer not null default 0,
  streak_multiplier_bps integer not null default 10000,
  awarded_points integer not null default 0,
  scored_at bigint,
  unique (challenge_id, wallet)
);

create table if not exists fan_room_scores (
  room_id uuid not null references fan_rooms(id) on delete cascade,
  wallet text not null,
  display_name text not null,
  total_points integer not null default 0,
  correct_predictions integer not null default 0,
  total_predictions integer not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  updated_at bigint not null,
  primary key (room_id, wallet)
);

create table if not exists fan_reactions (
  id uuid primary key,
  fixture_id text not null,
  wallet text not null,
  reaction_type text not null check (reaction_type in ('GOAL','SHOCK','APPLAUSE','FRUSTRATION','SUPPORT')),
  created_at bigint not null
);

create index if not exists fan_challenges_fixture_idx on fan_challenges(fixture_id, end_ts desc);
create index if not exists fan_predictions_wallet_idx on fan_predictions(wallet, submitted_at desc);
create index if not exists fan_rooms_fixture_idx on fan_rooms(fixture_id, created_at desc);
create index if not exists fan_reactions_fixture_idx on fan_reactions(fixture_id, created_at desc);
create index if not exists fan_room_scores_rank_idx on fan_room_scores(room_id, total_points desc, correct_predictions desc);

alter table fan_profiles enable row level security;
alter table fan_rooms enable row level security;
alter table fan_room_members enable row level security;
alter table fan_challenges enable row level security;
alter table fan_predictions enable row level security;
alter table fan_room_scores enable row level security;
alter table fan_reactions enable row level security;

drop policy if exists "fan profiles public read" on fan_profiles;
drop policy if exists "fan rooms public read" on fan_rooms;
drop policy if exists "fan room members public read" on fan_room_members;
drop policy if exists "fan challenges public read" on fan_challenges;
drop policy if exists "fan predictions public aggregate read" on fan_predictions;
drop policy if exists "fan room scores public read" on fan_room_scores;
drop policy if exists "fan reactions public read" on fan_reactions;
drop policy if exists "fan profiles deny anon" on fan_profiles;
drop policy if exists "fan room members deny anon" on fan_room_members;
drop policy if exists "fan predictions deny anon" on fan_predictions;

-- Profiles, membership rosters and individual picks stay server-only. Public
-- Matchday reads flow through validated API routes; the service role bypasses RLS.
create policy "fan profiles deny anon" on fan_profiles for select using (false);
create policy "fan room members deny anon" on fan_room_members for select using (false);
create policy "fan predictions deny anon" on fan_predictions for select using (false);
create policy "fan rooms public read" on fan_rooms for select using (true);
create policy "fan challenges public read" on fan_challenges for select using (true);
create policy "fan room scores public read" on fan_room_scores for select using (true);
create policy "fan reactions public read" on fan_reactions for select using (true);

-- Atomic resolution and scoring. Repeated calls become no-ops after the first
-- committed RESOLVED transition, preventing double awards.
create or replace function fan_resolve_challenge_atomic(
  p_challenge_id text,
  p_winning_outcome smallint,
  p_end_home_score smallint,
  p_end_away_score smallint,
  p_resolved_at bigint
) returns json as $$
declare
  v_challenge fan_challenges%rowtype;
  v_prediction fan_predictions%rowtype;
  v_member fan_room_members%rowtype;
  v_score fan_room_scores%rowtype;
  v_correct boolean;
  v_next_streak integer;
  v_multiplier integer;
  v_points integer;
begin
  select * into v_challenge from fan_challenges where id = p_challenge_id for update;
  if not found then return json_build_object('success', false, 'error', 'challenge_not_found'); end if;
  if v_challenge.status = 'RESOLVED' then return json_build_object('success', true, 'already_resolved', true); end if;
  if v_challenge.status in ('VOID','CANCELLED') then return json_build_object('success', false, 'error', 'challenge_terminal'); end if;

  update fan_challenges set
    status = 'RESOLVED', winning_outcome = p_winning_outcome,
    end_home_score = p_end_home_score, end_away_score = p_end_away_score,
    resolved_at = p_resolved_at
  where id = p_challenge_id;

  for v_prediction in
    select * from fan_predictions where challenge_id = p_challenge_id and scored_at is null for update
  loop
    v_correct := v_prediction.selected_outcome = p_winning_outcome;

    for v_member in
      select m.* from fan_room_members m
      join fan_rooms r on r.id = m.room_id
      where m.wallet = v_prediction.wallet and r.fixture_id = v_challenge.fixture_id
    loop
      insert into fan_room_scores(room_id, wallet, display_name, updated_at)
        values(v_member.room_id, v_member.wallet, v_member.display_name, p_resolved_at)
        on conflict(room_id, wallet) do nothing;

      select * into v_score from fan_room_scores
        where room_id = v_member.room_id and wallet = v_member.wallet for update;

      if v_correct then
        v_next_streak := v_score.current_streak + 1;
        v_multiplier := case
          when v_next_streak >= 5 then 15000
          when v_next_streak = 4 then 13000
          when v_next_streak = 3 then 12000
          when v_next_streak = 2 then 11000
          else 10000 end;
        v_points := (100 * v_multiplier) / 10000;
      else
        v_next_streak := 0;
        v_multiplier := 10000;
        v_points := 0;
      end if;

      update fan_room_scores set
        total_points = total_points + v_points,
        correct_predictions = correct_predictions + case when v_correct then 1 else 0 end,
        total_predictions = total_predictions + 1,
        current_streak = v_next_streak,
        longest_streak = greatest(longest_streak, v_next_streak),
        updated_at = p_resolved_at
      where room_id = v_member.room_id and wallet = v_member.wallet;
    end loop;

    -- Prediction-level score uses the strongest current room streak. This is
    -- presentation metadata; authoritative room totals are stored above.
    select coalesce(max(s.current_streak), case when v_correct then 1 else 0 end)
      into v_next_streak from fan_room_scores s
      join fan_rooms r on r.id = s.room_id
      where s.wallet = v_prediction.wallet and r.fixture_id = v_challenge.fixture_id;
    v_multiplier := case
      when v_next_streak >= 5 then 15000
      when v_next_streak = 4 then 13000
      when v_next_streak = 3 then 12000
      when v_next_streak = 2 then 11000
      else 10000 end;
    v_points := case when v_correct then (100 * v_multiplier) / 10000 else 0 end;

    update fan_predictions set
      correct = v_correct,
      base_points = case when v_correct then 100 else 0 end,
      streak_multiplier_bps = v_multiplier,
      awarded_points = v_points,
      scored_at = p_resolved_at
    where id = v_prediction.id;
  end loop;

  return json_build_object('success', true);
end;
$$ language plpgsql security definer;

alter table fan_challenges replica identity full;
alter table fan_room_scores replica identity full;
alter table fan_reactions replica identity full;

do $$ begin
  alter publication supabase_realtime add table fan_challenges;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table fan_room_scores;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table fan_reactions;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- >>> 006_v2_clob.sql
-- ============================================================

-- ─── Whistly V2 CLOB schema ────────────────────────────────────────────────
-- Off-chain order book + fill mirror for the V2 share-trading protocol.
-- The chain is the source of truth for balances/positions/fills; these
-- tables index signed order intents and settled fills for fast reads.
-- All prices are probability basis points (100 = 1%); quantities are
-- shares; lamports columns are devnet lamports, never USD.

-- Signed order intents (the order book).
create table if not exists v2_orders (
  -- sha256 of the canonical signed payload, hex
  order_hash text primary key,
  protocol_version int not null default 2,
  market text not null,             -- MarketV2 PDA base58
  market_id bigint not null,
  outcome_index int not null,
  maker text not null,              -- wallet base58
  side text not null check (side in ('BUY','SELL')),
  order_type text not null check (order_type in ('LIMIT','MARKET')),
  price_bps int not null check (price_bps between 100 and 9900),
  quantity bigint not null check (quantity > 0),
  -- BUY: max collateral lamports = price*qty*100; SELL: shares locked
  locked_amount bigint not null,
  nonce bigint not null,
  expiry bigint not null,           -- unix seconds
  tif text not null check (tif in ('GTC','GTD','FOK','FAK')),
  filled_quantity bigint not null default 0,
  status text not null default 'open' check (status in
    ('open','partially_filled','filled','cancelled','expired','rejected')),
  reject_reason text,
  payload_hex text not null,        -- exact signed bytes
  signature_hex text not null,      -- ed25519 signature over payload
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (maker, nonce)             -- replay/duplicate-nonce defense
);

create index if not exists v2_orders_book_idx
  on v2_orders (market, outcome_index, side, status, price_bps);
create index if not exists v2_orders_maker_idx on v2_orders (maker, status);

-- Settled fills (each row has a devnet transaction signature).
create table if not exists v2_fills (
  id bigint generated always as identity primary key,
  market text not null,
  fill_seq bigint,                  -- MarketV2.fill_count at settlement
  mode text not null check (mode in ('TRANSFER','MINT','BURN')),
  maker_order_hash text not null references v2_orders(order_hash),
  taker_order_hash text not null references v2_orders(order_hash),
  maker text not null,
  taker text not null,
  outcome_index int not null,       -- maker-side outcome
  price_bps int not null,           -- execution price (maker outcome)
  quantity bigint not null,
  notional_lamports bigint not null,
  fee_lamports bigint not null,
  tx_signature text not null unique,-- verifiable devnet settlement tx
  created_at timestamptz not null default now()
);

create index if not exists v2_fills_market_idx on v2_fills (market, created_at);
create index if not exists v2_fills_wallet_idx on v2_fills (maker, taker);

-- Activity feed (orders posted/cancelled, fills, settlements, redemptions).
create table if not exists v2_activity (
  id bigint generated always as identity primary key,
  kind text not null check (kind in
    ('order_posted','order_cancelled','order_expired','fill','partial_fill',
     'market_created','market_settled','market_voided','redeemed')),
  market text,
  wallet text,
  outcome_index int,
  side text,
  price_bps int,
  quantity bigint,
  lamports bigint,
  tx_signature text,
  created_at timestamptz not null default now()
);

create index if not exists v2_activity_market_idx on v2_activity (market, created_at desc);
create index if not exists v2_activity_wallet_idx on v2_activity (wallet, created_at desc);

-- RLS: anon may read, writes only via service role (API routes).
alter table v2_orders enable row level security;
alter table v2_fills enable row level security;
alter table v2_activity enable row level security;

drop policy if exists v2_orders_read on v2_orders;
create policy v2_orders_read on v2_orders for select using (true);
drop policy if exists v2_fills_read on v2_fills;
create policy v2_fills_read on v2_fills for select using (true);
drop policy if exists v2_activity_read on v2_activity;
create policy v2_activity_read on v2_activity for select using (true);

-- ============================================================
-- >>> 007_referral_code.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Referral code column migration
--
-- Replaces the full-table scan in /api/referral/resolve (which loaded up to
-- 1000 wallets per request and silently broke past 1000 users) with an
-- indexed column computed at insert time.
--
-- The code algorithm MUST match walletToCode in the app (DJB2 → base36,
-- left-padded to 8 chars): see app/src/app/api/referral/resolve/route.ts
-- and src/components/referrals.tsx.
--
-- Run in the Supabase SQL editor after supabase-schema.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- DJB2 hash (32-bit unsigned) → base36, padded to 8 chars.
create or replace function wallet_to_referral_code(w text)
returns text
language plpgsql
immutable
as $$
declare
    hash bigint := 5381;
    i int;
    n bigint;
    digits constant text := '0123456789abcdefghijklmnopqrstuvwxyz';
    result text := '';
begin
    for i in 1..length(w) loop
        -- hash = ((hash << 5) + hash + charCode) >>> 0
        hash := ((hash * 33) + ascii(substr(w, i, 1))) % 4294967296;
    end loop;

    n := hash;
    if n = 0 then
        result := '0';
    else
        while n > 0 loop
            result := substr(digits, (n % 36)::int + 1, 1) || result;
            n := n / 36;
        end loop;
    end if;

    -- Matches JS: hash.toString(36).padStart(8, "0").slice(0, 8)
    return left(lpad(result, 8, '0'), 8);
end;
$$;

-- Column + backfill + index
alter table users add column if not exists referral_code text;

update users
set referral_code = wallet_to_referral_code(wallet)
where referral_code is null;

create index if not exists idx_users_referral_code on users (referral_code);

-- Keep the column populated for new signups.
create or replace function set_referral_code()
returns trigger
language plpgsql
as $$
begin
    if new.referral_code is null then
        new.referral_code := wallet_to_referral_code(new.wallet);
    end if;
    return new;
end;
$$;

drop trigger if exists trg_set_referral_code on users;
create trigger trg_set_referral_code
    before insert on users
    for each row
    execute function set_referral_code();

-- ============================================================
-- >>> 008_set_balance_atomic.sql
-- ============================================================

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
