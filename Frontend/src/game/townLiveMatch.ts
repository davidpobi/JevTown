import { createTown } from "./town";
import type { Explorer, Town } from "./types";
import type {
  HuntLiveEventKind,
  LiveHuntMatchState,
  LiveHuntExplorerState,
} from "../interfaces/huntLiveMatch";

const toExplorerState = (explorer: Explorer): LiveHuntExplorerState => ({
  position: explorer.position,
  path: explorer.path.slice(0, 16),
  tactic: explorer.tactic,
  confidence: explorer.confidence,
  treasureCount: explorer.treasures.length,
});

const fromExplorerState = (
  explorer: Explorer,
  state: LiveHuntExplorerState,
): Explorer => ({
  ...explorer,
  position: state.position,
  path: state.path,
  tactic: state.tactic,
  confidence: state.confidence,
  treasures: explorer.treasures.slice(0, state.treasureCount),
});

export const toLiveHuntMatchState = (
  town: Town,
  version: number,
  latestEvent: { kind: HuntLiveEventKind; message: string },
): LiveHuntMatchState => ({
  matchId: town.seed,
  seed: town.seed,
  difficulty: town.difficulty,
  version,
  status: town.status,
  elapsed: town.elapsed,
  blue: toExplorerState(town.blue),
  yellow: toExplorerState(town.yellow),
  winner: town.winner,
  lastEncounter: town.lastEncounter,
  latestEvent,
  updatedAt: Date.now(),
});

export const fromLiveHuntMatchState = (state: LiveHuntMatchState): Town => {
  const town = createTown(state.seed, state.difficulty);

  return {
    ...town,
    status: state.status,
    elapsed: state.elapsed,
    winner: state.winner,
    lastEncounter: state.lastEncounter,
    blue: fromExplorerState(town.blue, state.blue),
    yellow: fromExplorerState(town.yellow, state.yellow),
  };
};
