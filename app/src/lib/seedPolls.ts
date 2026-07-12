/**
 * World Cup demo polls shown when the database has no real data.
 * These are automatically hidden once real polls exist.
 */
import { type DemoPoll, PollStatus } from "@/lib/types";

const now = Math.floor(Date.now() / 1000);
const DAY = 86_400;
const HOUR = 3_600;
const LAMPORT = 1_000_000_000; // 1 SOL in lamports

function seed(partial: Partial<DemoPoll> & Pick<DemoPoll, "title" | "options">): DemoPoll {
  const optionCount = partial.options.length;
  const stableId = partial.title.replace(/\s+/g, "-").toLowerCase().slice(0, 30);
  const stableHash = Array.from(stableId).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0) >>> 0;
  return {
    id: `seed-${stableId}`,
    pollId: stableHash % 100000,
    creator: "demo",
    description: partial.description ?? "",
    imageUrl: "",
    optionImages: [],
    voteCounts: partial.voteCounts ?? new Array(optionCount).fill(0).map((_, i) => ((stableHash * (i + 1) * 7) % 75) + 5),
    unitPriceLamports: partial.unitPriceLamports ?? 0.01 * LAMPORT,
    endTime: partial.endTime ?? now + 7 * DAY,
    totalPoolLamports: partial.totalPoolLamports ?? Math.floor(((stableHash % 50) / 10 + 0.5) * LAMPORT),
    creatorInvestmentLamports: 0,
    platformFeeLamports: 0,
    creatorRewardLamports: 0,
    status: partial.status ?? PollStatus.Active,
    winningOption: partial.winningOption ?? 255,
    totalVoters: partial.totalVoters ?? ((stableHash % 50) + 10),
    createdAt: partial.createdAt ?? now - ((stableHash % 3) + 1) * DAY,
    category: "World Cup",
    ...partial,
  };
}

export const SEED_POLLS: DemoPoll[] = [
  seed({
    title: "Who will win the 2026 FIFA World Cup?",
    description: "The 2026 FIFA World Cup is hosted across USA, Canada, and Mexico. Pick the team that lifts the trophy.",
    options: ["Brazil", "France", "Argentina", "England", "Spain", "Other"],
    voteCounts: [118, 104, 96, 73, 67, 42],
    totalVoters: 500,
    totalPoolLamports: Math.floor(31.2 * LAMPORT),
    endTime: now + 90 * DAY,
    createdAt: now - 5 * DAY,
  }),
  seed({
    title: "Will Argentina reach the World Cup final?",
    description: "Predict whether Argentina plays in the final match of the 2026 tournament.",
    options: ["Yes", "No"],
    voteCounts: [121, 88],
    totalVoters: 209,
    totalPoolLamports: Math.floor(14.4 * LAMPORT),
    endTime: now + 45 * DAY,
    createdAt: now - 8 * HOUR,
  }),
  seed({
    title: "Will Brazil score 3+ goals in its opener?",
    description: "Resolves yes if Brazil scores at least three goals in its first World Cup 2026 match.",
    options: ["Yes", "No"],
    voteCounts: [75, 91],
    totalVoters: 166,
    totalPoolLamports: Math.floor(9.8 * LAMPORT),
    endTime: now + 12 * DAY,
    createdAt: now - 1 * DAY,
  }),
  seed({
    title: "Golden Boot winner region",
    description: "Which region will the tournament's top scorer represent?",
    options: ["Europe", "South America", "Africa", "North America", "Other"],
    voteCounts: [132, 74, 44, 28, 15],
    totalVoters: 293,
    totalPoolLamports: Math.floor(16.7 * LAMPORT),
    endTime: now + 70 * DAY,
    createdAt: now - 2 * DAY,
  }),
  seed({
    title: "Will the host nations combine for 2 knockout wins?",
    description: "USA, Canada, and Mexico must record at least two combined wins after the group stage.",
    options: ["Yes", "No"],
    voteCounts: [58, 79],
    totalVoters: 137,
    totalPoolLamports: Math.floor(7.1 * LAMPORT),
    endTime: now + 60 * DAY,
    createdAt: now - 10 * HOUR,
  }),
  seed({
    title: "Will England win its group?",
    description: "Predict whether England finishes top of its World Cup group.",
    options: ["Yes", "No"],
    voteCounts: [96, 61],
    totalVoters: 157,
    totalPoolLamports: Math.floor(10.3 * LAMPORT),
    endTime: now + 25 * DAY,
    createdAt: now - 2 * DAY,
  }),
  seed({
    title: "World Cup final total goals",
    description: "How many goals will be scored in regulation plus extra time in the final? Penalties do not count.",
    options: ["0-1", "2", "3", "4+"],
    voteCounts: [21, 84, 76, 49],
    totalVoters: 230,
    totalPoolLamports: Math.floor(12.6 * LAMPORT),
    endTime: now + 110 * DAY,
    createdAt: now - 3 * DAY,
  }),
  seed({
    title: "Will any semifinal go to penalties?",
    description: "Resolves yes if either semifinal is decided by a penalty shootout.",
    options: ["Yes", "No"],
    voteCounts: [64, 70],
    totalVoters: 134,
    totalPoolLamports: Math.floor(6.9 * LAMPORT),
    endTime: now + 85 * DAY,
    createdAt: now - 15 * HOUR,
  }),
  seed({
    title: "Will a CONCACAF team reach the quarterfinals?",
    description: "Predict whether any CONCACAF nation reaches the last eight.",
    options: ["Yes", "No"],
    voteCounts: [82, 57],
    totalVoters: 139,
    totalPoolLamports: Math.floor(8.4 * LAMPORT),
    endTime: now + 50 * DAY,
    createdAt: now - 1 * DAY,
  }),
  seed({
    title: "First red card before matchday 3?",
    description: "Resolves yes if any player receives a red card before the end of the second matchday.",
    options: ["Yes", "No"],
    voteCounts: [71, 46],
    totalVoters: 117,
    totalPoolLamports: Math.floor(5.2 * LAMPORT),
    endTime: now + 8 * DAY,
    createdAt: now - 4 * HOUR,
  }),
  seed({
    title: "Will Spain keep 3 clean sheets?",
    description: "Predict whether Spain records at least three shutouts during the tournament.",
    options: ["Yes", "No"],
    voteCounts: [54, 63],
    totalVoters: 117,
    totalPoolLamports: Math.floor(4.7 * LAMPORT),
    endTime: now + 55 * DAY,
    createdAt: now - 6 * HOUR,
  }),
  seed({
    title: "Will the final be Europe vs South America?",
    description: "Resolves yes if one finalist is European and the other is South American.",
    options: ["Yes", "No"],
    voteCounts: [99, 52],
    totalVoters: 151,
    totalPoolLamports: Math.floor(11.1 * LAMPORT),
    endTime: now + 100 * DAY,
    createdAt: now - 2 * DAY,
  }),
];
