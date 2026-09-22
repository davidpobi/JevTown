"use client";

import type { CrowdActionRequest, CrowdSide, CrowdState } from "@/interfaces/crowd";
import { crowdApiPathFor, crowdStateEventFor, type GameKind } from "@/interfaces/game";
import { ApiClientError, requestApi } from "@/services/apiClient.service";

export class CrowdPickLockedError extends Error {
  constructor(message = "Crowd calls are locked.") {
    super(message);
  }
}

export class CrowdServiceError extends Error {
  constructor(
    message = "Crowd picks are temporarily unavailable.",
    public readonly status?: number,
  ) {
    super(message);
  }
}

const toCrowdServiceError = (error: unknown): Error => {
  if (error instanceof CrowdPickLockedError || error instanceof CrowdServiceError) {
    return error;
  }

  if (error instanceof ApiClientError) {
    if (error.status === 409) {
      return new CrowdPickLockedError(error.message);
    }

    return new CrowdServiceError(error.message, error.status);
  }

  return new CrowdServiceError();
};

const updateCrowd = async (
  game: GameKind,
  action: CrowdActionRequest,
): Promise<CrowdState> => {
  try {
    const state = await requestApi<CrowdState>(crowdApiPathFor(game), {
      method: "POST",
      body: JSON.stringify(action),
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(crowdStateEventFor(game)));
    }

    return state;
  } catch (error) {
    throw toCrowdServiceError(error);
  }
};

export const getCrowdState = async (game: GameKind): Promise<CrowdState> => {
  try {
    return await requestApi<CrowdState>(crowdApiPathFor(game), { cache: "no-store" });
  } catch (error) {
    throw toCrowdServiceError(error);
  }
};

export const pickCrowdSide = (game: GameKind, side: CrowdSide, roundId: string) =>
  updateCrowd(game, { action: "pick", side, roundId });

export const resetCrowdRound = (game: GameKind, roundId: string) =>
  updateCrowd(game, { action: "reset", roundId });

export const lockCrowdRound = (game: GameKind, roundId: string) =>
  updateCrowd(game, { action: "lock", roundId });

export const finishCrowdRound = (
  game: GameKind,
  roundId: string,
  winner: CrowdSide,
) => updateCrowd(game, { action: "finish", roundId, winner });
