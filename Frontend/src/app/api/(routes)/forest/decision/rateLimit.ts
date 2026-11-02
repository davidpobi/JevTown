import "server-only";
import { getRedis } from "@/app/api/config/upstash";
const script = "local count = redis.call('INCR', KEYS[1]) if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end return count";
export const forestDecisionClientKey = (forwarded: string | null, real: string | null) => `jevtown:forest:preview-decision:${forwarded?.split(",")[0]?.trim() || real?.trim() || "unknown"}`;
export const isForestDecisionRateLimited = async (key: string) => (await getRedis().eval<string[], number>(script, [key], ["60"])) > 15;
