# Supabase migrations

Ordered SQL for bootstrapping a **fresh** Supabase project (or patching an
existing one). All files are idempotent (`create ... if not exists` /
`create or replace`), so re-running any of them is safe.

## Fresh-project setup

1. Create the project at [supabase.com/dashboard](https://supabase.com/dashboard)
   (any region; the free tier is fine for devnet).
2. Open **SQL Editor → New query** and run each file **in numeric order**:

   | # | File | What it creates |
   |---|------|-----------------|
   | 1 | `001_schema.sql` | Core tables (`users`, `polls`, `votes`, `comments`, `admin_wallets`, …) and all `*_atomic` RPC functions |
   | 2 | `002_rls.sql` | Row-level-security hardening |
   | 3 | `003_revoked_tokens.sql` | JWT revocation table (logout support) |
   | 4 | `004_comment_reactions.sql` | Emoji reactions (depends on `comments` from 001) |
   | 5 | `005_fan_matchday.sql` | Matchday fan tables (profiles, predictions, rooms, reactions) |
   | 6 | `006_v2_clob.sql` | V2 order-book mirror (`v2_orders`, `v2_fills`, `v2_activity`) |
   | 7 | `007_referral_code.sql` | Indexed `referral_code` column + insert trigger |
   | 8 | `008_set_balance_atomic.sql` | Row-locked balance sync RPC |

3. **Seed your admin wallet.** `001_schema.sql` seeds a legacy placeholder
   admin (`62PF…`). Replace it with your real admin wallet:

   ```sql
   delete from admin_wallets where wallet = '62PFLSvnG4Zp8jYS9AFymETvV5e8xBA2JBW2UhjqyNmS';
   insert into admin_wallets (wallet) values ('<YOUR_ADMIN_WALLET_PUBKEY>')
     on conflict do nothing;
   ```

4. **Storage (poll images):** Storage → New bucket → name `poll-images`,
   set it **Public**. (Uploads go through the app's service-role client.)

5. **Update environment variables** — locally in `app/.env.local` and in
   Vercel (Settings → Environment Variables), from the new project's
   Settings → API page:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<new-project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<new anon key>
   SUPABASE_SERVICE_ROLE_KEY=<new service role key>
   ```

6. Restart the dev server / redeploy. Verify with:

   ```sql
   -- All three should return rows / definitions:
   select wallet from admin_wallets;
   select column_name from information_schema.columns
     where table_name = 'users' and column_name = 'referral_code';
   select proname from pg_proc where proname in
     ('set_balance_atomic', 'cast_vote_atomic', 'wallet_to_referral_code');
   ```

## legacy/

`cents-to-lamports-data-migration.sql` rescaled pre-2026 data from the old
100x "cents" scale to lamports. A fresh database never needs it — new rows
are written at lamport scale already. Kept for historical reference only.
