import type { ExplorerId, TownDifficulty } from "@/game/types";
import type { LiveHuntMatchState } from "@/interfaces/huntLiveMatch";

export interface HuntReplaySummary {
  matchId: string;
  seed: string;
  difficulty: TownDifficulty;
  winner: ExplorerId;
  startedAt: number;
  finishedAt: number;
  eventCount: number;
}

export interface HuntReplay extends HuntReplaySummary {
  events: LiveHuntMatchState[];
}
