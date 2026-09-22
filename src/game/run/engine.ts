import { getNeighbors, placeMatchObjects, placeSignals, generateMaze } from "./maze";
import type { Battler, BattlerId, CandidatePlan, ClashResult, DecisionSnapshot, Frontier, GameDifficulty, GameMode, JevDecision, JevTactic, Match, Maze, Point, RouteHistory } from "./types";

const pointKey = (point: Point) => `${point.x},${point.y}`;
const samePoint = (left: Point, right: Point) => left.x === right.x && left.y === right.y;
const emptyHistory = (): RouteHistory => ({ visits: {}, transitions: {}, recentCorridors: [], keyEvents: 0, encounters: 0 });
const createBattler = (id: BattlerId, position: Point): Battler => ({ id, position, previousPosition: position, path: [], tactic: null, confidence: null, history: emptyHistory() });

const visibleCells = (maze: Maze, origin: Point, maximumDistance = 4) => {
  const cells: Point[] = [];
  const queue: Array<{ point: Point; distance: number }> = [{ point: origin, distance: 0 }];
  const visited = new Set([pointKey(origin)]);
  while (queue.length) {
    const current = queue.shift()!;
    cells.push(current.point);
    if (current.distance === maximumDistance) continue;
    getNeighbors(maze, current.point).forEach((neighbor) => {
      if (!visited.has(pointKey(neighbor))) { visited.add(pointKey(neighbor)); queue.push({ point: neighbor, distance: current.distance + 1 }); }
    });
  }
  return cells;
};

const discoveryRadius = (difficulty: GameDifficulty) => difficulty === "hard" ? 2 : 4;

const reveal = (maze: Maze, known: Record<string, true>, position: Point, difficulty: GameDifficulty) => {
  const next = { ...known };
  visibleCells(maze, position, discoveryRadius(difficulty)).forEach((cell) => { next[pointKey(cell)] = true; });
  return next;
};

export const createMatch = (seed: string, mode: GameMode = "extraction", difficulty: GameDifficulty = "standard"): Match => {
  const maze = generateMaze(seed, difficulty === "hard" ? 31 : 21, difficulty === "hard" ? 21 : 15);
  const placed = placeMatchObjects(maze, difficulty);
  const blueKnown = reveal(maze, {}, placed.blue, difficulty);
  const yellowKnown = reveal(maze, {}, placed.yellow, difficulty);
  const signals = mode === "signal-hunt" ? placeSignals(maze) : [];
  return {
    mode,
    difficulty,
    maze,
    blue: createBattler("blue", placed.blue),
    yellow: createBattler("yellow", placed.yellow),
    key: placed.key,
    exit: placed.exit,
    keyHolder: null,
    knownCells: { blue: blueKnown, yellow: yellowKnown },
    knownKeys: { blue: mode === "extraction" && Boolean(blueKnown[pointKey(placed.key)]), yellow: mode === "extraction" && Boolean(yellowKnown[pointKey(placed.key)]) },
    knownExits: { blue: mode === "extraction" && Boolean(blueKnown[pointKey(placed.exit)]), yellow: mode === "extraction" && Boolean(yellowKnown[pointKey(placed.exit)]) },
    signals,
    knownSignals: { blue: Object.fromEntries(signals.flatMap((signal, index) => blueKnown[pointKey(signal)] ? [[`S${index + 1}`, true]] : [])), yellow: Object.fromEntries(signals.flatMap((signal, index) => yellowKnown[pointKey(signal)] ? [[`S${index + 1}`, true]] : [])) },
    capturedSignals: { blue: [], yellow: [] },
    elapsedMs: 0,
    status: "waiting",
    clash: null,
    error: null,
    winner: null,
  };
};

type QueueItem = { point: Point; score: number; cost: number; path: Point[] };
const heuristic = (left: Point, right: Point) => Math.abs(left.x - right.x) + Math.abs(left.y - right.y);

