"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isFanRoute } from "@/lib/routes";

export default function ConditionalPageShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    if (isFanRoute(pathname)) {
        return <div className="fan-app-host">{children}</div>;
    }
    // Keep this element and class string byte-for-byte equivalent to the
    // frozen homepage shell so route isolation cannot change `/` visually.
    return <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-12 lg:py-6 mobile-content-pad">{children}</main>;
}
