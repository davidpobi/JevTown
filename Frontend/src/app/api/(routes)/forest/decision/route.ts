import { NextRequest, NextResponse } from "next/server";
import type { ForestDecisionTickRequest } from "@/interfaces/forestDecision";
import { isForestPreviewPlayEnabled, isLocalDevelopment } from "@/utils/environment";
import { handleForestDecisionRequest } from "./decision";
import { forestDecisionTickSchema } from "./decision.schema";
import { forestDecisionClientKey, isForestDecisionRateLimited } from "./rateLimit";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  if (!isLocalDevelopment() && !isForestPreviewPlayEnabled()) return NextResponse.json({ error: "Forest decisions are preview-controlled." }, { status: 403 });
  if (isForestPreviewPlayEnabled()) try { if (await isForestDecisionRateLimited(forestDecisionClientKey(request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip")))) return NextResponse.json({ error: "Preview decision limit reached. Please wait a minute." }, { status: 429 }); } catch { return NextResponse.json({ error: "Jev decision is temporarily unavailable." }, { status: 503 }); }
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 }); }
  const parsed = forestDecisionTickSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: "Invalid Forest decision request." }, { status: 400 });
  try { return NextResponse.json(await handleForestDecisionRequest(parsed.data as ForestDecisionTickRequest)); } catch { return NextResponse.json({ error: "Jev decision is temporarily unavailable." }, { status: 503 }); }
}