export const findPath = (maze: Maze, start: Point, target: Point, rival: Point, safe: boolean): Point[] => {
  const queue: QueueItem[] = [{ point: start, score: heuristic(start, target), cost: 0, path: [] }];
  const costs = new Map([[pointKey(start), 0]]);
  while (queue.length) {
    queue.sort((left, right) => left.score - right.score);
    const current = queue.shift()!;
    if (samePoint(current.point, target)) return current.path;
    for (const neighbor of getNeighbors(maze, current.point)) {
      const rivalDistance = heuristic(neighbor, rival);
      const safetyCost = safe && rivalDistance < 5 ? (5 - rivalDistance) * 3 : 0;
      const cost = current.cost + 1 + safetyCost;
      const key = pointKey(neighbor);
      if (cost >= (costs.get(key) ?? Infinity)) continue;
      costs.set(key, cost);
      queue.push({ point: neighbor, cost, score: cost + heuristic(neighbor, target), path: [...current.path, neighbor] });
    }
  }
  return [];
};

export const legalTactics = (match: Match, battler: Battler): JevTactic[] => {
  if (match.mode === "signal-hunt") {
    const knownUncaptured = match.signals.some((_, index) => match.knownSignals[battler.id][`S${index + 1}`] && !match.capturedSignals[battler.id].includes(`S${index + 1}`));
    return knownUncaptured ? ["CAPTURE_SIGNAL_FAST", "CAPTURE_SIGNAL_SAFE", "EXPLORE_SAFE"] : ["EXPLORE_FAST", "EXPLORE_SAFE"];
  }
  if (match.keyHolder === battler.id) return match.knownExits[battler.id]
    ? ["GO_EXIT_FAST", "GO_EXIT_SAFE"]
    : ["EXPLORE_FAST", "EXPLORE_SAFE"];
  if (match.keyHolder) return ["EXPLORE_FAST", "EXPLORE_SAFE", "CHASE_RIVAL"];
  return match.knownKeys[battler.id]
    ? ["GET_KEY_FAST", "GET_KEY_SAFE", "EXPLORE_SAFE"]
    : ["EXPLORE_FAST", "EXPLORE_SAFE"];
};

const knownFrontiers = (match: Match, battler: Battler, rival: Battler): Array<Frontier & { point: Point }> => {
  const known = match.knownCells[battler.id];
  return Object.keys(known).map((key) => key.split(",").map(Number)).map(([x, y]) => ({ x, y }))
    .filter((point) => getNeighbors(match.maze, point).some((neighbor) => !known[pointKey(neighbor)]))
    .sort((left, right) => left.y - right.y || left.x - right.x)
    .slice(0, 6)
    .map((point, index) => {
      const corridor = match.maze.corridorByCell[point.y][point.x];
      return {
        id: `F${index + 1}`,
        point,
        corridor,
        distance: findPath(match.maze, battler.position, point, rival.position, false).length,
        rivalDistance: Math.abs(point.x - rival.position.x) + Math.abs(point.y - rival.position.y),
        visits: battler.history.visits[corridor] ?? 0,
      };
    });
};

const targetFor = (match: Match, battler: Battler, rival: Battler, decision: JevDecision): Point | null => {
  if (decision.tactic.startsWith("CAPTURE_SIGNAL")) {
    const signal = match.signals.find((point, index) => match.knownSignals[battler.id][`S${index + 1}`] && !match.capturedSignals[battler.id].includes(`S${index + 1}`));
    return signal ?? null;
  }
  if (decision.tactic.startsWith("GET_KEY")) return match.key;
  if (decision.tactic.startsWith("GO_EXIT") && match.knownExits[battler.id]) return match.exit;
  if (decision.tactic.startsWith("EXPLORE")) return knownFrontiers(match, battler, rival).find((frontier) => frontier.id === decision.frontierId)?.point ?? null;
  return rival.position;
};

