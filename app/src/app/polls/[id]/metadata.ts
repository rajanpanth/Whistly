import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  // Build dynamic OG image URL with poll ID as params
  // The actual data is baked into the URL at share time via ShareButton
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://instinctfi.com";
  const ogImageUrl = `${baseUrl}/api/og?title=${encodeURIComponent(`Poll on Whistly`)}&category=Prediction&status=active`;

  return {
    title: `Poll ${id} — Whistly`,
    description: "Vote on this prediction poll on Whistly. Buy option-coins, pick a side, and win the losing pool!",
    openGraph: {
      title: `Poll on Whistly`,
      description: "Vote on this prediction poll. Buy option-coins, pick a side, and win the losing pool!",
      type: "website",
      siteName: "Whistly",
      url: `${baseUrl}/polls/${id}`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: "Whistly Prediction Poll",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Poll on Whistly`,
      description: "Vote on this prediction poll. Buy option-coins, pick a side, and win!",
      images: [ogImageUrl],
    },
  };
}
