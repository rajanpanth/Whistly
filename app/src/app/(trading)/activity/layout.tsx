import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activity Feed",
  description:
    "Live feed of poll creations, votes, and settlements across Whistly.",
  openGraph: {
    title: "Activity Feed | Whistly",
    description: "Live feed of poll creations, votes, and settlements.",
  },
};

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
