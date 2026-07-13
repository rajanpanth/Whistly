# Whistly — Real Devnet SOL Flow Audit

**Date:** 2026-07-12
**Question:** Does the existing Anchor program truly stake devnet SOL on YES/NO buys and pay winners in SOL on claim?
**Scope:** Read-only audit. No features implemented, no files changed.

---

## TL;DR verdict

**Yes — the core money flow is real on-chain devnet SOL, not a simulation.**

- Buying a position (YES/NO or any option) transfers **real lamports** from the buyer's wallet into a per-poll treasury PDA via `system_program::transfer`, signed by the connected wallet.
- Claiming transfers **real lamports** back from the treasury PDA to the winner, PDA-signed, pro-rata to their share of the winning side.
- The frontend gates every buy/claim behind a **mandatory** wallet-signed transaction to program `J9AqrLZWDXaQfDwtFpC2GG9hBb7SAPxRwVpGs753EgWV` on devnet. Supabase is only a non-blocking stats mirror that runs *after* the chain tx.

**But the automated resolution of YES/NO live-goal markets is NOT fully on-chain/automated:**
- The winning outcome is computed off-chain from a **mock** score feed (`txline`, mock by default).
- Writing that outcome on-chain (`admin_settle_poll`) requires a **manual admin-wallet action**; the resolve API route does not submit it.
- Live-goal market metadata lives in an **in-memory `globalThis` store** that resets on server restart.
- On-chain **poll creation is admin-gated** (`create_poll` requires `creator == platform_config.admin`), so end users cannot create markets on-chain — only the admin can.

So: **staking real SOL on buys = real. Paying winners real SOL on claim = real. End-to-end automated YES/NO settlement from a live data feed = missing / manual + mock.**

---

## What is REAL (verified on-chain)

### 1. Staking SOL on a buy (`cast_vote`) — REAL
`programs/instinctfi/src/instructions/cast_vote.rs:44-54`
```rust
// ── Transfer real SOL from voter → treasury PDA ──
system_program::transfer(
    CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer { from: voter, to: treasury },
    ),
    cost,   // = num_coins × unit_price (lamports)
)?;
```
- Cost is `num_coins × unit_price` in lamports, checked for overflow.
- Funds land in the treasury PDA `["treasury", poll_pubkey]`.
- Poll pool, per-voter `VoteAccount`, and user stats are updated after the transfer.
- Guards: platform not paused, poll active, before `end_time`, valid option, `0 < num_coins ≤ 1000`, creator cannot buy their own market.

### 2. Paying winners SOL on claim (`claim_reward`) — REAL
`programs/instinctfi/src/instructions/claim_reward.rs:41-71`
```rust
let reward = user_winning_votes × total_pool / total_winning_votes;   // u128 math
// ── Transfer real SOL from treasury → claimer (PDA-signed) ──
system_program::transfer(
    CpiContext::new_with_signer(system_program, Transfer { from: treasury, to: claimer }, signer_seeds),
    reward,
)?;
```
- Pari-mutuel: each winner gets their proportional share of `total_pool`.
- Preserves the treasury's rent-exempt minimum before paying (`claim_reward.rs:47-55`).
- Marks `VoteAccount.claimed = true` and closes the vote account back to the claimer.
- Integer-division dust is a known residual, recoverable via `sweep_dust`.

### 3. Declaring the real-world winner (`admin_settle_poll`) — REAL (admin only)
`programs/instinctfi/src/instructions/admin_settle_poll.rs`
- Polymarket-style: admin passes the actual `winning_option` (0 = NO, 1 = YES for live-goal), regardless of vote counts.
- On settle: pays creator `2%` of pool (`CREATOR_POOL_REWARD_BPS = 200`), reserves `3%` platform fee (`PLATFORM_POOL_FEE_BPS = 300`, stays in treasury), and sets `total_pool = distributable` (95%) so `claim_reward` splits only the winners' share.
- Gated by `admin.key() == platform_config.admin`.

### 4. Poll creation fee (`create_poll`) — REAL
`programs/instinctfi/src/instructions/create_poll.rs:88-98` — flat `POLL_CREATION_FEE = 0.5 SOL` transferred creator → treasury. **Note:** `create_poll.rs:46-50` requires `creator == platform_config.admin`, so only the admin wallet can create polls on-chain.

