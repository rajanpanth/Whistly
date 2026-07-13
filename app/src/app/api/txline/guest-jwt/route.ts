import { NextResponse } from "next/server";
import { getGuestJwt, TxLineRequestError } from "@/lib/txline/client";

export const dynamic = "force-dynamic";

/**
 * Issues a TxLINE guest session JWT (server-side proxy to avoid CORS).
 * The guest JWT is public-issuable per TxLINE docs and is required by the
 * client to sign the free-tier activation message `${txSig}::${jwt}`.
 */
export async function POST() {
  try {
    const token = await getGuestJwt(true);
    return NextResponse.json({ token });
  } catch (error) {
    const status = error instanceof TxLineRequestError ? 502 : 500;
    return NextResponse.json({ error: "guest_jwt_failed", message: "Could not obtain a TxLINE guest session." }, { status });
  }
}
