export type ExplorerId = "blue" | "yellow";
export type TownDifficulty = "standard" | "hard";

export type Point = { x: number; y: number };

export type Tactic =
  | "EXPLORE_FAST"
  | "EXPLORE_SAFE"
  | "COLLECT_TREASURE_FAST"
  | "COLLECT_TREASURE_SAFE"
  | "CHASE_RIVAL";

export type Explorer = {
  id: ExplorerId;
  position: Point;
  path: Point[];
  tactic: Tactic | null;
  confidence: number | null;
  known: Set<string>;
  treasures: string[];
};

export type RpsMove = "rock" | "paper" | "scissors";

export type Encounter = {
  blueMove: RpsMove;
  yellowMove: RpsMove;
  winner: ExplorerId;
  stolenTreasure: string | null;
  rounds: number;
  elapsed: number;
};

export type Town = {
  seed: string;
  difficulty: TownDifficulty;
  width: number;
  height: number;
  blocked: boolean[][];
  treasures: Point[];
  blue: Explorer;
  yellow: Explorer;
  status: "idle" | "running" | "finished" | "paused";
  winner: ExplorerId | null;
  elapsed: number;
  lastEncounter: Encounter | null;
};

export type Decision = {
  battler: ExplorerId;
  tactic: Tactic;
  target?: string;
  confidence: number;
};
