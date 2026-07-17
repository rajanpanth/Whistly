import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Markets",
    description: "Browse every open World Cup prediction market — filter by trending, live, upcoming, and recently settled.",
};

export default function Layout({ children }: { children: ReactNode }) {
    return children;
}