### 5. Frontend wiring — REAL, mandatory, wallet-signed
- `app/src/lib/program.base.ts:14-29` — hardcoded `PROGRAM_ID = J9AqrLZWDXaQfDwtFpC2GG9hBb7SAPxRwVpGs753EgWV`, `PROGRAM_DEPLOYED = true`, `CLUSTER = "devnet"`, `Connection(clusterApiUrl("devnet"))`.
- `app/src/lib/program.onchain.ts` — hand-rolled Borsh + instruction builders. `buildCastVoteIx` (`:478`) and `buildClaimRewardIx` (`:575`) produce account lists that **exactly match** the Rust `#[derive(Accounts)]` ordering (voter/user/poll/treasury/vote/platform_config/system_program). No Anchor TS dep and **no bundled IDL** — discriminators are recomputed as SHA-256 of `global:<ix>`.
- `app/src/lib/program.ts:82-111` — `sendTransaction` sets blockhash + feePayer, calls the wallet's `signTransaction`, and `connection.sendRawTransaction`. Real signing, real submit.
- `app/src/lib/hooks/usePollOperations.ts`:
  - `castVote` (`:781`) — builds `cast_vote` ix (+ `initialize_user` if first time) and `sendTransaction(...)` is labeled **"On-chain transaction (MANDATORY — real SOL)"** (`:844-845`). Supabase `/api/rpc/cast-vote` fires afterward, non-awaited, "sync failed (on-chain succeeded)" fallback (`:847-854`).
  - `claimReward` (`~:1106`) — same shape: on-chain claim first, DB sync after.
  - `settlePoll` (`~:1000-1010`) — admin wallet → `buildAdminSettlePollIx`; non-admin → `buildSettlePollIx` (7-day grace fallback). Settlement **awaits** on-chain confirmation before declaring success (`:1018-1022`).
- Wallet stack is real: `@solana/wallet-adapter-*` + `@solana/web3.js ^1.95.0` (no `@coral-xyz/anchor`). Auth = wallet `signMessage` → JWT (`app/src/lib/hooks/useWalletManager.ts`).

### 6. Balance is chain-sourced
`app/src/app/api/rpc/sync-balance/route.ts` — server does `conn.getBalance(pubkey)` against devnet and forces the Supabase `balance` to equal on-chain lamports (comment `CRIT-01: NEVER trust client input`). On-chain is the source of truth; DB balance is a reflection.

---

## What is MISSING / off-chain / not automated

### A. Automated YES/NO resolution is manual + mock, not on-chain-triggered
`app/src/app/api/markets/resolve-live-goal/route.ts`
- Computes `winningOptionIndex` from `fetchTxLineScore(...)` then returns:
  ```
  onchainSettlement.required = !settlementTx
  note: "Outcome prepared. Use the admin wallet flow to write this resolved
         outcome on-chain, then call this route with settlementTx."
  ```
- The route **does not submit** `admin_settle_poll`. A human admin must sign it via the client `settlePoll` flow, then call the route back with the `settlementTx` signature. Until then, winners cannot claim (poll stays `STATUS_ACTIVE` on-chain).

### B. The score feed driving resolution is MOCK by default
`app/src/lib/txline/client.ts:7-9` — `isTxLineMockMode()` returns true unless `TXLINE_BASE_URL` is set **and** `TXLINE_USE_MOCK=false`. Default `fetchTxLineScore` returns `getMockScore(...)`. So YES/NO outcomes are decided by mock football scores, not a real live feed.

### C. Live-goal market metadata is ephemeral in-memory
`app/src/lib/liveGoalMarketStore.ts:16-25` — stored on `globalThis.__instinctfiLiveGoalMarkets` (an array). No DB/persistence: **resets on every server restart/redeploy**. It holds `onchainMarketPubkey` / `onchainPollId` linking to the real on-chain poll, plus fixture/score-window metadata that exists only here.

### D. On-chain market creation is admin-only
`create_poll.rs:46-50` requires `creator == platform_config.admin`. End users cannot create on-chain markets; only the admin can. (User-facing "create" in the app therefore either uses the admin wallet or is DB-only metadata via `sync-poll`.)

### E. Permissionless `settle_poll` only VOIDS
`programs/instinctfi/src/instructions/settle_poll.rs` — after the 7-day admin grace period, anyone can call it, but it sets status = VOIDED (not a winner) and voters reclaim stake via `refund_tied_poll`. It does **not** pay winners. Winner payout requires `admin_settle_poll`.

### F. Trapped funds / partial fee handling
- Creation fee (0.5 SOL) and the 3% platform fee remain locked in the treasury PDA; recoverable only via `sweep_dust`. `create_poll.rs:26-31` still carries a TODO for a dedicated `withdraw_platform_fee` instruction.
- Claim dust from integer division accumulates until swept.

