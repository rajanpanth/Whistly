# InstinctFi Live Goal Markets Final Summary

## Files Changed

- `audit-notes/live-goal-markets-plan.md`
- `audit-notes/live-goal-markets-test-plan.md`
- `audit-notes/live-goal-markets-final-summary.md`
- `README.md`
- `programs/instinctfi/src/state.rs`
- `programs/instinctfi/src/instructions/create_poll.rs`
- `app/supabase-schema.sql`
- `app/src/app/live/page.tsx`
- `app/src/app/api/markets/create-live-goal/route.ts`
- `app/src/app/api/markets/resolve-live-goal/route.ts`
- `app/src/app/api/txline/demo/route.ts`
- `app/src/app/api/txline/fixtures/route.ts`
- `app/src/app/api/txline/scores/[fixtureId]/route.ts`
- `app/src/components/Navbar.tsx`
- `app/src/lib/liveGoalMarkets.ts`
- `app/src/lib/liveGoalMarketStore.ts`
- `app/src/lib/__tests__/liveGoalMarkets.test.ts`
- `app/src/lib/txline/auth.ts`
- `app/src/lib/txline/client.ts`
- `app/src/lib/txline/fixtures.ts`
- `app/src/lib/txline/mock.ts`
- `app/src/lib/txline/odds.ts`
- `app/src/lib/txline/resolver.ts`
- `app/src/lib/txline/scores.ts`

## Smart Contract Changes

- Added `MIN_STANDARD_MARKET_DURATION = 3600`.
- Added `MIN_LIVE_GOAL_MARKET_DURATION = 60`.
- Updated `create_poll` so short 60-second markets are allowed only for the live goal market shape:
  - category `World Cup`
  - title contains `Goal in next`
  - outcomes exactly `NO` and `YES`
- Standard markets continue using the 1-hour minimum.
- Existing admin settlement remains the settlement path:
  - NO maps to `winning_option = 0`
  - YES maps to `winning_option = 1`

## Frontend Changes

- Added `/live` with:
  - demo live match
  - 5, 15, and 45 minute market cards
  - stake input
  - create market buttons
  - Buy NO / Buy YES buttons
  - Resolve market action
  - Claim payout action
  - YES-win and NO-win demo controls
- Added desktop and mobile navigation entry for `Live`.
- UI copy uses market/buy position/stake/resolve market/claim payout language on the new page.

## Backend Changes

- Added TxLINE/TxODDS integration layer with mock mode.
- Added mock fixture and score simulation for:
  - base live match
  - YES wins by score increase
  - NO wins with unchanged score
- Added resolver route that resolves from start/end score difference.
- Added in-memory demo metadata store for local/hackathon mode.
- Added Supabase `live_goal_markets` table definition for hosted metadata.

## How To Run

```bash
cd app
npm run dev
```

Open:

```txt
http://localhost:3000/live
```

Use mock mode by default or set:

```env
TXLINE_USE_MOCK=true
```

## How To Demo

1. Open `/live`.
2. Connect the admin/creator wallet.
3. Create a 5-minute live goal market.
4. Switch to a participant wallet.
5. Buy YES or NO.
6. Use `Simulate goal: YES wins` or `Simulate no goal: NO wins`.
7. Resolve the market with the admin wallet.
8. Claim payout with the winning participant wallet.

## Verification

- `npm test -- --runInBand liveGoalMarkets`: passed.
- `npm test -- --runInBand`: passed.
- `npm run build`: passed.
- `npm test` at repo root timed out after about 3 minutes while running the Anchor test script.
- `cargo check` started compiling but failed because Windows denied access to Visual Studio `link.exe`; no Rust source error was reached.

## Known Limitations

- Real TxLINE/TxODDS credentials were not available, so real API calls are interface-ready but unverified.
- Automated server-side admin signing is not enabled. The MVP uses the existing wallet-signed admin settlement path.
- Live goal metadata uses an in-memory store in demo mode. Supabase schema is prepared for hosted persistence.
- A market creator cannot buy their own position because the existing contract prohibits creator self-voting.

## Next Steps

- Add production RPCs for `live_goal_markets` insert/update.
- Wire real TxLINE fixture and score endpoint shapes once credentials are available.
- Add an admin-only `/admin/live-goal-markets` page for batch resolution.
- Add Anchor tests for short live goal duration vs standard market duration after the local linker issue is fixed.
