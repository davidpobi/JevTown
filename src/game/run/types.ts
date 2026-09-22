export type BattlerId = "blue" | "yellow";
export type GameMode = "extraction" | "signal-hunt";
export type GameDifficulty = "standard" | "hard";

export type JevTactic =
  | "GET_KEY_FAST"
  | "GET_KEY_SAFE"
  | "GO_EXIT_FAST"
  | "GO_EXIT_SAFE"
  | "CAPTURE_SIGNAL_FAST"
  | "CAPTURE_SIGNAL_SAFE"
  | "EXPLORE_FAST"
  | "EXPLORE_SAFE"
  | "CHASE_RIVAL";

export type RpsMove = "ROCK" | "PAPER" | "SCISSORS";

export type Point = { x: number; y: number };
export type Frontier = { id: string; corridor: string; distance: number; rivalDistance: number; visits: number };
export type CandidatePlan = { id: string; tactic: JevTactic; frontierId?: string; target: string; steps: number; rivalDistance: number; informationGain: number };

export type Maze = {
  width: number;
  height: number;
  walls: boolean[][];
  seed: string;
  corridorByCell: string[][];
};

export type RouteHistory = {
  visits: Record<string, number>;
  transitions: Record<string, number>;
  recentCorridors: string[];
  keyEvents: number;
  encounters: number;
};

export type Battler = {
  id: BattlerId;
  position: Point;
  previousPosition: Point;
  path: Point[];
  tactic: JevTactic | null;
  confidence: number | null;
  history: RouteHistory;
};

export type Match = {
  mode: GameMode;
  difficulty: GameDifficulty;
  maze: Maze;
  blue: Battler;
  yellow: Battler;
  key: Point;
  exit: Point;
  keyHolder: BattlerId | null;
  knownCells: Record<BattlerId, Record<string, true>>;
  knownKeys: Record<BattlerId, boolean>;
  knownExits: Record<BattlerId, boolean>;
  signals: Point[];
  knownSignals: Record<BattlerId, Record<string, true>>;
  capturedSignals: Record<BattlerId, string[]>;
  elapsedMs: number;
  status: "waiting" | "running" | "clash" | "paused" | "finished";
  clash: { cell: Point; blueTarget: Point; yellowTarget: Point } | null;
  error: string | null;
  winner: BattlerId | null;
};

export type DecisionSnapshot = {
  battler: BattlerId;
  self: { position: Point; corridor: string; hasKey: boolean; routeHistory: RouteHistory };
  rival: { position: Point; corridor: string; hasKey: boolean; routeHistory: RouteHistory };
  objectives: { mode: GameMode; difficulty: GameDifficulty; key: Point | null; keyKnown: boolean; exit: Point | null; exitUnlocked: boolean; exitKnown: boolean; signals: Array<{ id: string; position: Point }>; capturedSignals: number; signalGoal: number; knownCellCount: number; frontierCorridors: string[] };
  frontiers: Frontier[];
  plans: CandidatePlan[];
  legalTactics: JevTactic[];
};

export type JevDecision = { battler: BattlerId; tactic: JevTactic; frontierId?: string; confidence: number };
export type ClashThrow = { battler: BattlerId; move: RpsMove; confidence: number };
export type ClashResult = { throws: [ClashThrow, ClashThrow]; winner: BattlerId | null };

