import { NextResponse } from "next/server";

import { getRecentHuntReplays } from "../../hunt/replays/replays";
import { getRecentReplays } from "../../run/replays/replays";

export const dynamic = "force-dynamic";

type ReplayRouteContext = { params: Promise<{ game: string }> };

export async function GET(_request: Request, context: ReplayRouteContext) {
  const game = (await context.params).game;
  if (game !== "hunt" && game !== "run") {
    return NextResponse.json({ error: "Unknown game." }, { status: 404 });
  }

  try {
    return NextResponse.json(game === "hunt" ? await getRecentHuntReplays() : await getRecentReplays());
  } catch {
    return NextResponse.json({ error: "Replays are temporarily unavailable." }, { status: 503 });
  }
}
