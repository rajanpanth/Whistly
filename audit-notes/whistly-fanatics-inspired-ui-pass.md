 # Whistly fanatics-inspired UI pass

## What changed
- Reworked the homepage into a dark, compact football prediction-market discovery layout.
- Added a football-first featured live market, dense live-now cards, category sections, status rail, quick picks, trust strip, responsive chips, and original demo copy.
- Updated header search/nav labels and the shared footer with Whistly-specific demo/disclaimer language.
- Kept the existing reusable market cards, share controls, wallet modal, and /live route intact.

## Reference handling
The provided PDF and screenshots were used only for structural and density inspiration. No Fanatics logo, name, protected assets, proprietary text, or copied legal wording was added.

## Files changed
- app/src/components/marketplace/MarketplaceHome.tsx
- app/src/components/marketplace/MarketCards.tsx
- app/src/components/Navbar.tsx
- app/src/components/Footer.tsx
- app/src/lib/marketplaceData.ts
- app/src/app/globals.css

## Verification
- cd app && npx tsc --noEmit — passed.
- cd app && npm run build — passed.
- Build warning: existing usePollOperations.ts exhaustive-deps warning.
- Build notice: missing Supabase env vars correctly kept the app in offline/demo mode.
- Desktop/tablet/mobile responsive rules were added for 1440, 1280, 768, 390, and 360px behavior; horizontal overflow remains clipped and chips scroll.
- / and /live are present in the production route output.

## Known issues
- npm test -- --runInBand — 6 suites passed, 1 skipped, 1 failed. The existing rpc-critical-path suite has 9 failures returning 403 admin rejection; 88 tests passed and 14 were skipped.
- Visual browser screenshots were not captured in this environment.

## Preservation confirmation
No Anchor contract, IDL, wallet adapter logic, settlement logic, claim logic, RPC logic, or TxLINE resolver implementation was modified. Existing DEVNET / Mock TxLINE labels and /live controls remain in place.


