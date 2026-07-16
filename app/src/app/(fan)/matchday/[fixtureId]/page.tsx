import MatchdayExperience from "../../MatchdayExperience";

export default async function MatchdayFixturePage({ params }: { params: Promise<{ fixtureId: string }> }) {
    const { fixtureId } = await params;
    return <MatchdayExperience fixtureId={fixtureId} />;
}
