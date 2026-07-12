import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "See the top predictors on Whistly. Weekly, monthly, and all-time rankings by winnings.",
  openGraph: {
    title: "Leaderboard | Whistly",
    description: "See the top predictors. Weekly, monthly, and all-time rankings.",
  },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
