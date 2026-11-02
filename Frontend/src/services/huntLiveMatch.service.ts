"use client";

import { onValue, ref } from "firebase/database";

import { getFirebaseRealtimeDatabase } from "@/config/firebase";
import type { LiveHuntMatchState } from "@/interfaces/huntLiveMatch";
import { requestApi } from "@/services/apiClient.service";

const globalLivePath = "/global/jevtown/live";

export const canMirrorLocalHuntMatch = () => Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_DATABASE_URL?.trim(),
);

export const publishLocalHuntMatch = (state: LiveHuntMatchState) =>
  requestApi<LiveHuntMatchState>("/api/live-match/hunt", {
    method: "POST",
    body: JSON.stringify({ state }),
  });

export const subscribeToGlobalHuntMatch = (
  onState: (state: LiveHuntMatchState | null) => void,
  onError: (error: Error) => void,
) => {
  try {
    const liveReference = ref(getFirebaseRealtimeDatabase(), globalLivePath);
    let latestState: LiveHuntMatchState | null = null;

    return onValue(
      liveReference,
      (snapshot) => {
        const state = snapshot.exists()
          ? (snapshot.val() as LiveHuntMatchState)
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
      },
      onError,
    );
  } catch (error) {
    onError(error instanceof Error ? error : new Error("Live hunt is unavailable."));
    return () => undefined;
  }
};
