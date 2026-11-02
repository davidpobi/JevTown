import type {
  Encounter,
  Explorer,
  ExplorerId,
  Point,
  Town,
  TownDifficulty,
} from "@/game/types";

export type HuntLiveEventKind =
  | "ready"
  | "started"
  | "decision"
  | "clash"
  | "treasure"
  | "finished"
  | "paused";

export interface LiveHuntExplorerState {
  position: Point;
  path: Point[];
  tactic: Explorer["tactic"];
  confidence: number | null;
  treasureCount: number;
}

export interface LiveHuntMatchState {
  matchId: string;
  seed: string;
  difficulty: TownDifficulty;
  version: number;
  status: Town["status"];
  elapsed: number;
  blue: LiveHuntExplorerState;
  yellow: LiveHuntExplorerState;
  winner: ExplorerId | null;
  lastEncounter: Encounter | null;
  latestEvent: {
    kind: HuntLiveEventKind;
    message: string;
  };
  updatedAt: number;
}

export interface PublishLiveHuntRequest {
  state: LiveHuntMatchState;
}
