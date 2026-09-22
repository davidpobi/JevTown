"use client";

import type {
  HuntDecisionTickRequest,
  HuntDecisionTickResponse,
} from "@/interfaces/huntDecision";
import { ApiClientError, requestApi } from "@/services/apiClient.service";

export class HuntDecisionServiceError extends Error {
  constructor(message = "Jev decision is temporarily unavailable.", public readonly status?: number) {
    super(message);
  }
}

export const requestHuntDecisions = async (
  request: HuntDecisionTickRequest,
): Promise<HuntDecisionTickResponse> => {
  try {
    return await requestApi<HuntDecisionTickResponse>("/api/hunt/decision", {
      method: "POST",
      body: JSON.stringify(request),
    });
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw new HuntDecisionServiceError(error.message, error.status);
    }
    throw new HuntDecisionServiceError();
  }
};