### G. `/api/rpc/*` are pure Supabase RPC (no chain)
All of `cast-vote`, `claim-reward`, `settle-poll`, `create-poll`, `credit-balance`, `sync-balance`, `claim-daily`, `sync-poll` go through `app/src/app/api/rpc/_handler.ts` → `supabase.rpc(<fn>_atomic, ...)`. They are a stats/metadata mirror. `claim-daily` is DB-only with **no** on-chain counterpart (a virtual reward).

---

## Files that control the flow

### On-chain program (`programs/instinctfi/src/`)
| File | Role |
|------|------|
| `lib.rs` | Program entrypoint; declares `declare_id!(J9AqrLZWDXaQfDwtFpC2GG9hBb7SAPxRwVpGs753EgWV)` and all instructions |
| `instructions/cast_vote.rs` | **Stakes real SOL** buyer → treasury PDA on a buy |
| `instructions/claim_reward.rs` | **Pays real SOL** treasury → winner, pro-rata |
| `instructions/admin_settle_poll.rs` | Admin declares real-world winner; sets 95% distributable + pays creator |
| `instructions/settle_poll.rs` | Permissionless VOID after 7-day grace (no winner payout) |
| `instructions/create_poll.rs` | Admin-only poll creation; 0.5 SOL fee → treasury |
| `instructions/refund_tied_poll.rs` | Voter refunds on voided/tied poll |
| `instructions/sweep_dust.rs` | Recovers residual fees/dust to admin |
| `instructions/initialize_platform.rs`, `update_platform_config.rs` | Platform config PDA (admin, pause) |
| `state.rs` | Constants + account layouts. Fees: `POLL_CREATION_FEE=0.5 SOL`, `CREATOR_POOL_REWARD_BPS=200`, `PLATFORM_POOL_FEE_BPS=300`, `MIN_UNIT_PRICE=0.001 SOL`, `MAX_COINS_PER_VOTE=1000`, `ADMIN_SETTLE_GRACE_SECONDS=7d`, market kinds 0=standard/1=live-goal |
| `Anchor.toml` | Cluster = devnet; program id mapping |

### Frontend on-chain layer (`app/src/lib/`)
| File | Role |
|------|------|
| `program.base.ts` | Program id, `PROGRAM_DEPLOYED=true`, devnet connection, PDA derivations, discriminators |
| `program.onchain.ts` | Borsh serializers + all instruction builders + account fetchers (`getProgramAccounts`) |
| `program.ts` | `sendTransaction` (sign + submit), `confirmTransactionBg`, `getWalletBalance`, devnet `requestAirdrop` |
| `hooks/usePollOperations.ts` | Orchestrates buy/claim/create/settle: builds ix, `sendTransaction`, then non-blocking DB sync |
| `hooks/useWalletManager.ts` | Wallet connect + `signMessage` auth |
| `useVote.ts` | UI → `castVote` bridge |
| `components/WalletAdapterProvider.tsx` | Wallet-adapter providers |

### Off-chain / DB / resolution layer
| File | Role |
|------|------|
| `app/src/app/api/rpc/_handler.ts` + `rpc/*/route.ts` | Supabase RPC mirror (stats/metadata cache), **no chain** |
| `app/src/app/api/rpc/sync-balance/route.ts` | Chain → DB balance sync (only chain-aware RPC route) |
| `app/src/app/api/markets/resolve-live-goal/route.ts` | Computes YES/NO outcome; **does not** submit on-chain settlement |
| `app/src/app/api/markets/create-live-goal/route.ts` | Registers live-goal market metadata |
| `app/src/lib/liveGoalMarketStore.ts` | **In-memory** live-goal market registry (ephemeral) |
| `app/src/lib/txline/client.ts` + `txline/mock.ts` | Score feed — **mock by default** |
| `supabase-schema.sql` / `supabase_rls_migration.sql` | Postgres `*_atomic` RPC functions backing the mirror |

---

## Bottom line for the original question

| Claim | Reality |
|-------|---------|
| YES/NO buy stakes real devnet SOL | ✅ Real — `cast_vote` transfers lamports to treasury PDA; frontend makes it mandatory |
| Winner paid in real SOL on claim | ✅ Real — `claim_reward` PDA-signs a lamport transfer to the winner, pro-rata |
| Winner declared automatically from live data | ❌ Manual admin step + mock feed; resolve route only *prepares* the outcome |
| Anyone can create on-chain markets | ❌ `create_poll` is admin-gated |
| Live-goal markets persist | ❌ In-memory store, resets on restart |
| `/api/rpc/*` moves SOL | ❌ Supabase-only stats mirror |

The staking-and-payout core is genuine devnet SOL. The gap is the **end-to-end automated settlement pipeline** (real data feed → automatic on-chain `admin_settle_poll` → persistent market state), which today is manual, mock-fed, and non-persistent.
