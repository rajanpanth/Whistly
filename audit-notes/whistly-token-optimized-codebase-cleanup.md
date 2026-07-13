# Whistly — Token-Optimized Codebase Cleanup

**Date:** 2026-07-12
**Repository root:** `C:/Users/panth/Videos/Whistly/Whistly` (self-contained git repo, branch `main`)
**App root:** `app/` (Next.js) · **Anchor program:** `programs/instinctfi/`

## 1. Cleanup goal
Make the repo smaller, cleaner, and cheaper for AI tools to reason about — **safely**.
Remove only provably-unnecessary files; flag everything uncertain for manual review.
No Anchor/IDL/wallet/settlement/claim/RPC logic changed. No behavior changed.

## 2. Files/folders removed (SAFE_DELETE)
| Removed | Type | Why safe |
|---------|------|----------|
| `test.rs` (repo root) | Orphaned source | Rust order-book file (`OpenOrder`/`Bid`/`Ask`). **Not** in the Cargo workspace (`Cargo.toml` `members = ["programs/instinctfi"]`), not part of the Anchor contract, **zero references** in the entire repo, never compiled. |
| `app/build-output.txt` | Generated artifact | Captured build-log output. Not imported, not an asset, not referenced. (Was already deleted in the working tree; deletion staged.) |

Total tracked source/artifact removed: **2 files**. No folders deleted.

## 3. Code trimmed (SAFE_CODE_TRIM)
**None.** No high-confidence dead code was identified without deeper static analysis.
Per the "no broad refactors / don't break working logic" constraint, all source logic
was left untouched. TypeScript compiles with zero errors, confirming no unused-code
removal was needed to satisfy the compiler.

## 4. Files/folders intentionally kept (CORE_KEEP highlights)
- All Next.js routes under `app/src/app/**` (`/`, `/live`, `/admin`, `/create`, `/polls`, api routes).
- Wallet/on-chain layer: `program.base.ts`, `program.onchain.ts`, `program.ts`,
  `hooks/useWalletManager.ts`, `hooks/usePollOperations.ts`, `WalletAdapterProvider.tsx`.
- Settlement/claim/RPC: `api/rpc/*`, `api/markets/*`, poll components.
- TxLINE service: `lib/txline/*`, `api/txline/*`.
- Anchor program `programs/instinctfi/**` (untouched).
- Active data/util modules verified in-use: `seedPolls.ts` (→ Providers), `marketplaceData.ts`
  (→ MarketCards/MarketplaceHome/Navbar), `kicktickMarkets.ts` (→ /live, leaderboard, world-cup,
  replay, verify, KickTickMarketCard), `DemoNotice.tsx` (→ 5 pages).
- Configs/docs: `package.json`, both `package-lock.json`, `tsconfig.json`, `Anchor.toml`,
  `Cargo.toml/lock`, `.cargo/audit.toml`, `.env.example`, `README.md`, `PROJECT_REPORT.md`,
  `CONTRIBUTING.md`, `LICENSE`, `supabase_rls_migration.sql`, all `audit-notes/*`.
- Marker mappings preserved unchanged: `marketKind` 0=Standard / 1=LiveGoalWindow;
  outcomes 0=NO / 1=YES.

## 5. REVIEW_MANUALLY (NOT deleted)
- **`screenshoots refrences/`** — 6 PNGs, ~4.3 MB, **zero code/CSS/metadata references**
  (verified). Pure design-reference screenshots. *Recommended:* delete or move out of the
  repo to reclaim ~4.3 MB. Kept because the folder is the developer's intentional "references"
  material, not an app asset — deletion should be an explicit human decision.
- **TxLINE mock used in the main flow** — `lib/txline/mock.ts`, `lib/txline/fixtures.ts`,
  `api/txline/demo/route.ts`. `lib/txline/client.ts` defaults to mock mode unless
  `TXLINE_BASE_URL` is set and `TXLINE_USE_MOCK=false`, so `/live` silently uses mock scores.
  Preserved per hard constraints (TxLINE logic must not break). *Future change (do not do
  during cleanup):* make the real flow fail-closed (show "feed unavailable") instead of
  silently falling back to mock, so demo data never drives real settlement.
- **Prior-session pending working-tree changes** (not authored by this pass, left as-is):
  deleted unreferenced public assets `banner-bg.png`, `logo.svg`, `merologo.jpg`,
  `newsuperteam.webp` (all verified zero references) and a `BrandMark.tsx` edit. These build
  cleanly (production build passes) but were not staged/committed here.

## 6. Token-usage reduction recommendations
- Heavy dirs are already git-ignored and thus excluded from AI search: `node_modules/`,
  `.next/`, `app/.next/`, `app/out/`, `target/`, `.anchor/`, `*.tsbuildinfo`, `next-env.d.ts`.
- Largest remaining token/size sink is `screenshoots refrences/` (~4.3 MB of PNGs). Removing or
  relocating it is the single biggest repo-size win (see REVIEW_MANUALLY).
- Added `audit-notes/README.md` indexing current vs. historical notes so AI tools can skip
  superseded plans.

## 7. .gitignore updates
Appended to the "Debug / CI logs" section to prevent re-adding removed artifacts:
```
build-output.txt
*.bak
*.old
*.orig
*.tmp
```
(All heavy build/dependency dirs were already ignored — no change needed there.)

## 8. AI-ignore recommendations
This environment (Claude Code) has **no dedicated AI-ignore file**; it honors `.gitignore`
for search scoping, so no new ignore file was invented. Recommended exclusions are already
covered by `.gitignore` (`node_modules/`, `.next/`, `target/`, `dist/`-style outputs, logs,
tsbuildinfo). Consider relocating `screenshoots refrences/` outside the repo if AI context
size becomes a concern.

## 9. Commands run
```
git rev-parse --show-toplevel / --abbrev-ref HEAD
git status --short --branch ; git diff --stat
git ls-files (inventory, sizes, extension scans)
grep -r (reference proofs for test.rs, assets, kicktick, mock/demo, seedPolls, marketplaceData)
git rm -f test.rs
git rm -f app/build-output.txt
cd app && npx tsc --noEmit
cd app && npm run build
cd app && npm test -- --runInBand
```

## 10. Results
- **TypeScript (`npx tsc --noEmit`):** ✅ PASS (exit 0, zero errors).
- **Production build (`npm run build`):** ✅ PASS (exit 0). All routes compiled, incl.
  `/`, `/live`, `/admin`, `/create`, `/polls`, `/portfolio`, all `api/*`.
- **Tests (`npm test -- --runInBand`):** 6 suites PASS, 1 suite FAIL, 1 skipped.
  - Failing suite: `src/__tests__/integration/rpc-critical-path.test.ts` (9 tests) — the
    **known pre-existing** create-poll admin-mismatch (403 / status expectations). This is the
    documented existing issue; unrelated to this cleanup (removed files are not imported by any
    test). **RPC/admin logic was not modified.**

## 11. Known issues not fixed
- `rpc-critical-path.test.ts` failures (pre-existing create-poll admin/403 mismatch). Left as-is
  per instructions — fixing it would require touching RPC/admin logic, which is out of scope.

## 12. Confirmation
Anchor contract logic, IDL/types used by the frontend, wallet-connect, settlement, claim, and
RPC/admin logic were **not modified**. Only two proven-unnecessary files were removed, plus a
`.gitignore` hardening and an `audit-notes/README.md` index. `marketKind` (0=Standard,
1=LiveGoalWindow) and outcome (0=NO, 1=YES) mappings are unchanged.
