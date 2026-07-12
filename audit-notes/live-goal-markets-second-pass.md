# Live Goal Markets Second-Pass Verification

## What Was Verified

- `/live` uses the existing wallet-backed app operations:
  - create live goal market -> `createPoll` -> Anchor `create_poll`
  - buy YES/NO -> `castVote` -> Anchor `cast_vote`
  - resolve market -> resolver prepares outcome, then admin wallet calls Anchor `admin_settle_poll`
  - claim payout -> `claimReward` -> Anchor `claim_reward`
- Resolver maps outcomes correctly:
  - `NO = winning_option 0`
  - `YES = winning_option 1`
- Resolver uses stored start score plus fetched end score:
  - YES if end total goals > start total goals
  - NO otherwise
- Demo mode is clearly labeled in the UI as simulated TxLINE data.
- Creator self-buy is still blocked by the existing contract logic and is called out in the UI.

## What Was Fixed

- Replaced fragile short-market detection based on title/category text with explicit `market_kind`.
- Added on-chain constants:
  - `MARKET_KIND_STANDARD = 0`
  - `MARKET_KIND_LIVE_GOAL_WINDOW = 1`
- Added `market_kind: u8` to `PollAccount`.
- Updated `create_poll` to accept `market_kind`.
- Standard markets still require `MIN_STANDARD_MARKET_DURATION = 3600`.
- Live goal markets use `MIN_LIVE_GOAL_MARKET_DURATION = 60`.
- Live goal markets must have exactly two outcomes:
  - `NO`
  - `YES`
- Updated the TypeScript instruction builder to serialize `marketKind`.
- Updated `/live` to pass `marketKind: 1`.
- Changed the `/live` on-chain `endTime` to the 60-second buy lock, so `cast_vote` is blocked on-chain after lock.
- Hardened the resolve route so it does not mark metadata `RESOLVED` until a settlement transaction signature is supplied.
- Updated settlement operation return type so confirmed on-chain settlement returns the transaction signature.
- `/live` records and displays the settlement transaction signature after admin settlement succeeds.
- Added UI guard to stop buys when the visible score has already changed from the stored market start score.

## Whether Settlement Is Truly On-Chain

Yes, when the connected wallet is the platform admin.

The backend resolver does not pretend to settle on-chain. It prepares the winning option index from score data. The `/live` admin action then calls the existing wallet-signed `admin_settle_poll` instruction. Metadata is marked `RESOLVED` only after the wallet flow returns a settlement transaction signature.

If the connected wallet is not admin, the UI cannot complete on-chain settlement.

## Whether Claim Payout Is Truly On-Chain

Yes.

`Claim payout` reuses the existing `claimReward` app operation, which builds and sends the Anchor `claim_reward` instruction. It only works after the poll account is settled on-chain and the connected wallet has winning votes.

## Whether Anchor Build/Test Passed

- `cargo check`: passed.
- `anchor build`: did not pass in this Windows environment.
- `anchor test`: did not pass in this Windows environment.
- `cargo test`: did not pass in this Windows environment.

Anchor/Rust blockers:

- Initial `anchor build` failed because HOME was missing.
- Retrying with `HOME=$USERPROFILE` reached compilation but failed with:
  - `could not exec the linker link.exe`
  - `Access is denied. (os error 5)`
- `anchor test` failed with the same `link.exe` access denial.
- `cargo test` failed with the same `link.exe` access denial.
- WSL fallback could not run because WSL has no installed Linux distribution.

Workarounds to verify Anchor fully:

1. Install a WSL Linux distribution, then run:
   ```bash
   cd /mnt/c/Users/panth/Videos/InstinctFi-main/InstinctFi-main
   anchor build
   anchor test
   ```
2. Or run from a Visual Studio Developer PowerShell where `link.exe` is accessible, set HOME, then run:
   ```powershell
   $env:HOME=$env:USERPROFILE
   anchor build
   anchor test
   cargo test
   ```
3. If access is still denied, check Windows Defender controlled folder access, antivirus policy, or file permissions for:
   ```txt
   C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.44.35207\bin\HostX64\x64\link.exe
   ```

Do not treat the Anchor build/test suite as verified until one of those passes.

## Frontend Verification Results

From `app/`:

```bash
npm test -- --runInBand liveGoalMarkets
```

Passed: 5 tests.

```bash
npm test -- --runInBand
```

Passed: 7 suites, 95 tests. Existing expected console warnings appeared in RPC/security tests.

```bash
npm run build
```

Passed. Existing warning remains:

```txt
React Hook useCallback has an unnecessary dependency: 'usersRef'
```

## Remaining Blockers

- Full Anchor build/test verification is blocked by Windows `link.exe` access denial.
- The demo metadata store is in-memory. Supabase schema exists, but hosted persistence still needs write RPCs.
- Real TxLINE/TxODDS API credentials were not available; real API integration is interface-ready but unverified.
- The contract cannot know whether a football score changed before lock; the hard on-chain guard is the 60-second lock `end_time`. The UI also disables buys if mock/live score has changed, but direct on-chain callers can only be stopped by time, not by score feed.
- The existing Supabase `settle_poll_atomic` is still majority-vote based. The live flow treats on-chain settlement as source of truth and uses the live metadata route for score-based resolution.

## Exact YES-Win Demo Steps

Use two wallets because the creator cannot buy their own market.

1. Start the app:
   ```bash
   cd app
   npm run dev
   ```
2. Open:
   ```txt
   http://localhost:3000/live
   ```
3. Connect the admin/creator wallet.
4. Click `Start demo match`.
5. Create the `5 min` market.
6. Switch to a participant wallet.
7. Buy `YES`.
8. Wait until the 60-second buy lock passes.
9. Switch back to the admin wallet.
10. Click `Simulate goal: YES wins`.
11. Click `Resolve market`.
12. Confirm the admin wallet transaction.
13. Confirm the UI shows:
   - resolved outcome `YES`
   - score `1-1 to 2-1`
   - settlement transaction signature
14. Switch back to the winning participant wallet.
15. Click `Claim payout`.

## Exact NO-Win Demo Steps

Use two wallets because the creator cannot buy their own market.

1. Open `/live`.
2. Connect the admin/creator wallet.
3. Click `Start demo match`.
4. Create a fresh `5 min`, `15 min`, or `45 min` market.
5. Switch to a participant wallet.
6. Buy `NO`.
7. Wait until the 60-second buy lock passes.
8. Switch back to the admin wallet.
9. Click `Simulate no goal: NO wins`.
10. Click `Resolve market`.
11. Confirm the admin wallet transaction.
12. Confirm the UI shows:
    - resolved outcome `NO`
    - score `1-1 to 1-1`
    - settlement transaction signature
13. Switch back to the winning participant wallet.
14. Click `Claim payout`.
