import { NextRequest, NextResponse } from "next/server";
import { isDevelopmentDeployment } from "@/app/api/utils/environment";
import type { DecisionRequest } from "@/run/interfaces/decision";
import { handleDecisionRequest } from "./decision";
import { decisionRequestSchema } from "./decision.schema";

export async function POST(request: NextRequest) {
  if (!isDevelopmentDeployment()) {
    return NextResponse.json(
      { error: "Jev decisions are runner-controlled." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const parsed = decisionRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid decision request." }, { status: 400 });
  try {
    return NextResponse.json(await handleDecisionRequest(parsed.data as DecisionRequest));
  } catch {
    return NextResponse.json({ error: "Jev decision is temporarily unavailable." }, { status: 503 });
  }
}

