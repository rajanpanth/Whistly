/**
 * Chrome-gating route predicates, shared by Navbar, ConditionalFooter, and
 * ConditionalPageShell so the route lists can never drift apart again.
 *
 * This module must stay dependency-free (no imports) — it is pulled into the
 * root layout's client chunk and anything imported here ships on every page.
 */

/** Fan-experience routes render inside the fan shell with their own header. */
export const FAN_ROUTE_RE = /^\/(matchday|rooms\/|fan-leaderboard|fan-profile|recap\/)/;

/**
 * V2 trading + fan routes own their chrome (header/footer). The homepage `/`
 * is intentionally excluded so its frozen chrome never changes.
 */
export const TRADING_ROUTE_RE = /^\/(markets|market\/|event\/|live|portfolio|positions|orders|activity|matchday|rooms\/|fan-leaderboard|fan-profile|recap\/)/;

export function isTradingRoute(pathname: string | null): boolean {
    return Boolean(pathname && TRADING_ROUTE_RE.test(pathname));
}

export function isFanRoute(pathname: string | null): boolean {
    return Boolean(pathname && FAN_ROUTE_RE.test(pathname));
}
