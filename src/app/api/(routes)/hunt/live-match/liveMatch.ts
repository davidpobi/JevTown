import "server-only";

import { getFirebaseAdminRealtimeDatabase } from "@/app/api/config/firebaseAdmin";
import { recordGlobalHuntReplayState } from "@/app/api/(routes)/hunt/replays/replays";
import type { LiveHuntMatchState } from "@/interfaces/huntLiveMatch";

export type HuntLiveMatchScope = "global" | "local";

export const huntLiveMatchPathFor = (scope: HuntLiveMatchScope) =>
  scope === "global" ? "/global/jevtown/live" : "/user88/jevtown/live";

export const publishLiveHuntMatch = async (
  scope: HuntLiveMatchScope,
  state: LiveHuntMatchState,
): Promise<LiveHuntMatchState> => {
  const published = { ...state, updatedAt: Date.now() };

  if (scope === "global") {
    await recordGlobalHuntReplayState(published);
  }

  await getFirebaseAdminRealtimeDatabase()
    .ref(huntLiveMatchPathFor(scope))
    .set(published);

  return published;
};
