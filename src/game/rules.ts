import type {
  Decision,
  Encounter,
  Explorer,
  ExplorerId,
  Point,
  RpsMove,
  Town,
} from "./types";
import { pointKey } from "./town";

const directions: readonly Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const explorerIds: readonly ExplorerId[] = ["blue", "yellow"];
const rpsMoves: readonly RpsMove[] = ["rock", "paper", "scissors"];

const isSamePoint = (first: Point, second: Point) =>
  first.x === second.x && first.y === second.y;

const getRivalId = (id: ExplorerId): ExplorerId =>
  id === "blue" ? "yellow" : "blue";

const seededNumber = (value: string) =>
  [...value].reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );

const rpsWinner = (blueMove: RpsMove, yellowMove: RpsMove): ExplorerId | null => {
  if (blueMove === yellowMove) return null;
  return (
    (blueMove === "rock" && yellowMove === "scissors") ||
    (blueMove === "paper" && yellowMove === "rock") ||
    (blueMove === "scissors" && yellowMove === "paper")
  )
    ? "blue"
    : "yellow";
};

const resolveEncounter = (
  town: Town,
  previousPositions: Record<ExplorerId, Point>,
): Town => {
  if (!isSamePoint(town.blue.position, town.yellow.position)) return town;

  const turn = Math.floor(town.elapsed / 360);
  let rounds = 1;
  let blueMove = rpsMoves[seededNumber(`${town.seed}:blue:${turn}:${rounds}`) % rpsMoves.length];
  let yellowMove = rpsMoves[seededNumber(`${town.seed}:yellow:${turn}:${rounds}`) % rpsMoves.length];
  let winner = rpsWinner(blueMove, yellowMove);

  // A tied throw is immediately replayed with a seeded, different counter.
  // The offset guarantees the replay has a winner while keeping it reproducible.
  if (!winner) {
    rounds += 1;
    const blueIndex = seededNumber(`${town.seed}:clash:${turn}:${rounds}:blue`) % rpsMoves.length;
    const yellowOffset = (seededNumber(`${town.seed}:clash:${turn}:${rounds}:yellow`) % 2) + 1;
    blueMove = rpsMoves[blueIndex];
    yellowMove = rpsMoves[(blueIndex + yellowOffset) % rpsMoves.length];
    winner = rpsWinner(blueMove, yellowMove);
  }

  if (!winner) throw new Error("A decisive clash round must produce a winner.");

  const loser = getRivalId(winner);
  const stolenTreasure = town[loser].treasures.at(-1) ?? null;
  const winningPosition = town[winner].position;
  // A settled clash always leaves the two explorers on distinct legal cells.
  // This also protects a resumed match from accidentally resolving a second
  // clash on the next movement tick.
  const loserYieldPosition = [
    previousPositions[loser],
    town[loser].position,
    ...getNeighbours(town, winningPosition),
    ...getNeighbours(town, town[loser].position),
  ].find((candidate) => !isSamePoint(candidate, winningPosition)) ?? previousPositions[loser];

  const encounter: Encounter = {
    blueMove,
    yellowMove,
    winner,
    stolenTreasure,
    rounds,
    elapsed: town.elapsed,
  };

  const winnerExplorer = town[winner];
  const loserExplorer = town[loser];

  return {
    ...town,
    [winner]: {
      ...winnerExplorer,
      treasures: stolenTreasure
        ? [...winnerExplorer.treasures, stolenTreasure]
        : winnerExplorer.treasures,
    },
    [loser]: {
      ...loserExplorer,
      position: loserYieldPosition,
      path: [],
      treasures: stolenTreasure
        ? loserExplorer.treasures.slice(0, -1)
        : loserExplorer.treasures,
    },
    lastEncounter: encounter,
  } as Town;
};

const getNeighbours = (town: Town, point: Point): Point[] =>
  directions
    .map((direction) => ({
      x: point.x + direction.x,
      y: point.y + direction.y,
    }))
    .filter((candidate) => !town.blocked[candidate.y]?.[candidate.x]);

