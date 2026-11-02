import "server-only";

import { getFirebaseAdminRealtimeDatabase } from "@/app/api/config/firebaseAdmin";
import type { LiveMatchState } from "@/run/interfaces/liveMatch";
import { recordGlobalReplayState } from "@/app/api/(routes)/run/replays/replays";

export type LiveMatchScope = "global" | "local";

export const liveMatchPathFor = (scope: LiveMatchScope) =>
  scope === "global" ? "/global/jevx/live" : "/user88/jevx/live";

export const publishLiveMatch = async (
  scope: LiveMatchScope,
  state: LiveMatchState,
): Promise<LiveMatchState> => {
  const published = {
    ...state,
    updatedAt: Date.now(),
  };

  if (scope === "global") {
    await recordGlobalReplayState(published);
  }

  await getFirebaseAdminRealtimeDatabase().ref(liveMatchPathFor(scope)).set(published);

  return published;
};

