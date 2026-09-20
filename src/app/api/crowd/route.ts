import { NextResponse } from "next/server";
import { getCrowdState, updateCrowdState } from "@/lib/crowd";
export const dynamic = "force-dynamic";
export async function GET() { try { return NextResponse.json(await getCrowdState()); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Crowd store unavailable." }, { status: 503 }); } }
export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>; const action = body.action;
    if (action === "pick" && (body.side === "blue" || body.side === "yellow") && typeof body.roundId === "string") return NextResponse.json(await updateCrowdState({ action, side: body.side, roundId: body.roundId }));
    if (action === "reset" && typeof body.roundId === "string") return NextResponse.json(await updateCrowdState({ action, roundId: body.roundId }));
    if (action === "lock") return NextResponse.json(await updateCrowdState({ action }));
    if (action === "finish" && (body.winner === "blue" || body.winner === "yellow")) return NextResponse.json(await updateCrowdState({ action, winner: body.winner }));
    return NextResponse.json({ error: "Invalid crowd action." }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Crowd store unavailable." }, { status: 503 }); }
}
