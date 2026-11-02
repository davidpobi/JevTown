import { blueSpawn, createForestTerrain, forestHeight, forestWidth, pointKey, relicSites, yellowSpawn } from "./map";
import type { Forest, ForestDecision, ForestDifficulty, ForestExplorer, ForestId, ForestPlan, Point, Terrain } from "./types";

const ids: ForestId[] = ["blue", "yellow"];
const rivalOf = (id: ForestId): ForestId => id === "blue" ? "yellow" : "blue";
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const directions: Point[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
const hash = (value: string) => [...value].reduce((sum, char) => ((sum * 31 + char.charCodeAt(0)) >>> 0), 7);
const terrainCost = (terrain: Terrain) => terrain === "brush" ? 2 : terrain === "ruins" ? 2 : 1;
const exposed = (terrain: Terrain) => terrain === "trail" || terrain === "bridge";

const explorer = (id: ForestId, position: Point): ForestExplorer => ({ id, position, path: [], tactic: null, confidence: null, known: new Set([pointKey(position)]), relics: [] });

export const createForest = (seed: string, difficulty: ForestDifficulty = "standard"): Forest => {
  const forest: Forest = { seed, difficulty, width: forestWidth, height: forestHeight, terrain: createForestTerrain(), relics: relicSites, blue: explorer("blue", blueSpawn), yellow: explorer("yellow", yellowSpawn), status: "idle", winner: null, elapsed: 0, lastEncounter: null };
  return { ...forest, blue: { ...forest.blue, known: reveal(forest, forest.blue) }, yellow: { ...forest.yellow, known: reveal(forest, forest.yellow) } };
};

const walkable = (forest: Forest, point: Point) => point.x >= 0 && point.x < forest.width && point.y >= 0 && point.y < forest.height && forest.terrain[point.y][point.x] !== "water";
const neighbors = (forest: Forest, point: Point) => directions.map((d) => ({ x: point.x + d.x, y: point.y + d.y })).filter((point) => walkable(forest, point));

const route = (forest: Forest, start: Point, goal: Point, safe = false) => {
  const pending: Array<{ point: Point; path: Point[]; cost: number }> = [{ point: start, path: [], cost: 0 }];
  const costs = new Map([[pointKey(start), 0]]);
  while (pending.length) {
    pending.sort((a, b) => a.cost - b.cost);
    const current = pending.shift()!;
    if (same(current.point, goal)) return current.path;
    neighbors(forest, current.point).forEach((next) => {
      const terrain = forest.terrain[next.y][next.x];
      const cost = current.cost + terrainCost(terrain) + (safe && exposed(terrain) ? 2 : 0);
      const key = pointKey(next);
      if (costs.get(key) !== undefined && costs.get(key)! <= cost) return;
      costs.set(key, cost); pending.push({ point: next, path: [...current.path, next], cost });
    });
  }
  return [] as Point[];
};

const reveal = (forest: Forest, agent: ForestExplorer) => {
  const known = new Set(agent.known); const radius = forest.difficulty === "hard" ? 2 : 3;
  for (let y = agent.position.y - radius; y <= agent.position.y + radius; y += 1) for (let x = agent.position.x - radius; x <= agent.position.x + radius; x += 1) {
    const point = { x, y }; if (walkable(forest, point) && distance(agent.position, point) <= radius) known.add(pointKey(point));
  }
  return known;
};

const visibleRival = (forest: Forest, id: ForestId) => {
  const agent = forest[id]; const rival = forest[rivalOf(id)];
  return distance(agent.position, rival.position) <= 3 ? rival.position : null;
};

export type ForestSnapshot = { battler: ForestId; self: Point; rival: Point | null; heldRelics: number; knownCells: number; visibleRelics: Array<{ id: string; position: Point }>; frontiers: Array<{ id: string; position: Point }>; plans: ForestPlan[] };

export const forestSnapshot = (forest: Forest, id: ForestId): ForestSnapshot => {
  const agent = forest[id];
  const frontier = new Map<string, Point>();
  agent.known.forEach((key) => { const [x, y] = key.split(",").map(Number); neighbors(forest, { x, y }).forEach((next) => { if (!agent.known.has(pointKey(next))) frontier.set(pointKey(next), next); }); });
  const frontiers = [...frontier.values()].sort((a, b) => distance(agent.position, a) - distance(agent.position, b)).slice(0, 5).map((position, index) => ({ id: `F${index + 1}`, position }));
  const visibleRelics = forest.relics.flatMap((position, index) => agent.known.has(pointKey(position)) && !agent.relics.includes(`R${index + 1}`) ? [{ id: `R${index + 1}`, position }] : []);
  const snapshot: ForestSnapshot = { battler: id, self: agent.position, rival: visibleRival(forest, id), heldRelics: agent.relics.length, knownCells: agent.known.size, visibleRelics, frontiers, plans: [] };
  snapshot.plans = forestPlans(forest, snapshot);
  return snapshot;
};

export const forestPlans = (forest: Forest, snapshot: ForestSnapshot): ForestPlan[] => {
  const agent = forest[snapshot.battler];
  const plans: ForestPlan[] = [];
  snapshot.visibleRelics.forEach((relic) => {
    const fast = route(forest, agent.position, relic.position); const safe = route(forest, agent.position, relic.position, true);
    plans.push({ id: `COLLECT_RELIC_FAST:${relic.id}`, tactic: "COLLECT_RELIC_FAST", target: relic.id, steps: fast.length, exposure: fast.filter((point) => exposed(forest.terrain[point.y][point.x])).length, informationGain: 0, interceptValue: 0 });
    if (safe.join() !== fast.join()) plans.push({ id: `COLLECT_RELIC_SAFE:${relic.id}`, tactic: "COLLECT_RELIC_SAFE", target: relic.id, steps: safe.length, exposure: safe.filter((point) => exposed(forest.terrain[point.y][point.x])).length, informationGain: 0, interceptValue: 0 });
  });
  snapshot.frontiers.forEach((frontier) => { const path = route(forest, agent.position, frontier.position); plans.push({ id: `SCOUT_FRONTIER:${frontier.id}`, tactic: "SCOUT_FRONTIER", target: frontier.id, steps: path.length, exposure: path.filter((point) => exposed(forest.terrain[point.y][point.x])).length, informationGain: 1, interceptValue: 0 }); });
  if (snapshot.rival) { const path = route(forest, agent.position, snapshot.rival); plans.push({ id: "INTERCEPT_RIVAL:RIVAL", tactic: "INTERCEPT_RIVAL", target: "RIVAL", steps: path.length, exposure: path.filter((point) => exposed(forest.terrain[point.y][point.x])).length, informationGain: 0, interceptValue: 1 }); }
  return plans.filter((plan) => plan.steps > 0).sort((a, b) => a.steps - b.steps || b.informationGain - a.informationGain).slice(0, 3);
};

export const decisionFromForestPlan = (snapshot: ForestSnapshot, planId: string, confidence: number): ForestDecision => {
  const plan = snapshot.plans.find((item) => item.id === planId);
  if (!plan || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error("Jev returned an invalid Forest decision.");
  return { battler: snapshot.battler, planId: plan.id, tactic: plan.tactic, target: plan.target, confidence };
};

export const applyForestDecision = (forest: Forest, decision: ForestDecision): Forest => {
  const snapshot = forestSnapshot(forest, decision.battler);
  let valid: ForestDecision;
  try {
    valid = decisionFromForestPlan(snapshot, decision.planId, decision.confidence);
  } catch {
    // A provider response can arrive after local movement revealed a new map state.
    // It is no longer legal for this frame, so pause safely rather than crashing the game.
    return { ...forest, status: "paused" };
  }
  const target = valid.target === "RIVAL" ? snapshot.rival : valid.target.startsWith("R") ? snapshot.visibleRelics.find((item) => item.id === valid.target)?.position : snapshot.frontiers.find((item) => item.id === valid.target)?.position;
  if (!target) return { ...forest, status: "paused" };
  const safe = valid.tactic === "COLLECT_RELIC_SAFE";
  return { ...forest, [valid.battler]: { ...forest[valid.battler], path: route(forest, forest[valid.battler].position, target, safe), tactic: valid.tactic, confidence: valid.confidence } } as Forest;
};

const rps = (forest: Forest, turn: number) => {
  const moves = ["rock", "paper", "scissors"] as const; const blue = moves[hash(`${forest.seed}:blue:${turn}`) % 3]; let yellow = moves[hash(`${forest.seed}:yellow:${turn}`) % 3]; if (blue === yellow) yellow = moves[(moves.indexOf(yellow) + 1) % 3];
  const blueWins = (blue === "rock" && yellow === "scissors") || (blue === "paper" && yellow === "rock") || (blue === "scissors" && yellow === "paper"); return { blue, yellow, winner: blueWins ? "blue" as const : "yellow" as const };
};

export const stepForest = (forest: Forest, milliseconds: number): Forest => {
  if (forest.status !== "running") return forest;
  let next: Forest = { ...forest, elapsed: forest.elapsed + milliseconds };
  ids.forEach((id) => { const agent = next[id]; const point = agent.path[0]; if (!point) return; const moved = { ...agent, position: point, path: agent.path.slice(1) }; next = { ...next, [id]: { ...moved, known: reveal(next, moved) } } as Forest; });
  if (same(next.blue.position, next.yellow.position)) { const result = rps(next, Math.floor(next.elapsed / 360)); const loser = rivalOf(result.winner); const stolenRelic = next[loser].relics.at(-1) ?? null; next = { ...next, [result.winner]: { ...next[result.winner], relics: stolenRelic ? [...next[result.winner].relics, stolenRelic] : next[result.winner].relics }, [loser]: { ...next[loser], path: [], relics: stolenRelic ? next[loser].relics.slice(0, -1) : next[loser].relics }, lastEncounter: { blueMove: result.blue, yellowMove: result.yellow, winner: result.winner, stolenRelic, elapsed: next.elapsed } } as Forest; }
  ids.forEach((id) => next.relics.forEach((point, index) => { const relic = `R${index + 1}`; if (same(next[id].position, point) && !next[id].relics.includes(relic)) next = { ...next, [id]: { ...next[id], relics: [...next[id].relics, relic] } } as Forest; }));
  const winner = ids.find((id) => next[id].relics.length === 3); return winner ? { ...next, status: "finished", winner } : next;
};
