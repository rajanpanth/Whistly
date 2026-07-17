/**
 * Shared admin authentication guard for non-RPC API routes
 * (markets/*, txline/activate, …).
 *
 * Same authority model as `createAdminRpcHandler`: the caller must present a
 * valid wallet JWT AND the wallet must exist in the `admin_wallets` Supabase
 * table. Rate limiting is applied before the DB lookup.
 *
 * Offline/demo mode: when Supabase is not configured in development, falls
 * back to the dev-only ADMIN_WALLETS list so the local demo flow keeps
 * working. In production a missing Supabase config fails closed (500).
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletFromAuth } from "@/lib/jwt";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isRateLimited } from "@/lib/rateLimit";
import { isAdminWallet } from "@/lib/constants";
import { log } from "@/lib/logger";

export type AdminAuthResult =
    | { ok: true; wallet: string }
    | { ok: false; response: NextResponse };

function supabaseConfigured(): boolean {
    return Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    );
}

/**
 * Check whether a wallet is an admin (admin_wallets table; dev-list fallback
 * when Supabase isn't configured in development). No auth/rate-limit here —
 * use inside routes that have already authenticated the wallet.
 */
export async function isAdminInDb(wallet: string): Promise<boolean> {
    if (!supabaseConfigured() && process.env.NODE_ENV === "development") {
        return isAdminWallet(wallet);
    }
    const { data } = await getSupabaseAdmin()
        .from("admin_wallets")
        .select("wallet")
        .eq("wallet", wallet)
        .single();
    return Boolean(data);
}

export async function requireAdminWallet(req: NextRequest): Promise<AdminAuthResult> {
    try {
        const wallet = await getWalletFromAuth(req.headers.get("authorization"));
        if (!wallet) {
            return {
                ok: false,
                response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
            };
        }

        if (await isRateLimited(wallet)) {
            return {
                ok: false,
                response: NextResponse.json({ error: "rate_limited" }, { status: 429 }),
            };
        }

        // Offline/demo dev mode without Supabase: use the dev-only env list.
        if (!supabaseConfigured() && process.env.NODE_ENV === "development") {
            if (!isAdminWallet(wallet)) {
                log.warn("admin_rejected", { route: req.nextUrl.pathname, wallet, mode: "dev-fallback" });
                return {
                    ok: false,
                    response: NextResponse.json({ error: "not_admin" }, { status: 403 }),
                };
            }
            return { ok: true, wallet };
        }

        const { data: adminRow } = await getSupabaseAdmin()
            .from("admin_wallets")
            .select("wallet")
            .eq("wallet", wallet)
            .single();

        if (!adminRow) {
            log.warn("admin_rejected", { route: req.nextUrl.pathname, wallet });
            return {
                ok: false,
                response: NextResponse.json({ error: "not_admin" }, { status: 403 }),
            };
        }

        return { ok: true, wallet };
    } catch (e) {
        log.error("admin_auth_error", { route: req.nextUrl.pathname, error: (e as Error).message });
        return {
            ok: false,
            response: NextResponse.json({ error: "internal_error" }, { status: 500 }),
        };
    }
}
