/**
 * Server-side runtime credential store for TxLINE.
 *
 * The guest JWT is public-issuable (POST /auth/guest/start, no signup) and is
 * auto-fetched/renewed. The API token comes from either the TXLINE_API_TOKEN
 * env var or the in-app free-tier activation flow (wallet-signed on-chain
 * subscribe + /api/token/activate). Tokens live in module/global state only —
 * they are never sent to the browser or logged.
 */

const store = globalThis as typeof globalThis & {
  __txlineRuntimeAuth?: { guestJwt: string; apiToken: string; activatedAt?: string };
};

function state() {
  if (!store.__txlineRuntimeAuth) store.__txlineRuntimeAuth = { guestJwt: "", apiToken: "" };
  return store.__txlineRuntimeAuth;
}

export function getRuntimeGuestJwt(): string {
  return state().guestJwt;
}

export function setRuntimeGuestJwt(jwt: string): void {
  state().guestJwt = jwt;
}

export function getRuntimeApiToken(): string {
  return state().apiToken;
}

export function setRuntimeApiToken(token: string): void {
  state().apiToken = token;
  state().activatedAt = new Date().toISOString();
}

export function getActivatedAt(): string | undefined {
  return state().activatedAt;
}
