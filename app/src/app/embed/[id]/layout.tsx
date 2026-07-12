import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Whistly Poll Embed",
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  // Minimal layout — no navbar, no padding
  return <>{children}</>;
}
