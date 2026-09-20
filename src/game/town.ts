import type { Explorer, ExplorerId, Point, Town, TownDifficulty } from "./types";

const pointKey = ({ x, y }: Point) => `${x},${y}`;
const hashSeed = (seed: string) => [...seed].reduce((value, character) => ((value * 31 + character.charCodeAt(0)) >>> 0), 7);
const distance = (left: Point, right: Point) => Math.abs(left.x - right.x) + Math.abs(left.y - right.y);

const createExplorer = (
  id: ExplorerId,
  position: Point,
  known: Set<string>,
): Explorer => ({
  id,
  position,
  path: [],
  tactic: null,
  confidence: null,
  known,
  treasures: [],
});

const discoverStartingArea = (blocked: boolean[][], start: Point, radius: number) => {
  const known = new Set([pointKey(start)]);
  const queue: Array<{ point: Point; distance: number }> = [
    { point: start, distance: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.distance === radius) continue;

    for (const direction of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const neighbour = {
        x: current.point.x + direction.x,
        y: current.point.y + direction.y,
      };
      const key = pointKey(neighbour);

      if (blocked[neighbour.y]?.[neighbour.x] || known.has(key)) continue;
      known.add(key);
      queue.push({ point: neighbour, distance: current.distance + 1 });
    }
  }

  return known;
};

export const createTown = (seed: string, difficulty: TownDifficulty = "standard"): Town => {
  const width = difficulty === "hard" ? 21 : 15;
  const height = difficulty === "hard" ? 15 : 11;
  const seedHash = hashSeed(seed);
  const blocked = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => (
    x === 0 || y === 0 || x === width - 1 || y === height - 1 || ((x * 17 + y * 11 + seedHash) % 19 === 0)
  )));
  const walkable: Point[] = [];
  blocked.forEach((row, y) => row.forEach((isBlocked, x) => { if (!isBlocked) walkable.push({ x, y }); }));
  const blueSpawn = walkable[1], yellowSpawn = walkable.at(-2)!;
  const minimumTreasureDistance = difficulty === "hard" ? 11 : 6;
  const candidates = walkable.filter((point) => distance(point, blueSpawn) > minimumTreasureDistance && distance(point, yellowSpawn) > minimumTreasureDistance)
    .filter((point) => [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => dx === 0 && dy === 0 || !blocked[point.y + dy]?.[point.x + dx])))
    .sort((left, right) => ((left.x * 7 + left.y * 3 + seedHash) % 31) - ((right.x * 7 + right.y * 3 + seedHash) % 31));
  const treasures: Point[] = [];
  const remaining = [...candidates];
  while (treasures.length < 3 && remaining.length) {
    remaining.sort((left, right) => {
      const score = (point: Point) => Math.min(
        distance(point, blueSpawn),
        distance(point, yellowSpawn),
        ...treasures.map((treasure) => distance(point, treasure)),
      );
      return score(right) - score(left) || ((right.x * 7 + right.y * 3 + seedHash) % 31) - ((left.x * 7 + left.y * 3 + seedHash) % 31);
    });
    const next = remaining.shift();
    if (next) treasures.push(next);
  }
  return {
    seed,
    difficulty,
    width,
    height,
    blocked,
    treasures,
    blue: createExplorer(
      "blue",
      blueSpawn,
      discoverStartingArea(blocked, blueSpawn, difficulty === "hard" ? 1 : 3),
    ),
    yellow: createExplorer(
      "yellow",
      yellowSpawn,
      discoverStartingArea(blocked, yellowSpawn, difficulty === "hard" ? 1 : 3),
    ),
    status: "idle",
    winner: null,
    elapsed: 0,
    lastEncounter: null,
  };
};

export { pointKey };