// Exploration is a bounded scout route, not a single hesitant tile. Jev picks
// the frontier and tactic; the engine continues through legal adjacent cells.
// That keeps decisions strategic while giving a larger maze appropriately
// longer, visible routes at the same movement pace.
const explorationPath = (match: Match, battler: Battler, rival: Battler, frontier: Point, safe: boolean) => {
  const route = findPath(match.maze, battler.position, frontier, rival.position, safe);
  const traversed = new Set([pointKey(battler.position), ...route.map(pointKey)]);
  const maximumSteps = match.difficulty === "hard" ? 8 : 4;
  let current = route.at(-1) ?? battler.position;

  while (route.length < maximumSteps) {
    const candidates = getNeighbors(match.maze, current)
      .filter((candidate) => !traversed.has(pointKey(candidate)))
      .sort((left, right) => {
        const leftUnknown = match.knownCells[battler.id][pointKey(left)] ? 1 : 0;
        const rightUnknown = match.knownCells[battler.id][pointKey(right)] ? 1 : 0;
        if (leftUnknown !== rightUnknown) return leftUnknown - rightUnknown;
        const leftRivalDistance = heuristic(left, rival.position);
        const rightRivalDistance = heuristic(right, rival.position);
        if (safe && leftRivalDistance !== rightRivalDistance) return rightRivalDistance - leftRivalDistance;
        if (!safe && leftRivalDistance !== rightRivalDistance) return leftRivalDistance - rightRivalDistance;
        return left.y - right.y || left.x - right.x;
      });
    const next = candidates[0];
    if (!next) break;
    route.push(next);
    traversed.add(pointKey(next));
    current = next;
  }

  return route;
};

const candidatePlans = (match: Match, battler: Battler, rival: Battler, frontiers: Array<Frontier & { point: Point }>): CandidatePlan[] => {
  const plans: CandidatePlan[] = [];
  for (const tactic of legalTactics(match, battler)) {
    if (tactic.startsWith("EXPLORE")) {
      const ordered = [...frontiers].sort((left, right) => tactic.endsWith("SAFE")
        ? right.rivalDistance - left.rivalDistance || left.distance - right.distance
        : left.distance - right.distance || right.rivalDistance - left.rivalDistance).slice(0, 2);
      ordered.forEach((frontier) => {
        const route = explorationPath(match, battler, rival, frontier.point, tactic.endsWith("SAFE"));
        plans.push({ id: `${tactic}:${frontier.id}`, tactic, frontierId: frontier.id, target: frontier.corridor, steps: route.length, rivalDistance: frontier.rivalDistance, informationGain: Math.max(1, 8 - frontier.visits) });
      });
      continue;
    }
    const target = targetFor(match, battler, rival, { battler: battler.id, tactic, confidence: 1 });
    if (!target) continue;
    const path = findPath(match.maze, battler.position, target, rival.position, tactic.endsWith("SAFE"));
    const label = tactic.startsWith("GET_KEY") ? "key" : tactic.startsWith("GO_EXIT") ? "gateway" : tactic.startsWith("CAPTURE_SIGNAL") ? "signal" : "rival";
    plans.push({ id: tactic, tactic, target: label, steps: path.length, rivalDistance: heuristic(target, rival.position), informationGain: 0 });
  }
  return plans.slice(0, 5);
};

const recordCorridor = (history: RouteHistory, corridor: string) => {
  const last = history.recentCorridors.at(-1);
  if (last === corridor) return history;
  const transitions = { ...history.transitions };
  if (last) transitions[`${last}>${corridor}`] = (transitions[`${last}>${corridor}`] ?? 0) + 1;
  return {
    ...history,
    visits: { ...history.visits, [corridor]: (history.visits[corridor] ?? 0) + 1 },
    transitions,
    recentCorridors: [...history.recentCorridors, corridor].slice(-3),
  };
};

const withBattler = (match: Match, id: BattlerId, battler: Battler): Match => id === "blue" ? { ...match, blue: battler } : { ...match, yellow: battler };

export const applyDecision = (match: Match, decision: JevDecision): Match => {
  const battler = match[decision.battler];
  const rival = decision.battler === "blue" ? match.yellow : match.blue;
  if (!legalTactics(match, battler).includes(decision.tactic)) return { ...match, status: "paused", error: "Jev returned an unavailable tactic." };
  const target = targetFor(match, battler, rival, decision);
  if (!target) return { ...match, status: "paused", error: "Jev returned an unavailable frontier." };
  const path = decision.tactic.startsWith("EXPLORE")
    ? explorationPath(match, battler, rival, target, decision.tactic.endsWith("SAFE"))
    : findPath(match.maze, battler.position, target, rival.position, decision.tactic.endsWith("SAFE"));
  return withBattler(match, battler.id, { ...battler, tactic: decision.tactic, confidence: decision.confidence, path });
};

