import { z } from "zod";

const tactics = [
  "GET_KEY_FAST",
  "GET_KEY_SAFE",
  "GO_EXIT_FAST",
  "GO_EXIT_SAFE",
  "CAPTURE_SIGNAL_FAST",
  "CAPTURE_SIGNAL_SAFE",
  "EXPLORE_FAST",
  "EXPLORE_SAFE",
  "CHASE_RIVAL",
] as const;

const tacticSchema = z.enum(tactics);
const pointSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

const historySchema = z.object({
  visits: z.record(z.string(), z.number().int().nonnegative()),
  transitions: z.record(z.string(), z.number().int().nonnegative()),
  recentCorridors: z.array(z.string()).max(3),
  keyEvents: z.number().int().nonnegative(),
  encounters: z.number().int().nonnegative(),
});

const objectivesSchema = z.object({
  mode: z.enum(["extraction", "signal-hunt"]),
  difficulty: z.enum(["standard", "hard"]),
  key: pointSchema.nullable(),
  keyKnown: z.boolean().default(false),
  exit: pointSchema.nullable(),
  exitUnlocked: z.boolean(),
  exitKnown: z.boolean(),
  signals: z.array(z.object({
    id: z.string(),
    position: pointSchema,
  })).max(3),
  capturedSignals: z.number().int().nonnegative(),
  signalGoal: z.number().int().nonnegative(),
  knownCellCount: z.number().int().nonnegative(),
  frontierCorridors: z.array(z.string()).max(8),
});

const frontierSchema = z.object({
  id: z.string().regex(/^F[1-6]$/),
  corridor: z.string().min(1),
  distance: z.number().int().nonnegative(),
  rivalDistance: z.number().int().nonnegative(),
  visits: z.number().int().nonnegative(),
});

const planSchema = z.object({
  id: z.string().min(1),
  tactic: tacticSchema,
  frontierId: z.string().regex(/^F[1-6]$/).optional(),
  target: z.string().min(1),
  steps: z.number().int().nonnegative(),
  rivalDistance: z.number().int().nonnegative(),
  informationGain: z.number().int().nonnegative(),
});

export const decisionSnapshotSchema = z.object({
  battler: z.enum(["blue", "yellow"]),
  self: z.object({
    position: pointSchema,
    corridor: z.string().min(1),
    hasKey: z.boolean(),
    routeHistory: historySchema,
  }),
  rival: z.object({
    position: pointSchema,
    corridor: z.string().min(1),
    hasKey: z.boolean(),
    routeHistory: historySchema,
  }),
  objectives: objectivesSchema,
  frontiers: z.array(frontierSchema).max(6),
  plans: z.array(planSchema).min(1).max(5),
  legalTactics: z.array(tacticSchema).min(1).max(3),
});

const requestBase = z.object({
  snapshots: z.array(decisionSnapshotSchema).length(2),
});

const tickRequestSchema = requestBase.extend({
  kind: z.literal("tick"),
  matchId: z.string().min(4).max(80),
  turn: z.number().int().positive(),
  elapsedMs: z.number().int().nonnegative(),
});

const clashRequestSchema = requestBase.extend({
  kind: z.literal("clash"),
  matchId: z.string().min(4).max(80),
  turn: z.number().int().positive(),
  cell: pointSchema,
});

const completeRequestSchema = z.object({
  kind: z.literal("complete"),
  matchId: z.string().min(4).max(80),
});

export const decisionRequestSchema = z.discriminatedUnion("kind", [
  tickRequestSchema,
  clashRequestSchema,
  completeRequestSchema,
]);