const revealNearbyCells = (town: Town, explorer: Explorer) => {
  const discovered = new Set(explorer.known);
  let edge = [explorer.position];

  const radiusLimit = town.difficulty === "hard" ? 2 : 4;
  for (let radius = 0; radius < radiusLimit; radius += 1) {
    edge = edge.flatMap((point) => getNeighbours(town, point));
    edge.forEach((point) => discovered.add(pointKey(point)));
  }

  return discovered;
};

const findPath = (town: Town, start: Point, goal: Point): Point[] => {
  const queue: Array<{ point: Point; route: Point[] }> = [
    { point: start, route: [] },
  ];
  const visited = new Set([pointKey(start)]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (isSamePoint(current.point, goal)) return current.route;

    for (const neighbour of getNeighbours(town, current.point)) {
      const key = pointKey(neighbour);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ point: neighbour, route: [...current.route, neighbour] });
    }
  }

  return [];
};

// A selected frontier begins a bounded scout route. The explorer moves at its
// normal pace; Hard simply gives its chosen exploration plan more ground to
// cover before the next decision cycle.
const explorationPath = (town: Town, id: ExplorerId, frontier: Point) => {
  const explorer = town[id];
  const route = findPath(town, explorer.position, frontier);
  const traversed = new Set([pointKey(explorer.position), ...route.map(pointKey)]);
  const maximumSteps = town.difficulty === "hard" ? 8 : 4;
  let current = route.at(-1) ?? explorer.position;

  while (route.length < maximumSteps) {
    const next = getNeighbours(town, current)
      .filter((candidate) => !traversed.has(pointKey(candidate)))
      .sort((left, right) => {
        const leftUnknown = explorer.known.has(pointKey(left)) ? 1 : 0;
        const rightUnknown = explorer.known.has(pointKey(right)) ? 1 : 0;
        return leftUnknown - rightUnknown || left.y - right.y || left.x - right.x;
      })[0];
    if (!next) break;
    route.push(next);
    traversed.add(pointKey(next));
    current = next;
  }

  return route;
};

export type ExplorerSnapshot = {
  battler: ExplorerId;
  self: Point;
  rival: Point;
  knownCells: number;
  frontiers: Array<{ id: string; position: Point }>;
  treasures: Array<{ id: string; position: Point }>;
  held: number;
};

export type CandidatePlan = {
  id: string;
  tactic: "EXPLORE_FAST" | "COLLECT_TREASURE_FAST";
  target: string;
  steps: number;
  rivalDistance: number;
  informationGain: number;
};

export const snapshot = (town: Town, id: ExplorerId): ExplorerSnapshot => {
  const explorer = town[id];
  const rival = town[getRivalId(id)];

  // A frontier is the next unknown, walkable cell at the edge of the
  // explorer's discovered map — never the explorer's current cell. This makes
  // every exploration decision produce a route with at least one move.
  const frontierByPosition = new Map<string, Point>();

  for (const key of explorer.known) {
    const [x, y] = key.split(",").map(Number);

    for (const neighbour of getNeighbours(town, { x, y })) {
      const neighbourKey = pointKey(neighbour);
      if (!explorer.known.has(neighbourKey)) {
        frontierByPosition.set(neighbourKey, neighbour);
      }
    }
  }

  const frontiers = [...frontierByPosition.values()]
    .sort(
      (left, right) =>
        Math.abs(right.x - explorer.position.x) +
        Math.abs(right.y - explorer.position.y) -
        (Math.abs(left.x - explorer.position.x) +
          Math.abs(left.y - explorer.position.y)),
    )
    .slice(0, 6)
    .map((position, index) => ({ id: `F${index + 1}`, position }));

  const treasures = town.treasures.flatMap((position, index) => {
    const treasureId = `T${index + 1}`;
    const isVisible = explorer.known.has(pointKey(position));
    const isCollected = explorer.treasures.includes(treasureId);

    return isVisible && !isCollected ? [{ id: treasureId, position }] : [];
  });

  return {
    battler: id,
    self: explorer.position,
    rival: rival.position,
    knownCells: explorer.known.size,
    frontiers,
    treasures,
    held: explorer.treasures.length,
  };
};

