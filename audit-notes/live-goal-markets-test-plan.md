# InstinctFi Live Goal Markets Test Plan

## Automated Tests Added

- `app/src/lib/__tests__/liveGoalMarkets.test.ts`
  - `0-0` to `0-0` resolves to NO.
  - `1-1` to `1-1` resolves to NO.
  - `1-1` to `2-1` resolves to YES.
  - `0-2` to `1-2` resolves to YES.
  - `2-2` to `3-3` resolves to YES.

## Existing Tests To Run

From `app/`:

```bash
npm test -- --runInBand
```

From repo root, if the local Anchor toolchain is installed:

```bash
npm test
```

## Manual Hackathon Demo Test

1. Start the app with `TXLINE_USE_MOCK=true`.
2. Open `/live`.
3. Confirm the Nepal vs Brazil demo match appears with score `1 - 1`.
4. Connect the admin/creator wallet.
5. Create the 5-minute live goal market.
6. Switch to a participant wallet.
7. Buy YES.
8. Buy NO in a separate run or with another participant wallet.
9. Use demo controls:
   - `Simulate goal: YES wins`
   - `Resolve market`
10. Confirm the resolved outcome shows YES.
11. With the admin wallet, write the result on-chain through the existing settlement flow.
12. With a winning participant wallet, click `Claim payout`.
13. Repeat with `Simulate no goal: NO wins`.

## Contract Checks

- Standard markets must still require at least 1 hour.
- Live goal markets are identified by:
  - category `World Cup`
  - title containing `Goal in next`
  - outcomes exactly `["NO", "YES"]`
- Live goal markets may use a 60-second minimum duration.
- Admin settlement maps:
  - NO to `winning_option = 0`
  - YES to `winning_option = 1`

## Known Manual Verification Gaps

- Real TxLINE credentials were not available, so real API verification must be done after credentials are provided.
- Automated admin-wallet server settlement is intentionally not enabled; the MVP uses the existing wallet-signed admin settlement path.
