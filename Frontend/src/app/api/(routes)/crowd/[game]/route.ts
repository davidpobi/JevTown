import { NextRequest, NextResponse } from "next/server";

import { isDevelopmentDeployment } from "@/app/api/utils/environment";
import type { CrowdActionRequest } from "@/interfaces/crowd";
import {
  CrowdRoundConflictError as HuntCrowdRoundConflictError,
  getCrowdState as getHuntCrowdState,
  updateCrowdState as updateHuntCrowdState,
} from "../../hunt/crowd/crowd";
import {
  CrowdRoundConflictError as RunCrowdRoundConflictError,
  getCrowdState as getRunCrowdState,
  updateCrowdState as updateRunCrowdState,
} from "../../run/crowd/crowd";
import { crowdActionSchema } from "../../hunt/crowd/crowd.schema";

export const dynamic = "force-dynamic";

type CrowdRouteContext = { params: Promise<{ game: string }> };

const operationsFor = (game: string) => {
  if (game === "hunt") {
    return {
      getState: getHuntCrowdState,
      updateState: updateHuntCrowdState,
      ConflictError: HuntCrowdRoundConflictError,
    };
  }

  if (game === "run") {
    return {
      getState: getRunCrowdState,
      updateState: updateRunCrowdState,
      ConflictError: RunCrowdRoundConflictError,
    };
  }

  return null;
};

export async function GET(_request: NextRequest, context: CrowdRouteContext) {
  const operations = operationsFor((await context.params).game);
  if (!operations) return NextResponse.json({ error: "Unknown game." }, { status: 404 });

  try {
    return NextResponse.json(await operations.getState());
  } catch {
    return NextResponse.json({ error: "Crowd picks are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest, context: CrowdRouteContext) {
  const operations = operationsFor((await context.params).game);
  if (!operations) return NextResponse.json({ error: "Unknown game." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  const parsed = crowdActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid crowd action." }, { status: 400 });

  if (parsed.data.action !== "pick" && !isDevelopmentDeployment()) {
    return NextResponse.json({ error: "Crowd lifecycle is runner-controlled." }, { status: 403 });
  }

  try {
    return NextResponse.json(await operations.updateState(parsed.data as CrowdActionRequest));
  } catch (error) {
    if (error instanceof operations.ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json({ error: "Crowd picks are temporarily unavailable." }, { status: 503 });
  }
}
