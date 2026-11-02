import { NextResponse } from "next/server";

import { getHuntReplay } from "../../../hunt/replays/replays";
import { getReplay } from "../../../run/replays/replays";

export const dynamic = "force-dynamic";

type ReplayDetailRouteContext = { params: Promise<{ game: string; matchId: string }> };

export async function GET(_request: Request, context: ReplayDetailRouteContext) {
  const { game, matchId } = await context.params;
  if (game !== "hunt" && game !== "run") {
    return NextResponse.json({ error: "Unknown game." }, { status: 404 });
  }

  try {
    const replay = game === "hunt" ? await getHuntReplay(matchId) : await getReplay(matchId);
    if (!replay) return NextResponse.json({ error: "Replay not found." }, { status: 404 });
    return NextResponse.json(replay);
  } catch {
    return NextResponse.json({ error: "Replay is temporarily unavailable." }, { status: 503 });
  }
}