export const stepMatch = (match: Match, elapsedMs: number): Match => {
  if (match.status !== "running") return match;
  const blueTarget = match.blue.path[0];
  const yellowTarget = match.yellow.path[0];
  const clashCell = blueTarget && (samePoint(blueTarget, match.yellow.position) || (yellowTarget && samePoint(blueTarget, yellowTarget)))
    ? blueTarget
    : yellowTarget && samePoint(yellowTarget, match.blue.position) ? yellowTarget : null;
  if (clashCell) {
    return {
      ...match,
      status: "clash",
      clash: { cell: clashCell, blueTarget: blueTarget ?? match.blue.position, yellowTarget: yellowTarget ?? match.yellow.position },
      blue: { ...match.blue, history: { ...match.blue.history, encounters: match.blue.history.encounters + 1 } },
      yellow: { ...match.yellow, history: { ...match.yellow.history, encounters: match.yellow.history.encounters + 1 } },
    };
  }
  let next = { ...match, elapsedMs: match.elapsedMs + elapsedMs };
  for (const id of ["blue", "yellow"] as BattlerId[]) {
    const battler = next[id];
    const rival = id === "blue" ? next.yellow : next.blue;
    const nextPosition = battler.path[0];
    if (!nextPosition || samePoint(nextPosition, rival.position)) continue;
    const corridor = next.maze.corridorByCell[nextPosition.y][nextPosition.x];
    const moved = { ...battler, previousPosition: battler.position, position: nextPosition, path: battler.path.slice(1), history: recordCorridor(battler.history, corridor) };
    next = withBattler(next, id, moved);
  }
  const knownCells = {
    blue: reveal(next.maze, next.knownCells.blue, next.blue.position, next.difficulty),
    yellow: reveal(next.maze, next.knownCells.yellow, next.yellow.position, next.difficulty),
  };
  next = {
    ...next,
    knownCells,
    knownKeys: { blue: next.mode === "extraction" && (next.knownKeys.blue || Boolean(knownCells.blue[pointKey(next.key)])), yellow: next.mode === "extraction" && (next.knownKeys.yellow || Boolean(knownCells.yellow[pointKey(next.key)])) },
    knownExits: { blue: next.mode === "extraction" && (next.knownExits.blue || Boolean(knownCells.blue[pointKey(next.exit)])), yellow: next.mode === "extraction" && (next.knownExits.yellow || Boolean(knownCells.yellow[pointKey(next.exit)])) },
    knownSignals: {
      blue: { ...next.knownSignals.blue, ...Object.fromEntries(next.signals.flatMap((signal, index) => knownCells.blue[pointKey(signal)] ? [[`S${index + 1}`, true]] : [])) },
      yellow: { ...next.knownSignals.yellow, ...Object.fromEntries(next.signals.flatMap((signal, index) => knownCells.yellow[pointKey(signal)] ? [[`S${index + 1}`, true]] : [])) },
    },
  };
  if (next.mode === "signal-hunt") {
    for (const id of ["blue", "yellow"] as BattlerId[]) {
      const captured = next.capturedSignals[id];
      const signalIndex = next.signals.findIndex((signal) => samePoint(next[id].position, signal) && !captured.includes(`S${next.signals.indexOf(signal) + 1}`));
      if (signalIndex >= 0) next = { ...next, capturedSignals: { ...next.capturedSignals, [id]: [...captured, `S${signalIndex + 1}`] } };
      if (next.capturedSignals[id].length === next.signals.length) return { ...next, status: "finished", winner: id };
    }
    return next;
  }
  const blueAtKey = samePoint(next.blue.position, next.key);
  const yellowAtKey = samePoint(next.yellow.position, next.key);
  if (!next.keyHolder && (blueAtKey || yellowAtKey)) {
    const id: BattlerId = blueAtKey ? "blue" : "yellow";
    const keyBattler = next[id];
    next = withBattler({ ...next, keyHolder: id }, id, { ...keyBattler, history: { ...keyBattler.history, keyEvents: keyBattler.history.keyEvents + 1 } });
  }
  if (next.keyHolder && samePoint(next[next.keyHolder].position, next.exit)) return { ...next, status: "finished", winner: next.keyHolder };
  return next;
};

