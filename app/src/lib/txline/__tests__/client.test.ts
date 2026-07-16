import { fetchTxLineHistoricalScores, fetchTxLineScore } from "../client";

const previousToken = process.env.TXLINE_API_TOKEN;
const previousJwt = process.env.TXLINE_GUEST_JWT;
const previousFetch = globalThis.fetch;

function mockFetch(payload: unknown) {
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload } as Response);
}

describe("TxLINE score normalization", () => {
  beforeEach(() => {
    process.env.TXLINE_API_TOKEN = "test-token";
    process.env.TXLINE_GUEST_JWT = "test-jwt";
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (previousFetch === undefined) delete (globalThis as { fetch?: typeof fetch }).fetch;
    else globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.TXLINE_API_TOKEN;
    else process.env.TXLINE_API_TOKEN = previousToken;
    if (previousJwt === undefined) delete process.env.TXLINE_GUEST_JWT;
    else process.env.TXLINE_GUEST_JWT = previousJwt;
  });

  test("uses cumulative Total once and reconstructs a goal event and clock", async () => {
    const packets = [
      {
        id: 1, seq: 1, ts: 1_784_000_000_000, gameState: "H1", participant1IsHome: true,
        clock: { seconds: 1_200 }, dataSoccer: { Goal: false, Participant: 1 },
        scoreSoccer: {
          Participant1: { H1: { Goals: 0 }, HT: { Goals: 0 }, Total: { Goals: 0 } },
          Participant2: { H1: { Goals: 0 }, HT: { Goals: 0 }, Total: { Goals: 0 } },
        },
      },
      {
        id: 2, seq: 2, ts: 1_784_000_010_000, gameState: "H1", participant1IsHome: true,
        clock: { seconds: 1_234 }, dataSoccer: { Goal: true, Participant: 1 },
        scoreSoccer: {
          Participant1: { H1: { Goals: 1 }, HT: { Goals: 1 }, Total: { Goals: 1 } },
          Participant2: { H1: { Goals: 0 }, HT: { Goals: 0 }, Total: { Goals: 0 } },
        },
      },
    ];
    mockFetch(packets);
    const { score, source } = await fetchTxLineScore("fixture-1");
    expect(source).toBe("txline");
    expect(score).toMatchObject({ homeScore: 1, awayScore: 0, clockSeconds: 1_234, status: "LIVE" });
    expect(score.events).toEqual([{ id: "2", type: "GOAL", clockSeconds: 1_234, team: "HOME", scoreAfter: "1-0" }]);
  });

  test("maps postponed provider state to a non-live status", async () => {
    const packet = {
      id: 3, seq: 3, ts: 1_784_000_000_000, gameState: "P", participant1IsHome: true,
      scoreSoccer: { Participant1: { Total: { Goals: 0 } }, Participant2: { Total: { Goals: 0 } } },
    };
    mockFetch([packet]);
    expect((await fetchTxLineScore("fixture-2")).score.status).toBe("POSTPONED");
  });

  test("parses the historical endpoint's event-stream and Stats schema", async () => {
    const lines = [
      { FixtureId: 9, GameState: "scheduled", Participant1IsHome: true, Action: "clock", Id: 10, Ts: 1_784_000_000_000, Seq: 10, Clock: { Seconds: 600 }, Data: {}, Stats: { "1": 0, "2": 0 } },
      { FixtureId: 9, GameState: "scheduled", Participant1IsHome: true, Action: "possible", Id: 11, Ts: 1_784_000_010_000, Seq: 11, Clock: { Seconds: 650 }, Data: { Goal: true }, Participant: 1, Stats: { "1": 1, "2": 0 } },
      { FixtureId: 9, GameState: "scheduled", Participant1IsHome: true, Action: "disconnected", Id: 12, Ts: 1_784_000_020_000, Seq: 12, Data: {}, Stats: { "1": 1, "2": 0 } },
    ];
    const body = lines.map((line) => `data: ${JSON.stringify(line)}\n\n`).join("");
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => body } as Response);
    const replay = await fetchTxLineHistoricalScores("9");
    expect(replay.source).toBe("txline");
    expect(replay.points).toHaveLength(3);
    expect(replay.points[1]).toMatchObject({ sequence: 11, clockSeconds: 650, homeScore: 1, awayScore: 0, isGoal: true });
    expect(replay.points[2]).toMatchObject({ sequence: 12, clockSeconds: 650, isGoal: false });
  });
});
