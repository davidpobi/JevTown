import "server-only";

import { getRedis } from "@/app/api/config/upstash";
import type { ExplorerId } from "@/game/types";
import type { LiveHuntMatchState } from "@/interfaces/huntLiveMatch";
import type { HuntReplay, HuntReplaySummary } from "@/interfaces/huntReplay";

const namespace = "jevtown";
const replayLimit = 5;
const replayIndexKey = `${namespace}:replays`;
const replayMetadataKey = (matchId: string) => `${namespace}:replay:${matchId}:metadata`;
const replayEventsKey = (matchId: string) => `${namespace}:replay:${matchId}:events`;

const asNumber = (value: string | undefined) => Number(value ?? 0);

const asWinner = (value: string | undefined): ExplorerId | null =>
  value === "blue" || value === "yellow" ? value : null;

const toSummary = (fields: Record<string, string> | null): HuntReplaySummary | null => {
  const winner = asWinner(fields?.winner);

  if (!fields?.matchId || !fields.seed || !fields.difficulty || !winner) {
    return null;
  }

  return {
    matchId: fields.matchId,
    seed: fields.seed,
    difficulty: fields.difficulty as HuntReplaySummary["difficulty"],
    winner,
    startedAt: asNumber(fields.startedAt),
    finishedAt: asNumber(fields.finishedAt),
    eventCount: asNumber(fields.eventCount),
  };
};

const removeExpiredReplays = async () => {
  const redis = getRedis();
  const replayCount = await redis.zcard(replayIndexKey);

  if (replayCount <= replayLimit) {
    return;
  }

  const expiredMatchIds = await redis.zrange<string[]>(
    replayIndexKey,
    0,
    replayCount - replayLimit - 1,
  );

  await Promise.all(expiredMatchIds.flatMap((matchId) => [
    redis.zrem(replayIndexKey, matchId),
    redis.del(replayMetadataKey(matchId)),
    redis.del(replayEventsKey(matchId)),
  ]));
};

export const recordGlobalHuntReplayState = async (state: LiveHuntMatchState) => {
  const redis = getRedis();
  const metadataKey = replayMetadataKey(state.matchId);
  const existing = await redis.hgetall<Record<string, string>>(metadataKey);
  const existingEventCount = asNumber(existing?.eventCount);

  await Promise.all([
    redis.rpush(replayEventsKey(state.matchId), JSON.stringify(state)),
    redis.hset(metadataKey, {
      matchId: state.matchId,
      seed: state.seed,
      difficulty: state.difficulty,
      startedAt: asNumber(existing?.startedAt) || state.updatedAt,
      eventCount: existingEventCount + 1,
      ...(state.status === "finished" && state.winner
        ? { winner: state.winner, finishedAt: state.updatedAt }
        : {}),
    }),
  ]);

  if (state.status === "finished" && state.winner) {
    await redis.zadd(replayIndexKey, {
      score: state.updatedAt,
      member: state.matchId,
    });
    await removeExpiredReplays();
  }
};

export const getRecentHuntReplays = async (): Promise<HuntReplaySummary[]> => {
  const redis = getRedis();
  const matchIds = await redis.zrange<string[]>(replayIndexKey, 0, replayLimit - 1, {
    rev: true,
  });
  const summaries = await Promise.all(matchIds.map(async (matchId) =>
    toSummary(await redis.hgetall<Record<string, string>>(replayMetadataKey(matchId))),
  ));

  return summaries.filter((summary): summary is HuntReplaySummary => Boolean(summary));
};

export const getHuntReplay = async (matchId: string): Promise<HuntReplay | null> => {
  const redis = getRedis();
  const summary = toSummary(
    await redis.hgetall<Record<string, string>>(replayMetadataKey(matchId)),
  );

  if (!summary) {
    return null;
  }

  const rawEvents = await redis.lrange<string>(replayEventsKey(matchId), 0, -1);
  const events = rawEvents.flatMap((event) => {
    try {
      return [JSON.parse(event) as LiveHuntMatchState];
    } catch {
      return [];
    }
  });

  return { ...summary, events };
};