export const applyClash = (match: Match, result: ClashResult): Match => {
  if (!match.clash) return match;
  const winner = result.winner;
  if (!winner) return { ...match, status: "running", clash: null, blue: { ...match.blue, position: match.blue.previousPosition, path: [] }, yellow: { ...match.yellow, position: match.yellow.previousPosition, path: [] } };
  const loser: BattlerId = winner === "blue" ? "yellow" : "blue";
  const winnerTarget = match.clash[`${winner}Target`];
  const loserBattler = match[loser];
  // A resolved clash must separate the battlers. Prefer the loser's previous
  // cell, then any legal neighbour, but never leave the loser in the square
  // awarded to the winner. Otherwise the next movement tick can trigger an
  // accidental second RPS clash.
  const yieldingPosition = [
    loserBattler.previousPosition,
    loserBattler.position,
    ...getNeighbors(match.maze, winnerTarget),
    ...getNeighbors(match.maze, loserBattler.position),
  ].find((candidate) => !samePoint(candidate, winnerTarget)) ?? loserBattler.previousPosition;
  const winningBattler = match[winner];
  const keyTransferred = Boolean(match.keyHolder && match.keyHolder !== winner);
  return {
    ...match,
    status: "running",
    clash: null,
    keyHolder: keyTransferred ? winner : match.keyHolder,
    // Both routes end here. Continuing the winner's old route can walk it
    // straight back into the yielded player and trigger another RPS round
    // before Jev has made a fresh decision.
    [winner]: { ...winningBattler, previousPosition: winningBattler.position, position: winnerTarget, path: [], history: keyTransferred ? { ...winningBattler.history, keyEvents: winningBattler.history.keyEvents + 1 } : winningBattler.history },
    [loser]: { ...loserBattler, previousPosition: loserBattler.position, position: yieldingPosition, path: [] },
  } as Match;
};

export const toSnapshot = (match: Match, id: BattlerId): DecisionSnapshot => {
  const self = match[id];
  const rival = id === "blue" ? match.yellow : match.blue;
  const corridor = match.maze.corridorByCell[self.position.y][self.position.x];
  const rivalCorridor = match.maze.corridorByCell[rival.position.y][rival.position.x];
  const known = match.knownCells[id];
  const frontiers = knownFrontiers(match, self, rival);
  const frontierCorridors = Array.from(new Set(frontiers.map((frontier) => frontier.corridor)));
  return {
    battler: id,
    self: { position: self.position, corridor, hasKey: match.keyHolder === id, routeHistory: self.history },
    rival: { position: rival.position, corridor: rivalCorridor, hasKey: match.keyHolder === rival.id, routeHistory: rival.history },
    objectives: { mode: match.mode, difficulty: match.difficulty, key: !match.keyHolder && match.knownKeys[id] ? match.key : null, keyKnown: match.knownKeys[id], exit: match.knownExits[id] ? match.exit : null, exitUnlocked: Boolean(match.keyHolder), exitKnown: match.knownExits[id], signals: match.signals.flatMap((signal, index) => match.knownSignals[id][`S${index + 1}`] && !match.capturedSignals[id].includes(`S${index + 1}`) ? [{ id: `S${index + 1}`, position: signal }] : []), capturedSignals: match.capturedSignals[id].length, signalGoal: match.signals.length, knownCellCount: Object.keys(known).length, frontierCorridors },
    frontiers: frontiers.map(({ point, ...frontier }) => {
      void point;
      return frontier;
    }),
    plans: candidatePlans(match, self, rival, frontiers),
    legalTactics: legalTactics(match, self),
  };
};
