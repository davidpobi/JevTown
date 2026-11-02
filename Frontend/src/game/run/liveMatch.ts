import type { LiveMatchEvent, LiveMatchState } from "@/run/interfaces/liveMatch";
import { createMatch } from "@/game/run/engine";
import type { Match } from "@/game/run/types";

const battlerState = (battler: Match["blue"]) => ({
  position: battler.position,
  path: battler.path.slice(0, 8),
  tactic: battler.tactic,
  confidence: battler.confidence,
});

export const toLiveMatchState = (
  match: Match,
  version: number,
  latestEvent: LiveMatchEvent,
): LiveMatchState => ({
  matchId: match.maze.seed,
  seed: match.maze.seed,
  mode: match.mode,
  difficulty: match.difficulty,
  version,
  status: match.status,
  elapsedMs: match.elapsedMs,
  blue: battlerState(match.blue),
  yellow: battlerState(match.yellow),
  keyHolder: match.keyHolder,
  winner: match.winner,
  latestEvent,
  updatedAt: Date.now(),
});

export const fromLiveMatchState = (state: LiveMatchState): Match => {
  const match = createMatch(state.seed, state.mode, state.difficulty);

  return {
    ...match,
    elapsedMs: state.elapsedMs,
    status: state.status,
    keyHolder: state.keyHolder,
    winner: state.winner,
    blue: {
      ...match.blue,
      position: state.blue.position,
      previousPosition: state.blue.position,
      path: state.blue.path,
      tactic: state.blue.tactic,
      confidence: state.blue.confidence,
    },
    yellow: {
      ...match.yellow,
      position: state.yellow.position,
      previousPosition: state.yellow.position,
      path: state.yellow.path,
      tactic: state.yellow.tactic,
      confidence: state.yellow.confidence,
    },
  };
};

