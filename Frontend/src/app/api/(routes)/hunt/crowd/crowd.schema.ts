import { z } from "zod";

const roundId = z.string().min(4).max(80);
const side = z.enum(["blue", "yellow"]);

export const crowdActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pick"), side, roundId }),
  z.object({ action: z.literal("reset"), roundId }),
  z.object({ action: z.literal("lock"), roundId }),
  z.object({ action: z.literal("finish"), roundId, winner: side }),
]);

