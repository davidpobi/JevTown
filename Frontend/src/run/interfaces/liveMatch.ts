import type {
  BattlerId,
  GameDifficulty,
  GameMode,
  JevTactic,
  Match,
  Point,
} from "@/game/run/types";

export type LiveMatchEventKind =
  | "ready"
  | "started"
  | "decision"
  | "clash"
  | "key"
  | "finished"
  | "paused";

export interface LiveBattlerState {
  position: Point;
  path: Point[];
  tactic: JevTactic | null;
  confidence: number | null;
}

export interface LiveMatchEvent {
  kind: LiveMatchEventKind;
  message: string;
}

export interface LiveMatchState {
  matchId: string;
  seed: string;
  mode: GameMode;
  difficulty: GameDifficulty;
  version: number;
  status: Match["status"];
  elapsedMs: number;
  blue: LiveBattlerState;
  yellow: LiveBattlerState;
  keyHolder: BattlerId | null;
  winner: BattlerId | null;
  latestEvent: LiveMatchEvent;
  updatedAt: number;
}

export interface PublishLiveMatchRequest {
  state: LiveMatchState;
}

