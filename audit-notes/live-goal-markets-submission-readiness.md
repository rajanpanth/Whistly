# Live Goal Markets Submission Readiness

## Final status

NOT READY — remaining blockers:

- Full local `anchor build -p instinctfi` did not complete. The SBF program binary was produced, but Anchor IDL generation failed.
- Devnet end-to-end demo flow was not verified in this pass.
- Generated IDL/types were not regenerated locally because the Anchor build failed during IDL generation.
- The project folder is currently untracked from the resolved Git root (`C:/Users/panth`), so there is no reliable focused project diff to review with `git diff`.

## Files changed

This readiness pass created this audit note:

- `audit-notes/live-goal-markets-submission-readiness.md`

Existing live-goal-market implementation files inspected during this pass:

- `programs/instinctfi/src/lib.rs`
- `programs/instinctfi/src/state.rs`
- `programs/instinctfi/src/errors.rs`
- `programs/instinctfi/src/instructions/create_poll.rs`
- `app/src/lib/program.onchain.ts`
- `app/src/lib/hooks/usePollOperations.ts`
- `app/src/lib/liveGoalMarkets.ts`
- `app/src/lib/liveGoalMarketStore.ts`
- `app/src/lib/__tests__/liveGoalMarkets.test.ts`
- `app/src/app/create/page.tsx`
- `app/src/app/live/page.tsx`
- `app/src/app/api/rpc/create-poll/route.ts`
- `app/src/app/api/rpc/_validation.ts`
- `app/src/app/api/markets/create-live-goal/route.ts`
- `app/src/app/api/markets/resolve-live-goal/route.ts`
- `app/src/__tests__/integration/rpc-critical-path.test.ts`
- `.github/workflows/ci.yml`
- `.github/workflows/anchor-deploy.yml`

## Tests passed

From `app/`:

- `npm test -- --runInBand liveGoalMarkets`
  - Passed: 1 suite, 5 tests.
- `npm test -- --runInBand`
  - Passed: 7 suites, 97 tests.
  - Skipped: 1 suite, 14 tests.
  - Console output includes expected negative-path RPC logs and demo-mode Supabase warnings.
- `npm run build`
  - Passed with Next.js 15.5.12.
  - Warning: `src/lib/hooks/usePollOperations.ts` has an unnecessary `usersRef` dependency in one `useCallback`.
  - Warning: Supabase env vars are missing locally, so the app reports offline/demo mode.
  - Warning: Browserslist/caniuse-lite data is stale.

## Anchor build status

Requested command from project root:

```bash
anchor build -p instinctfi
```

First result:

```text
[2026-07-09T01:48:31.652116700Z ERROR cargo_build_sbf] Can't get home directory path: environment variable not found
```

Retry with `HOME` set to the Windows user profile:

```powershell
$env:HOME=$env:USERPROFILE; anchor build -p instinctfi
```

Local versions:

- `anchor-cli 0.30.1`
- `rustc 1.93.0 (254b59607 2026-01-19)`
- `solana-cli 1.18.23`

Result:

- Rust/SBF release compilation reached `Finished release [optimized]`.
- `target/deploy/instinctfi.so` was produced.
- Build then failed during IDL generation:

```text
error[E0599]: no method named `source_file` found for struct `proc_macro2::Span` in the current scope
  --> ...\anchor-syn-0.30.1\src\idl\defined.rs:499:66
error: could not compile `anchor-syn` (lib) due to 1 previous error
Error: Building IDL failed
```

Conclusion: local full Anchor build is not verified. This appears to be an Anchor/Rust toolchain compatibility failure during IDL generation on the local Windows environment, not an application TypeScript failure. The generated IDL/type directories exist but are empty after the failed IDL phase.

## CI status

Configured but not executed in this pass.

- `.github/workflows/ci.yml` has an `anchor-build` job running on `ubuntu-latest` inside `backpackapp/build:v0.30.1`.
- The CI job verifies Rust, Solana, and Anchor versions.
- The CI job downgrades `Cargo.lock` from v4 to v3 for `cargo-build-sbf`.
- The CI job runs `anchor build -p instinctfi`.

Caveat:

- `.github/workflows/anchor-deploy.yml` uses `anchor build -p instinctfi --no-idl` for deployment builds.
- The CI workflow does run the full Anchor build, but no GitHub Actions run was verified locally in this pass.

## Devnet demo status

Not verified in this pass.

The frontend build and unit/integration tests passed locally, but no wallet-connected devnet flow was executed. Do not claim the devnet demo is verified until a real wallet flow confirms:

- create live goal market
- buy YES/NO
- resolve from score data
- admin settlement transaction appears
- winning wallet claim payout transaction appears

## YES-win demo steps

1. Start the app in demo/devnet mode and open `/live`.
2. Confirm the page shows demo mode clearly.
3. Connect the admin-capable wallet.
4. Click `Start demo match`.
5. Create a 5, 15, or 45 minute market.
6. Buy `YES`.
7. Use the demo control `Simulate goal: YES wins`.
8. Resolve the market with the admin wallet.
9. Confirm the UI displays the settlement transaction signature.
10. Claim payout from the winning wallet.
11. Confirm the UI displays the claim payout transaction signature.

## NO-win demo steps

1. Start the app in demo/devnet mode and open `/live`.
2. Confirm the page shows demo mode clearly.
3. Connect the admin-capable wallet.
4. Click `Start demo match`.
5. Create a 5, 15, or 45 minute market.
6. Buy `NO`.
7. Use the demo control `Simulate no goal: NO wins`.
8. Resolve the market with the admin wallet.
9. Confirm the UI displays the settlement transaction signature.
10. Claim payout from the winning wallet.
11. Confirm the UI displays the claim payout transaction signature.

## Known limitations

- Full local Anchor build failed during IDL generation, so generated IDL/types are not current from this run.
- `target/deploy/instinctfi.so` exists from the partial local build, but that is not equivalent to a successful `anchor build`.
- Devnet end-to-end flow was not verified.
- The live goal metadata store is in-memory for demo mode.
- The Supabase/RPC create-poll path forwards `p_market_kind`, but hosted persistence/schema deployment was not verified in this pass.
- The project directory is untracked relative to the resolved Git root, so `git diff` cannot be used as a reliable project-scoped audit source.
- Existing standard poll settlement UI copy still describes highest-voted settlement in some standard poll surfaces; `/live` correctly says live markets resolve from score data, not majority vote.

## Submission pitch

InstinctFi adds live football goal-window prediction markets on Solana. Users can buy YES or NO on whether a goal happens within the next 5, 15, or 45 minutes. Live markets are tagged with `marketKind: 1`, use strict NO/YES outcomes, resolve from score data instead of majority vote, and surface settlement plus claim payout transaction signatures in the demo flow.

## Checklist findings

- Standard create-poll flow passes `marketKind: 0`: verified in `app/src/app/create/page.tsx`.
- Live goal markets pass `marketKind: 1`: verified in `app/src/app/live/page.tsx`.
- Supabase/RPC create-poll path forwards market kind: verified in `app/src/app/api/rpc/create-poll/route.ts`, `app/src/app/api/rpc/_validation.ts`, and integration tests.
- `/live` displays demo mode clearly: verified in UI copy.
- `/live` says markets resolve from score data, not majority vote: verified in UI copy and live market description.
- Settlement transaction signature is displayed: verified in `/live` source via `Settlement tx`.
- Claim payout transaction signature is displayed: verified in `/live` source via `Claim tx`.
- Old portfolio/poll claim flows compile with the updated claim return type: verified by full Jest and Next production build.
- Generated IDL/types are current: not verified; local IDL generation failed.
