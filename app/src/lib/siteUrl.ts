/**
 * Single source of truth for the site's canonical base URL.
 * Used by metadata, sitemap, robots, OG links, and referral links so they
 * can never drift onto different domains again.
 */
export function getSiteUrl(): string {
    return (
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "https://whistly.tech"
    );
}
