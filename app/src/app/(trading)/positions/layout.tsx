import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Positions",
    description: "Track your share positions, average cost, and claimable settlements.",
};

export default function Layout({ children }: { children: ReactNode }) {
    return children;
}
