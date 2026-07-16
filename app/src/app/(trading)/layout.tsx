import "./trading.css";
import type { ReactNode } from "react";
import TradingHeader from "./TradingHeader";

/**
 * Isolated layout for the V2 trading experience. All descendant markup
 * lives inside `.wt-root`, and every rule in trading.css is scoped to that
 * class — so nothing here can alter the frozen homepage `/`.
 *
 * The global Navbar/Footer are hidden on these routes (see Navbar.tsx /
 * Footer chrome gate) in favour of this dedicated trading header.
 */
export default function TradingLayout({ children }: { children: ReactNode }) {
    return (
        <div className="wt-root">
            <TradingHeader />
            {children}
        </div>
    );
}
