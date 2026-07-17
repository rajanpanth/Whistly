import { NextRequest, NextResponse } from "next/server";
import { txLineOrigin } from "@/lib/txline/client";
import { setRuntimeApiToken, setRuntimeGuestJwt } from "@/lib/txline/runtimeAuth";
import { requireAdminWallet } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/**
 * Completes TxLINE free-tier activation after the user's wallet has:
 *  1. sent the on-chain `subscribe` transaction (txSig), and
 *  2. signed the activation message `${txSig}:${leagues.join(",")}:${jwt}`.
 *
 * Forwards to TxLINE `/api/token/activate` and stores the returned API token
 * server-side (runtime store). The token is never returned to the browser.
 */
export async function POST(request: NextRequest) {
  // Activation mutates process-global TxLINE credentials shared by every
  // request in this runtime — operator/admin only.
  const auth = await requireAdminWallet(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const txSig = typeof body.txSig === "string" ? body.txSig : "";
  const walletSignature = typeof body.walletSignature === "string" ? body.walletSignature : "";
  const jwt = typeof body.jwt === "string" ? body.jwt : "";
  const leagues = Array.isArray(body.leagues) ? body.leagues.filter((x: unknown) => Number.isInteger(x)) : [];

  if (!txSig || !walletSignature || !jwt) {
    return NextResponse.json({ error: "missing_fields", message: "txSig, walletSignature, and jwt are required." }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(`${txLineOrigin()}/api/token/activate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ txSig, walletSignature, leagues }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "txline_unreachable", message: "TxLINE activation endpoint unreachable." }, { status: 502 });
  }

  const raw = await response.text();
  if (!response.ok) {
    return NextResponse.json({
      error: "activation_failed",
      status: response.status,
      message: raw.slice(0, 300) || `TxLINE activation failed with status ${response.status}.`,
    }, { status: 502 });
  }

  let apiToken = raw.trim();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === "string") apiToken = parsed.token;
  } catch { /* plain-text token response */ }

  if (!apiToken) {
    return NextResponse.json({ error: "empty_token", message: "TxLINE returned an empty API token." }, { status: 502 });
  }

  setRuntimeApiToken(apiToken);
  setRuntimeGuestJwt(jwt);

  // Server terminal only — never sent to the browser. Lets the operator persist
  // the token in .env.local (and Vercel env vars) so activation survives restarts.
  console.log(`[TxLINE] Activation succeeded. To persist across restarts, add to .env.local:\nTXLINE_API_TOKEN=${apiToken}`);

  return NextResponse.json({
    ok: true,
    message: "TxLINE free tier activated. Real fixture and score data is now enabled.",
    note: "The API token is held server-side for this runtime. Add TXLINE_API_TOKEN to .env.local to persist across restarts.",
  });
}
