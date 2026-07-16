"use client";

import { useOrderBook } from "@/lib/v2/hooks";
import { bpsToPct1 } from "@/lib/v2/client";

const EXPLORER = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

export default function OrderBook({ market, outcome }: { market: string; outcome: number }) {
    const { book, loading } = useOrderBook(market, outcome);

    if (loading && !book) {
        return <div className="wt-empty">Loading order book…</div>;
    }
    const hasOrders = (book?.bids.length ?? 0) > 0 || (book?.asks.length ?? 0) > 0;
    const maxCum = Math.max(
        1,
        ...(book?.bids ?? []).map((l) => l.cumulative),
        ...(book?.asks ?? []).map((l) => l.cumulative)
    );

    return (
        <div>
            <div className="wt-book">
                <div className="wt-book-head">
                    <span>Price</span>
                    <span className="wt-num-right">Shares</span>
                    <span className="wt-num-right">Total</span>
                </div>

                {!hasOrders ? (
                    <div className="wt-empty">
                        No resting orders yet. Post a limit order to make this market.
                    </div>
                ) : (
                    <>
                        {/* Asks, highest first so the best ask sits above the spread */}
                        {[...(book?.asks ?? [])]
                            .slice(0, 8)
                            .reverse()
                            .map((l) => (
                                <div key={`a${l.priceBps}`} className="wt-book-row wt-book-ask">
                                    <span
                                        className="depth"
                                        style={{ width: `${(l.cumulative / maxCum) * 100}%` }}
                                    />
                                    <span className="p">{bpsToPct1(l.priceBps)}</span>
                                    <span className="wt-num-right">{l.quantity}</span>
                                    <span className="wt-num-right">{l.cumulative}</span>
                                </div>
                            ))}

                        <div className="wt-book-mid">
                            <span>
                                Spread{" "}
                                {book?.spreadBps !== null && book?.spreadBps !== undefined
                                    ? bpsToPct1(book.spreadBps)
                                    : "—"}
                            </span>
                            <span>
                                Mid {book?.midBps !== null ? bpsToPct1(book?.midBps) : "—"}
                            </span>
                            <span>
                                Last{" "}
                                {book?.lastTradeBps !== null
                                    ? bpsToPct1(book?.lastTradeBps)
                                    : "—"}
                            </span>
                        </div>

                        {/* Bids, highest first */}
                        {(book?.bids ?? []).slice(0, 8).map((l) => (
                            <div key={`b${l.priceBps}`} className="wt-book-row wt-book-bid">
                                <span
                                    className="depth"
                                    style={{ width: `${(l.cumulative / maxCum) * 100}%` }}
                                />
                                <span className="p">{bpsToPct1(l.priceBps)}</span>
                                <span className="wt-num-right">{l.quantity}</span>
                                <span className="wt-num-right">{l.cumulative}</span>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {(book?.recentTrades.length ?? 0) > 0 && (
                <div style={{ marginTop: 16 }}>
                    <p className="wt-panel-title">Recent trades</p>
                    <div className="wt-book">
                        {book!.recentTrades.slice(0, 8).map((t) => (
                            <div key={t.txSignature} className="wt-book-row">
                                <span>{bpsToPct1(t.priceBps)}</span>
                                <span className="wt-num-right">{t.quantity}</span>
                                <span className="wt-num-right">
                                    <a
                                        href={EXPLORER(t.txSignature)}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ color: "var(--wt-accent)" }}
                                    >
                                        tx ↗
                                    </a>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
