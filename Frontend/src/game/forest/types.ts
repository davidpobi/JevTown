export type ForestId = "blue" | "yellow";
export type ForestTheme = "day" | "night";
export type ForestView = "isometric" | "plan";
export type ForestDifficulty = "standard" | "hard";
export type Point = { x: number; y: number };
export type Terrain = "trail" | "brush" | "bridge" | "water" | "ruins";
export type ForestTactic = "COLLECT_RELIC_FAST" | "COLLECT_RELIC_SAFE" | "SCOUT_FRONTIER" | "INTERCEPT_RIVAL";

export type ForestExplorer = {
  id: ForestId; position: Point; path: Point[]; tactic: ForestTactic | null;
  confidence: number | null; known: Set<string>; relics: string[];
};

export type ForestEncounter = { blueMove: "rock" | "paper" | "scissors"; yellowMove: "rock" | "paper" | "scissors"; winner: ForestId; stolenRelic: string | null; elapsed: number };

export type Forest = {
  seed: string; difficulty: ForestDifficulty; width: number; height: number;
  terrain: Terrain[][]; relics: Point[]; blue: ForestExplorer; yellow: ForestExplorer;
  status: "idle" | "running" | "finished" | "paused" | "unavailable";
  winner: ForestId | null; elapsed: number; lastEncounter: ForestEncounter | null;
};

export type ForestPlan = { id: string; tactic: ForestTactic; target: string; steps: number; exposure: number; informationGain: number; interceptValue: number };
export type ForestDecision = { battler: ForestId; planId: string; tactic: ForestTactic; target: string; confidence: number };
