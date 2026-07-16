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
