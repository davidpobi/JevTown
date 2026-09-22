import type { GameDifficulty, Maze, Point } from "./types";

const directions = [
  { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
];

const hashSeed = (seed: string) => {
  let value = 2166136261;
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return value >>> 0;
};

const randomFrom = (seed: string) => {
  let state = hashSeed(seed) || 1;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
};

const keyOf = ({ x, y }: Point) => `${x},${y}`;
const inBounds = (point: Point, width: number, height: number) => point.x >= 0 && point.x < width && point.y >= 0 && point.y < height;

export const createSeed = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const getNeighbors = (maze: Maze, point: Point): Point[] => directions
  .map((direction) => ({ x: point.x + direction.x, y: point.y + direction.y }))
  .filter((candidate) => inBounds(candidate, maze.width, maze.height) && !maze.walls[candidate.y][candidate.x]);

const buildCorridors = (width: number, height: number, walls: boolean[][]) => {
  const corridorByCell = Array.from({ length: height }, () => Array<string>(width).fill("wall"));
  const visited = new Set<string>();
  let corridorIndex = 1;
  const walkableNeighbors = (point: Point) => directions
    .map((direction) => ({ x: point.x + direction.x, y: point.y + direction.y }))
    .filter((candidate) => inBounds(candidate, width, height) && !walls[candidate.y][candidate.x]);

  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const start = { x, y };
    if (walls[y][x] || visited.has(keyOf(start))) continue;
    const corridor = `C${corridorIndex++}`;
    const queue = [start];
    visited.add(keyOf(start));
    while (queue.length) {
      const current = queue.shift()!;
      corridorByCell[current.y][current.x] = corridor;
      const degree = walkableNeighbors(current).length;
      for (const neighbor of walkableNeighbors(current)) {
        if (visited.has(keyOf(neighbor))) continue;
        // Junctions start a new named segment, keeping route history meaningful.
        if (degree > 2 && !(current.x === start.x && current.y === start.y)) continue;
        visited.add(keyOf(neighbor));
        queue.push(neighbor);
      }
    }
  }
  // Isolated junction cells become valid corridors too.
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (!walls[y][x] && corridorByCell[y][x] === "wall") corridorByCell[y][x] = `C${corridorIndex++}`;
  }
  return corridorByCell;
};

export const generateMaze = (seed: string, width = 21, height = 15): Maze => {
  const random = randomFrom(seed);
  const walls = Array.from({ length: height }, () => Array<boolean>(width).fill(true));
  const stack: Point[] = [{ x: 1, y: 1 }];
  walls[1][1] = false;

  while (stack.length) {
    const current = stack[stack.length - 1];
    const candidates = directions.map((direction) => ({ x: current.x + direction.x * 2, y: current.y + direction.y * 2, wall: { x: current.x + direction.x, y: current.y + direction.y } }))
      .filter((candidate) => candidate.x > 0 && candidate.x < width - 1 && candidate.y > 0 && candidate.y < height - 1 && walls[candidate.y][candidate.x]);
    if (!candidates.length) { stack.pop(); continue; }
    const next = candidates[Math.floor(random() * candidates.length)];
    walls[next.wall.y][next.wall.x] = false;
    walls[next.y][next.x] = false;
    stack.push({ x: next.x, y: next.y });
  }
  return { width, height, walls, seed, corridorByCell: buildCorridors(width, height, walls) };
};

export const shortestDistance = (maze: Maze, from: Point, to: Point) => {
  const queue: Array<{ point: Point; distance: number }> = [{ point: from, distance: 0 }];
  const visited = new Set([keyOf(from)]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current.point.x === to.x && current.point.y === to.y) return current.distance;
    for (const neighbor of getNeighbors(maze, current.point)) if (!visited.has(keyOf(neighbor))) {
      visited.add(keyOf(neighbor)); queue.push({ point: neighbor, distance: current.distance + 1 });
    }
  }
  return Infinity;
};

export const placeMatchObjects = (maze: Maze, difficulty: GameDifficulty = "standard") => {
  const cells: Point[] = [];
  for (let y = 0; y < maze.height; y += 1) for (let x = 0; x < maze.width; x += 1) if (!maze.walls[y][x]) cells.push({ x, y });
  const blue = cells[0];
  const yellow = cells.reduce((furthest, cell) => shortestDistance(maze, blue, cell) > shortestDistance(maze, blue, furthest) ? cell : furthest, cells[0]);
  const minimumObjectiveDistance = difficulty === "hard"
    ? Math.max(14, Math.floor((maze.width + maze.height) / 3))
    : 7;
  const distantFromSpawns = (cell: Point) => shortestDistance(maze, blue, cell) >= minimumObjectiveDistance && shortestDistance(maze, yellow, cell) >= minimumObjectiveDistance;
  const keyCandidates = cells.filter(distantFromSpawns);
  const key = (keyCandidates.length ? keyCandidates : cells).reduce((best, cell) => {
    const score = Math.min(shortestDistance(maze, blue, cell), shortestDistance(maze, yellow, cell));
    const bestScore = Math.min(shortestDistance(maze, blue, best), shortestDistance(maze, yellow, best));
    return score > bestScore ? cell : best;
  }, (keyCandidates.length ? keyCandidates : cells)[0]);
  const exitCandidates = cells.filter((cell) => keyOf(cell) !== keyOf(key) && keyOf(cell) !== keyOf(blue) && keyOf(cell) !== keyOf(yellow) && distantFromSpawns(cell) && shortestDistance(maze, key, cell) >= minimumObjectiveDistance);
  const exit = (exitCandidates.length ? exitCandidates : cells).reduce((best, cell) => {
    if (keyOf(cell) === keyOf(key) || keyOf(cell) === keyOf(blue) || keyOf(cell) === keyOf(yellow)) return best;
    return shortestDistance(maze, key, cell) > shortestDistance(maze, key, best) ? cell : best;
  }, (exitCandidates.length ? exitCandidates : cells).find((cell) => keyOf(cell) !== keyOf(key))!);
  return { blue, yellow, key, exit };
};

export const placeSignals = (maze: Maze, count = 3) => {
  const { blue, yellow } = placeMatchObjects(maze);
  const cells: Point[] = [];
  for (let y = 0; y < maze.height; y += 1) for (let x = 0; x < maze.width; x += 1) if (!maze.walls[y][x]) cells.push({ x, y });
  const signals: Point[] = [];
  while (signals.length < count) {
    const candidate = cells
      .filter((cell) => shortestDistance(maze, blue, cell) >= 7 && shortestDistance(maze, yellow, cell) >= 7 && signals.every((signal) => shortestDistance(maze, signal, cell) >= 7))
      .sort((left, right) => Math.min(shortestDistance(maze, blue, right), shortestDistance(maze, yellow, right)) - Math.min(shortestDistance(maze, blue, left), shortestDistance(maze, yellow, left)))[0];
    if (!candidate) break;
    signals.push(candidate);
  }
  return signals;
};

