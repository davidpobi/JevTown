import { describe, expect, it } from "vitest";
import { apply, snapshot, step } from "../src/game/rules";
import { createTown } from "../src/game/town";

describe("exploration", () => {
  it("places each treasure on a distinct open town cell", () => {
    const town = createTown("treasure-ground-check");
    const positions = new Set(town.treasures.map(({ x, y }) => `${x},${y}`));

    expect(town.treasures).toHaveLength(3);
    expect(positions.size).toBe(3);
    town.treasures.forEach(({ x, y }) => {
      expect(town.blocked[y][x]).toBe(false);
      [-1, 0, 1].forEach((dy) => [-1, 0, 1].forEach((dx) => {
        expect(town.blocked[y + dy]?.[x + dx]).not.toBe(true);
      }));
    });
  });

  it("makes hard towns reproducible with deeper treasure placement", () => {
    const first = createTown("hard-town-check", "hard");
    const second = createTown("hard-town-check", "hard");
    expect(first.width).toBe(21);
    expect(first.height).toBe(15);
    expect(first.treasures).toEqual(second.treasures);
    first.treasures.forEach((treasure) => {
      expect(Math.abs(treasure.x - first.blue.position.x) + Math.abs(treasure.y - first.blue.position.y)).toBeGreaterThan(11);
      expect(Math.abs(treasure.x - first.yellow.position.x) + Math.abs(treasure.y - first.yellow.position.y)).toBeGreaterThan(11);
    });
  });

  it("routes an explorer to an unknown neighbouring frontier", () => {
    const town = { ...createTown("movement-check"), status: "running" as const };
    const initialPosition = town.blue.position;
    const firstFrontier = snapshot(town, "blue").frontiers[0];

    expect(firstFrontier).toBeDefined();

    const routedTown = apply(town, {
      battler: "blue",
      tactic: "EXPLORE_FAST",
      target: firstFrontier.id,
      confidence: 0.5,
    });

    expect(routedTown.blue.path.length).toBeGreaterThan(0);

    const movedTown = step(routedTown, 180);
    expect(movedTown.blue.position).not.toEqual(initialPosition);
  });

  it("cannot collect more than one treasure from one route", () => {
    const town = { ...createTown("single-route-check"), status: "running" as const };
    const options = snapshot(town, "blue");
    const target = options.treasures[0]?.id ?? options.frontiers[0]?.id;
    const routedTown = apply(town, {
      battler: "blue",
      tactic: "EXPLORE_FAST",
      target,
      confidence: 0.5,
    });

    const afterRoute = Array.from({ length: 12 }).reduce(
      (currentTown) => step(currentTown, 360),
      routedTown,
    );

    expect(afterRoute.blue.treasures.length).toBeLessThanOrEqual(1);
  });

  it("keeps a fresh town idle until the spectator starts it", () => {
    const town = createTown("start-control-check");
    const afterTick = step(town, 360);

    expect(town.status).toBe("idle");
    expect(afterTick).toEqual(town);
  });

  it("resolves a meeting with deterministic RPS and separates the explorers", () => {
    const town = { ...createTown("clash-check"), status: "running" as const };
    const yellowStart = town.yellow.position;
    const collidingTown = {
      ...town,
      blue: { ...town.blue, path: [yellowStart] },
      yellow: { ...town.yellow, path: [] },
    };

    const afterClash = step(collidingTown, 360);

    expect(afterClash.lastEncounter).not.toBeNull();
    expect(afterClash.lastEncounter?.winner).toMatch(/blue|yellow/);
    expect(afterClash.blue.position).not.toEqual(afterClash.yellow.position);
  });

  it("separates explorers even when a clash begins with both already on one cell", () => {
    const town = { ...createTown("co-located-clash-check"), status: "running" as const };
    const sharedCell = town.blue.position;
    const coLocatedTown = {
      ...town,
      blue: { ...town.blue, position: sharedCell },
      yellow: { ...town.yellow, position: sharedCell },
    };

    const afterClash = step(coLocatedTown, 360);

    expect(afterClash.lastEncounter).not.toBeNull();
    expect(afterClash.blue.position).not.toEqual(afterClash.yellow.position);
  });
});
