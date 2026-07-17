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
