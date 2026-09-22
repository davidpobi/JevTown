"use client";

import { getFirebaseRealtimeDatabase } from "@/config/firebase";
import type { LiveMatchState } from "@/run/interfaces/liveMatch";
import { requestApi } from "@/services/apiClient.service";
import { onValue, ref } from "firebase/database";

const globalLivePath = "/global/jevx/live";

export const canMirrorLocalLiveMatch = () => Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_DATABASE_URL?.trim(),
);

export const publishLocalLiveMatch = async (
  state: LiveMatchState,
): Promise<LiveMatchState> => {
  return requestApi<LiveMatchState>("/api/live-match/run", {
    method: "POST",
    body: JSON.stringify({ state }),
  });
};

export const subscribeToGlobalLiveMatch = (
  onState: (state: LiveMatchState | null) => void,
  onError: (error: Error) => void,
) => {
  try {
    const liveReference = ref(getFirebaseRealtimeDatabase(), globalLivePath);
    let latestState: LiveMatchState | null = null;

    return onValue(liveReference, (snapshot) => {
      const state = snapshot.exists()
        ? (snapshot.val() as LiveMatchState)
        : null;

      if (
        state
        && latestState
        && state.matchId === latestState.matchId
        && state.version <= latestState.version
      ) {
        return;
      }

      latestState = state;

      onState(state);
    }, onError);
  } catch (error) {
    onError(error instanceof Error ? error : new Error("Live match is unavailable."));
    return () => undefined;
  }
};
