"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";
import { isTradingRoute } from "@/lib/routes";

// Hide the global footer on V2 trading routes (they own their chrome).
export default function ConditionalFooter() {
    const pathname = usePathname();
    if (isTradingRoute(pathname)) return null;
    return <Footer />;
}
