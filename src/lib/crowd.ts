export type CrowdSide = "blue" | "yellow";
export type CrowdPhase = "open" | "locked" | "finished";
export type CrowdState = { roundId: string; phase: CrowdPhase; blue: number; yellow: number; bluePercent: number; yellowPercent: number; winner: CrowdSide | null };
type CrowdAction = { action: "pick"; side: CrowdSide; roundId: string } | { action: "reset"; roundId: string } | { action: "lock" } | { action: "finish"; winner: CrowdSide };

const namespace = "jevtown";
const activeKey = `${namespace}:crowd:active-round`;
const roundKey = (roundId: string) => `${namespace}:crowd:round:${roundId}`;
const redis = async <T>(command: string, args: unknown[]): Promise<T> => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Crowd picks are not configured.");
  const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify([command.toUpperCase(), ...args]), cache: "no-store" });
  const payload = await response.json() as { result?: T; error?: string };
  if (!response.ok || payload.error) throw new Error(payload.error ?? "Crowd store unavailable.");
  return payload.result as T;
};
const percentage = (value: number, total: number) => total ? Math.round((value / total) * 100) : 0;
const readRound = async (roundId: string): Promise<CrowdState> => {
  const result = await redis<Record<string, string> | string[] | null>("hgetall", [roundKey(roundId)]);
  const fields = Array.isArray(result) ? Object.fromEntries(result.reduce<Array<[string, string]>>((pairs, value, index) => index % 2 === 0 ? pairs : [...pairs, [result[index - 1]!, value]], [])) : result;
  const blue = Number(fields?.blue ?? 0); const yellow = Number(fields?.yellow ?? 0); const total = blue + yellow;
  return { roundId, phase: fields?.phase === "locked" || fields?.phase === "finished" ? fields.phase : "open", blue, yellow, bluePercent: percentage(blue, total), yellowPercent: percentage(yellow, total), winner: fields?.winner === "blue" || fields?.winner === "yellow" ? fields.winner : null };
};
const activeRoundId = async () => {
  const existing = await redis<string | null>("get", [activeKey]);
  if (existing) return existing;
  const bootstrap = "bootstrap";
  await redis<number>("setnx", [activeKey, bootstrap]);
  await redis<number>("hset", [roundKey(bootstrap), "phase", "open", "blue", "0", "yellow", "0"]);
  return (await redis<string | null>("get", [activeKey])) ?? bootstrap;
};
export const getCrowdState = async () => readRound(await activeRoundId());
export const updateCrowdState = async (action: CrowdAction) => {
  if (action.action === "reset") { await redis<number>("hset", [roundKey(action.roundId), "phase", "open", "blue", "0", "yellow", "0"]); await redis<string>("set", [activeKey, action.roundId]); return readRound(action.roundId); }
  const roundId = await activeRoundId();
  if (action.action === "pick") {
    if (action.roundId !== roundId) throw new Error("A new crowd round has started.");
    const script = "if redis.call('GET', KEYS[1]) ~= ARGV[1] then return redis.error_reply('ROUND_CHANGED') end if redis.call('HGET', KEYS[2], 'phase') ~= 'open' then return redis.error_reply('PICKS_LOCKED') end return redis.call('HINCRBY', KEYS[2], ARGV[2], 1)";
    await redis<number>("eval", [script, 2, activeKey, roundKey(roundId), roundId, action.side]);
  } else if (action.action === "lock") await redis<number>("hset", [roundKey(roundId), "phase", "locked"]);
  else await redis<number>("hset", [roundKey(roundId), "phase", "finished", "winner", action.winner]);
  return readRound(roundId);
};
