import { getMockFixtures, getMockScore, type TxLineFixture, type TxLineScore } from "./mock";

const TXLINE_BASE_URL = process.env.TXLINE_BASE_URL || "";
const TXLINE_SESSION_TOKEN = process.env.TXLINE_SESSION_TOKEN || "";
const TXLINE_API_TOKEN = process.env.TXLINE_API_TOKEN || "";

export function isTxLineMockMode(): boolean {
  return process.env.TXLINE_USE_MOCK !== "false" || !TXLINE_BASE_URL;
}

export async function fetchTxLineFixtures(): Promise<TxLineFixture[]> {
  if (isTxLineMockMode()) return getMockFixtures();

  const response = await fetch(`${TXLINE_BASE_URL}/fixtures`, {
    headers: txLineHeaders(),
    next: { revalidate: 5 },
  });
  if (!response.ok) {
    throw new Error(`TxLINE fixtures request failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchTxLineScore(fixtureId: string): Promise<TxLineScore> {
  if (isTxLineMockMode()) return getMockScore(fixtureId);

  const response = await fetch(`${TXLINE_BASE_URL}/scores/${fixtureId}`, {
    headers: txLineHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`TxLINE score request failed: ${response.status}`);
  }
  return response.json();
}

function txLineHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (TXLINE_SESSION_TOKEN) headers["x-session-token"] = TXLINE_SESSION_TOKEN;
  if (TXLINE_API_TOKEN) headers.authorization = `Bearer ${TXLINE_API_TOKEN}`;
  return headers;
}
