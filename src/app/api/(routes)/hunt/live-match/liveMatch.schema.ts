import { z } from "zod";

const pointSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

const explorerSchema = z.object({
  position: pointSchema,
  path: z.array(pointSchema).max(16),
  tactic: z.enum([
    "EXPLORE_FAST",
    "EXPLORE_SAFE",
    "COLLECT_TREASURE_FAST",
    "COLLECT_TREASURE_SAFE",
    "CHASE_RIVAL",
  ]).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  treasureCount: z.number().int().min(0).max(3),
});

const encounterSchema = z.object({
  blueMove: z.enum(["rock", "paper", "scissors"]),
  yellowMove: z.enum(["rock", "paper", "scissors"]),
  winner: z.enum(["blue", "yellow"]),
  stolenTreasure: z.string().nullable(),
  rounds: z.number().int().positive(),
  elapsed: z.number().int().nonnegative(),
}).nullable();

export const publishLiveHuntSchema = z.object({
  state: z.object({
    matchId: z.string().min(4).max(80),
    seed: z.string().min(4).max(80),
    difficulty: z.enum(["standard", "hard"]),
    version: z.number().int().nonnegative(),
    status: z.enum(["idle", "running", "finished", "paused"]),
    elapsed: z.number().int().nonnegative(),
    blue: explorerSchema,
    yellow: explorerSchema,
    winner: z.enum(["blue", "yellow"]).nullable(),
    lastEncounter: encounterSchema,
    latestEvent: z.object({
      kind: z.enum(["ready", "started", "decision", "clash", "treasure", "finished", "paused"]),
      message: z.string().min(1).max(240),
    }),
    updatedAt: z.number().int().nonnegative(),
  }),
});
