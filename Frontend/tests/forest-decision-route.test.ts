import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ local: false, preview: false, limited: false, fail: false }));
vi.mock("@/utils/environment", () => ({ isLocalDevelopment: () => state.local, isForestPreviewPlayEnabled: () => state.preview }));
vi.mock("@/app/api/(routes)/forest/decision/rateLimit", () => ({ forestDecisionClientKey: () => "test", isForestDecisionRateLimited: async () => state.limited }));
vi.mock("@/app/api/(routes)/forest/decision/decision", () => ({ handleForestDecisionRequest: async () => { if (state.fail) throw new Error("provider failure"); return { decisions: [{ battler: "blue", planId: "SCOUT_FRONTIER:F1", tactic: "SCOUT_FRONTIER", target: "F1", confidence: .7 }, { battler: "yellow", planId: "SCOUT_FRONTIER:F1", tactic: "SCOUT_FRONTIER", target: "F1", confidence: .7 }] }; } }));
import { POST } from "../src/app/api/(routes)/forest/decision/route";
const request = () => new Request("http://localhost/api/forest/decision", { method: "POST", body: JSON.stringify({ kind: "tick", matchId: "forest-test", turn: 1, elapsedMs: 0, snapshots: ["blue", "yellow"].map((battler) => ({ battler, self: { x: 1, y: 1 }, rival: null, heldRelics: 0, knownCells: 4, visibleRelics: [], frontiers: [{ id: "F1", position: { x: 1, y: 2 } }], plans: [{ id: "SCOUT_FRONTIER:F1", tactic: "SCOUT_FRONTIER", target: "F1", steps: 1, exposure: 1, informationGain: 1, interceptValue: 0 }] })) }) });
describe("Forest decision route", () => {
  beforeEach(() => Object.assign(state, { local: false, preview: false, limited: false, fail: false }));
  it("denies non-preview requests", async () => expect((await POST(request() as never)).status).toBe(403));
  it("rejects malformed bodies", async () => { state.local = true; expect((await POST(new Request("http://localhost", { method: "POST", body: "{}" }) as never)).status).toBe(400); });
  it("rate limits public preview", async () => { state.preview = true; state.limited = true; expect((await POST(request() as never)).status).toBe(429); });
  it("returns a safe provider failure", async () => { state.local = true; state.fail = true; expect((await POST(request() as never)).status).toBe(503); });
});
