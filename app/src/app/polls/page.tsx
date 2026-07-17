import { redirect } from "next/navigation";

/**
 * /polls has no standalone index — polls are browsed from the homepage.
 * Redirect instead of 404 for anyone who types the URL or follows an old link.
 */
export default function PollsIndexPage() {
    redirect("/");
}
