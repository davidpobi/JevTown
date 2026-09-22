"use client";

import type {
  DecisionClashRequest,
  DecisionClashResponse,
  DecisionCompleteRequest,
  DecisionCompleteResponse,
  DecisionTickRequest,
  DecisionTickResponse,
} from "@/run/interfaces/decision";
import { ApiClientError, requestApi } from "@/services/apiClient.service";

export class JevDecisionServiceError extends Error {
  constructor(
    message = "Jev decision is temporarily unavailable.",
    public readonly status?: number,
  ) {
    super(message);
  }
}

type DecisionOperation =
  | DecisionTickRequest
  | DecisionClashRequest
  | DecisionCompleteRequest;

const toDecisionServiceError = (error: unknown): Error => {
  if (error instanceof JevDecisionServiceError) return error;

  if (error instanceof ApiClientError) {
    return new JevDecisionServiceError(error.message, error.status);
  }

  return new JevDecisionServiceError();
};

const postDecision = async <TResponse>(
  payload: DecisionOperation,
): Promise<TResponse> => {
  try {
    return await requestApi<TResponse>("/api/run/decision", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw toDecisionServiceError(error);
  }
};

export const requestJevDecisions = async (
  request: DecisionTickRequest,
): Promise<DecisionTickResponse> => postDecision<DecisionTickResponse>(request);

export const requestJevClash = async (
  request: DecisionClashRequest,
): Promise<DecisionClashResponse> => postDecision<DecisionClashResponse>(request);

export const completeJevMatch = async (
  request: DecisionCompleteRequest,
): Promise<DecisionCompleteResponse> => postDecision<DecisionCompleteResponse>(request);
