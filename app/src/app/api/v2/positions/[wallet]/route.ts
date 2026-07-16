import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { connection, PROGRAM_ID, accountDiscriminator } from "@/lib/program.base";
import { parsePositionV2, parseBalanceV2, getBalanceV2PDA } from "@/lib/v2/programV2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v2/positions/[wallet] — on-chain PositionV2 accounts + trading
 * balance for a wallet. Chain is the source of truth; nothing synthetic.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ wallet: string }> }
) {
    const { wallet } = await params;
    let owner: PublicKey;
    try {
        owner = new PublicKey(wallet);
    } catch {
        return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
    }

    const disc = await accountDiscriminator("PositionV2");
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
            { memcmp: { offset: 0, bytes: bs58.encode(disc) } },
            // PositionV2 layout: disc(8) + market(32) + owner(32) …
            { memcmp: { offset: 40, bytes: owner.toBase58() } },
        ],
    });

    const positions = accounts.map(({ pubkey, account }) => {
        const p = parsePositionV2(account.data);
        return {
            address: pubkey.toBase58(),
            market: p.market.toBase58(),
            outcomeIndex: p.outcomeIndex,
            shares: Number(p.shares),
            costLamports: Number(p.costLamports),
            proceedsLamports: Number(p.proceedsLamports),
            redeemedShares: Number(p.redeemedShares),
            redeemedLamports: Number(p.redeemedLamports),
        };
    });

    const balanceInfo = await connection.getAccountInfo(getBalanceV2PDA(owner)[0]);
    const balance = balanceInfo ? parseBalanceV2(balanceInfo.data) : null;

    return NextResponse.json({
        wallet,
        positions,
        balance: balance
            ? {
                  available: Number(balance.available),
                  totalDeposited: Number(balance.totalDeposited),
                  totalWithdrawn: Number(balance.totalWithdrawn),
              }
            : null,
    });
}