// The engine prices the legal routes. A decision layer only needs to choose
// among these strategic options; it never produces raw movement coordinates.
export const candidatePlans = (town: Town, id: ExplorerId): CandidatePlan[] => {
  const state = snapshot(town, id);
  const explorer = town[id];
  const rival = town[getRivalId(id)];
  const knownTreasurePlans = state.treasures.map((treasure) => ({
    id: `COLLECT_TREASURE_FAST:${treasure.id}`,
    tactic: "COLLECT_TREASURE_FAST" as const,
    target: treasure.id,
    steps: findPath(town, explorer.position, treasure.position).length,
    rivalDistance: Math.abs(treasure.position.x - rival.position.x) + Math.abs(treasure.position.y - rival.position.y),
    informationGain: 0,
  }));
  if (knownTreasurePlans.length) return knownTreasurePlans.slice(0, 3);

  return state.frontiers
    .map((frontier) => ({
      id: `EXPLORE_FAST:${frontier.id}`,
      tactic: "EXPLORE_FAST" as const,
      target: frontier.id,
      steps: explorationPath(town, id, frontier.position).length,
      rivalDistance: Math.abs(frontier.position.x - rival.position.x) + Math.abs(frontier.position.y - rival.position.y),
      informationGain: 1,
    }))
    .sort((left, right) => left.steps - right.steps || right.rivalDistance - left.rivalDistance)
    .slice(0, 3);
};

export const apply = (town: Town, decision: Decision): Town => {
  const explorer = town[decision.battler];
  const options = snapshot(town, decision.battler);
  const target = decision.target?.startsWith("T")
    ? options.treasures.find((item) => item.id === decision.target)?.position
    : options.frontiers.find((item) => item.id === decision.target)?.position;

  if (!target) return { ...town, status: "paused" };

  const nextExplorer: Explorer = {
    ...explorer,
    path: decision.tactic.startsWith("EXPLORE")
      ? explorationPath(town, decision.battler, target)
      : findPath(town, explorer.position, target),
    tactic: decision.tactic,
    confidence: decision.confidence,
  };

  return { ...town, [decision.battler]: nextExplorer } as Town;
};

export const step = (town: Town, milliseconds: number): Town => {
  if (town.status !== "running") return town;

  const previousPositions: Record<ExplorerId, Point> = {
    blue: town.blue.position,
    yellow: town.yellow.position,
  };
  let nextTown: Town = { ...town, elapsed: town.elapsed + milliseconds };

  for (const id of explorerIds) {
    const explorer = nextTown[id];
    const nextPosition = explorer.path[0];
    if (!nextPosition) continue;

    const movedExplorer: Explorer = {
      ...explorer,
      position: nextPosition,
      path: explorer.path.slice(1),
    };

    nextTown = {
      ...nextTown,
      [id]: {
        ...movedExplorer,
        known: revealNearbyCells(nextTown, movedExplorer),
      },
    } as Town;
  }

  nextTown = resolveEncounter(nextTown, previousPositions);

  for (const id of explorerIds) {
    const explorer = nextTown[id];

    nextTown.treasures.forEach((position, index) => {
      const treasureId = `T${index + 1}`;
      if (
        isSamePoint(explorer.position, position) &&
        !explorer.treasures.includes(treasureId)
      ) {
        nextTown = {
          ...nextTown,
          [id]: {
            ...explorer,
            treasures: [...explorer.treasures, treasureId],
          },
        } as Town;
      }
    });

    if (nextTown[id].treasures.length === 3) {
      return { ...nextTown, status: "finished", winner: id };
    }
  }

  return nextTown;
};
