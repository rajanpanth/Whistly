# Whistly Codebase Cleanup Report

## Date

2026-07-12

## Repository root

`C:\Users\panth\Videos\Whistly\Whistly`

Git branch at audit start: `main`.

## Files and folders removed

- `app/build-output.txt` — tracked build transcript with no code or runtime references.
- `app/public/banner-bg.png` — unused public asset; no repository references.
- `app/public/logo.svg` — unused public asset; no repository references.
- `app/public/merologo.jpg` — unused public asset; no repository references.
- `app/public/newsuperteam.webp` — unused public asset; no repository references.
- `app/dev-server-error.log` — untracked local development log.
- `app/dev-server.err.log` — untracked local development error log.
- `app/dev-server.log` — untracked local development log.

## Files and folders kept intentionally

- Anchor/Rust contract source, `Anchor.toml`, Cargo files, and project tests.
- Next.js source, route files, package/config files, lock files, `.env.example`, and Jest configuration.
- Wallet, transaction, settlement, claim, RPC, admin, TxLINE mock/demo, and market resolver code.
- Referenced PWA assets: `icon-192.png`, `icon-512.png`, `manifest.json`, `offline.html`, and `sw.js`.
- Existing audit notes, legal/docs files, and screenshot references.
- Ignored local dependency/build state (`node_modules` and `app/.next`) was left intact for the active local environment.

## Manual-review candidates

The following appear to have no confirmed imports, but were not deleted because they may be legacy entry points, dynamically used UI, or future product surfaces:

- `app/src/components/DarkModeToggle.tsx`
- `app/src/components/DevnetFaucet.tsx`
- `app/src/components/FeaturedPollHeroCard.tsx`
- `app/src/components/LanguageToggle.tsx`
- `app/src/components/LiveComments.tsx`
- `app/src/components/LiveIndicator.tsx`
- `app/src/components/NotificationBell.tsx`
- `app/src/components/NotificationPreferences.tsx`
- Historical KickTick/InstinctFi audit notes.
- `screenshoots refrences/` screenshots.

## Commands run

- `git status --short --branch`
- `git rev-parse --show-toplevel`
- Repository tree and file-type inventory with dependency/build folders excluded.
- `rg` reference searches for candidate files, assets, components, and logs.
- `git ls-files` and `.gitignore` inspection.
- `npx tsc --noEmit`
- `npm test -- --runInBand`
- `npm run build`
- Local route/startup checks for `/`, `/live`, and `npm run dev`.

## Validation results

### TypeScript

PASS — `npx tsc --noEmit` completed successfully.

### Tests

FAILURE LIMITED TO KNOWN RPC ADMIN MISMATCH — 88 passed, 9 failed, 14 skipped. The failures are in `src/__tests__/integration/rpc-critical-path.test.ts` and return 403 admin rejection where fixtures expect create/validation responses. No test or RPC logic was changed.

### Build

PASS — `npm run build` completed successfully; all 49 static pages/routes generated.

## Known issues not fixed

- Existing React Hook exhaustive-deps warning in `src/lib/hooks/usePollOperations.ts`.
- Supabase environment variables are absent locally, so the app runs in offline/demo mode.
- Manual-review candidates remain and were intentionally not removed.

## Protected areas confirmation

No Anchor contract logic, IDL/types, wallet transaction logic, settlement logic, claim logic, RPC/admin logic, market-kind mapping, or YES/NO mapping was modified by this cleanup pass.
