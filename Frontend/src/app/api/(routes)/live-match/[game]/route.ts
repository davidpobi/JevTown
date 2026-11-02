import { NextRequest, NextResponse } from "next/server";

import type { PublishLiveHuntRequest } from "@/interfaces/huntLiveMatch";
import type { PublishLiveMatchRequest } from "@/run/interfaces/liveMatch";
import { publishLiveHuntSchema } from "../../hunt/live-match/liveMatch.schema";
import { publishLiveHuntMatch, type HuntLiveMatchScope } from "../../hunt/live-match/liveMatch";
import { publishLiveMatchSchema } from "../../run/live-match/liveMatch.schema";
import { publishLiveMatch, type LiveMatchScope } from "../../run/live-match/liveMatch";

type LiveMatchRouteContext = { params: Promise<{ game: string }> };

const isLocalServer = () => process.env.NODE_ENV === "development";

const isRunnerRequest = (request: NextRequest) => {
  const secret = process.env.RUNNER_SECRET_KEY;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
};

const scopeFor = (request: NextRequest) => {
  if (isLocalServer()) return "local" as const;
  return isRunnerRequest(request) ? "global" as const : null;
};

export async function POST(request: NextRequest, context: LiveMatchRouteContext) {
  const game = (await context.params).game;
  if (game !== "hunt" && game !== "run") {
    return NextResponse.json({ error: "Unknown game." }, { status: 404 });
  }

  const scope = scopeFor(request);
  if (!scope) {
    return NextResponse.json({ error: "Live match publishing is runner-controlled." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  const parsed = game === "hunt"
    ? publishLiveHuntSchema.safeParse(body)
    : publishLiveMatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid live match state." }, { status: 400 });

  try {
    const published = game === "hunt"
      ? await publishLiveHuntMatch(scope as HuntLiveMatchScope, parsed.data.state as PublishLiveHuntRequest["state"])
      : await publishLiveMatch(scope as LiveMatchScope, parsed.data.state as PublishLiveMatchRequest["state"]);
    return NextResponse.json(published);
  } catch {
    return NextResponse.json({ error: "Live match publishing is temporarily unavailable." }, { status: 503 });
  }
}
