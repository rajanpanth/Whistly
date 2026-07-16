"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

// Hide the global footer on V2 trading routes (they own their chrome).
// Kept inline (not a shared import) to avoid a Turbopack bundling edge case.
const TRADING_ROUTE_RE = /^\/(markets|market\/|event\/|positions|orders)/;

export default function ConditionalFooter() {
    const pathname = usePathname();
    if (pathname && TRADING_ROUTE_RE.test(pathname)) return null;
    return <Footer />;
}
