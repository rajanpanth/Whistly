import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Open Orders",
    description: "View and cancel your resting orders across all markets.",
};

export default function Layout({ children }: { children: ReactNode }) {
    return children;
}
