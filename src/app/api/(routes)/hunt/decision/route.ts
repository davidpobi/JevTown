import { NextRequest, NextResponse } from "next/server";

import type { HuntDecisionTickRequest } from "@/interfaces/huntDecision";
import { isHuntPreviewPlayEnabled, isLocalDevelopment } from "@/utils/environment";

import { handleHuntDecisionRequest } from "./decision";
import { huntDecisionTickSchema } from "./decision.schema";
import { huntDecisionClientKey, isHuntDecisionRateLimited } from "./rateLimit";

export const dynamic = "force-dynamic";

const isPreviewAllowed = () => isLocalDevelopment() || isHuntPreviewPlayEnabled();

export async function POST(request: NextRequest) {
  if (!isPreviewAllowed()) {
    return NextResponse.json({ error: "Hunt decisions are runner-controlled." }, { status: 403 });
  }

  if (isHuntPreviewPlayEnabled()) {
    try {
      const key = huntDecisionClientKey(
        request.headers.get("x-forwarded-for"),
        request.headers.get("x-real-ip"),
      );
      if (await isHuntDecisionRateLimited(key)) {
        return NextResponse.json({ error: "Preview decision limit reached. Please wait a minute." }, { status: 429 });
      }
    } catch {
      return NextResponse.json({ error: "Jev decision is temporarily unavailable." }, { status: 503 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  const parsed = huntDecisionTickSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid Hunt decision request." }, { status: 400 });

  try {
    return NextResponse.json(
      await handleHuntDecisionRequest(parsed.data as HuntDecisionTickRequest),
    );
  } catch {
    return NextResponse.json({ error: "Jev decision is temporarily unavailable." }, { status: 503 });
  }
}
