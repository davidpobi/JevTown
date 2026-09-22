import type { BattlerId, GameDifficulty, GameMode } from "@/game/run/types";
import type { LiveMatchState } from "@/run/interfaces/liveMatch";

export interface ReplaySummary {
  matchId: string;
  seed: string;
  mode: GameMode;
  difficulty: GameDifficulty;
  winner: BattlerId;
  startedAt: number;
  finishedAt: number;
  eventCount: number;
}

export interface MatchReplay extends ReplaySummary {
  events: LiveMatchState[];
}

