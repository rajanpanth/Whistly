import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Event Markets",
    description: "All prediction markets for this World Cup fixture.",
};

export default function Layout({ children }: { children: ReactNode }) {
    return children;
}
