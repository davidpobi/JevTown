import "server-only";

import { getRedis } from "@/app/api/config/upstash";

const limit = 15;
const windowSeconds = 60;

const incrementWithExpiry = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;

export const huntDecisionClientKey = (forwardedFor: string | null, realIp: string | null) => {
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || "unknown";
  return `jevtown:hunt:preview-decision:${ip}`;
};

export const isHuntDecisionRateLimited = async (key: string) => {
  const count = await getRedis().eval<string[], number>(
    incrementWithExpiry,
    [key],
    [String(windowSeconds)],
  );
  return count > limit;
};
