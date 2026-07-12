export type TxLineGoalPressure = {
  fixtureId: string;
  impliedGoalChance: number;
  pressureLabel: "low" | "medium" | "high";
};

export function mockGoalPressure(fixtureId: string, yesPool: number, noPool: number): TxLineGoalPressure {
  const total = yesPool + noPool;
  const impliedGoalChance = total > 0 ? Math.round((yesPool / total) * 100) : 50;
  const pressureLabel = impliedGoalChance >= 60 ? "high" : impliedGoalChance >= 35 ? "medium" : "low";

  return {
    fixtureId,
    impliedGoalChance,
    pressureLabel,
  };
}
