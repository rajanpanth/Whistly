import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Portfolio | Whistly",
    description: "Track your active positions, P&L, voting history, and claimable rewards on Whistly.",
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
