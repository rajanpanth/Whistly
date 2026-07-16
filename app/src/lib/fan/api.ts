import { NextRequest, NextResponse } from "next/server";
import { getWalletFromAuth } from "@/lib/jwt";
import { FanStoreError } from "./store";

export async function requireFanWallet(req: NextRequest) {
    return getWalletFromAuth(req.headers.get("authorization"));
}

export function fanApiError(error: unknown) {
    const code = error instanceof FanStoreError
        ? error.code
        : error instanceof Error
          ? error.message
          : "fan_request_failed";
    const status =
        code === "fan_storage_not_configured" ? 503 :
        code === "duplicate_prediction" ? 409 :
        code === "challenge_locked" || code === "room_closed" ? 409 :
        code.endsWith("_not_found") ? 404 : 500;
    return NextResponse.json({ error: code }, { status });
}

export function noStoreJson(body: unknown, init?: ResponseInit) {
    return NextResponse.json(body, {
        ...init,
        headers: { "cache-control": "no-store", ...(init?.headers ?? {}) },
    });
}
