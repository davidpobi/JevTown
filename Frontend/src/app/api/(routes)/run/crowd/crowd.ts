import "server-only";

import { getRedis } from "@/app/api/config/upstash";
import type { CrowdActionRequest, CrowdState } from "@/interfaces/crowd";

const namespace = "jevx";
const activeKey = `${namespace}:crowd:active-round`;
const roundKey = (roundId: string) => `${namespace}:crowd:round:${roundId}`;

const pickScript = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then
    return redis.error_reply('ROUND_CHANGED')
  end

  if redis.call('HGET', KEYS[2], 'phase') ~= 'open' then
    return redis.error_reply('PICKS_LOCKED')
  end

  return redis.call('HINCRBY', KEYS[2], ARGV[2], 1)
`;

const resetScript = `
  redis.call('HSET', KEYS[2], 'phase', 'open', 'blue', 0, 'yellow', 0)
  redis.call('HDEL', KEYS[2], 'winner')
  redis.call('SET', KEYS[1], ARGV[1])
  return 1
`;

const lifecycleScript = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then
    return redis.error_reply('ROUND_CHANGED')
  end

  local phase = redis.call('HGET', KEYS[2], 'phase')
  if not phase then
    return redis.error_reply('ROUND_CHANGED')
  end

  if ARGV[2] == 'lock' then
    if phase ~= 'open' then
      return redis.error_reply('PICKS_LOCKED')
    end

    redis.call('HSET', KEYS[2], 'phase', 'locked')
    return 1
  end

  if phase == 'finished' then
    if redis.call('HGET', KEYS[2], 'winner') == ARGV[3] then
      return 1
    end

    return redis.error_reply('PICKS_LOCKED')
  end

  redis.call('HSET', KEYS[2], 'phase', 'finished', 'winner', ARGV[3])
  return 1
`;

export class CrowdRoundConflictError extends Error {
  constructor() {
    super("Crowd calls are locked.");
  }
}

const percentage = (value: number, total: number) => {
  if (!total) return 0;
  return Math.round((value / total) * 100);
};

const initializeRound = async (roundId: string) => {
  await getRedis().hset(roundKey(roundId), {
    phase: "open",
    blue: 0,
    yellow: 0,
  });
};

const readRound = async (roundId: string): Promise<CrowdState> => {
  const fields = await getRedis().hgetall<Record<string, string>>(roundKey(roundId));
  const blue = Number(fields?.blue ?? 0);
  const yellow = Number(fields?.yellow ?? 0);
  const total = blue + yellow;

  return {
    roundId,
    phase: fields?.phase === "locked" || fields?.phase === "finished"
      ? fields.phase
      : "open",
    blue,
    yellow,
    bluePercent: percentage(blue, total),
    yellowPercent: percentage(yellow, total),
    winner: fields?.winner === "blue" || fields?.winner === "yellow"
      ? fields.winner
      : null,
  };
};

const activeRoundId = async (): Promise<string> => {
  const redis = getRedis();
  const activeRound = await redis.get<string>(activeKey);
  if (activeRound) return activeRound;

  const bootstrap = "bootstrap";
  const initialized = await redis.set(activeKey, bootstrap, { nx: true });

  if (initialized === "OK") {
    await initializeRound(bootstrap);
  }

  return (await redis.get<string>(activeKey)) ?? bootstrap;
};

const isRoundConflict = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("PICKS_LOCKED") || message.includes("ROUND_CHANGED");
};

export const getCrowdState = async () => readRound(await activeRoundId());

export const updateCrowdState = async (
  action: CrowdActionRequest,
): Promise<CrowdState> => {
  const redis = getRedis();

  if (action.action === "reset") {
    await redis.eval<string[], number>(
      resetScript,
      [activeKey, roundKey(action.roundId)],
      [action.roundId],
    );
    return readRound(action.roundId);
  }

  if (action.action === "pick") {
    try {
      await redis.eval<string[], number>(
        pickScript,
        [activeKey, roundKey(action.roundId)],
        [action.roundId, action.side],
      );
    } catch (error) {
      if (isRoundConflict(error)) {
        throw new CrowdRoundConflictError();
      }
      throw error;
    }
  } else {
    try {
      await redis.eval<string[], number>(
        lifecycleScript,
        [activeKey, roundKey(action.roundId)],
        action.action === "lock"
          ? [action.roundId, "lock"]
          : [action.roundId, "finish", action.winner],
      );
    } catch (error) {
      if (isRoundConflict(error)) {
        throw new CrowdRoundConflictError();
      }
      throw error;
    }
  }

  return readRound(action.roundId);
};
