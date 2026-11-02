"use client";
import type { ForestDecisionTickRequest, ForestDecisionTickResponse } from "@/interfaces/forestDecision";
import { ApiClientError, requestApi } from "@/services/apiClient.service";
export class ForestDecisionServiceError extends Error { constructor(message = "Jev decision is temporarily unavailable.", public readonly status?: number) { super(message); } }
export const requestForestDecisions = async (request: ForestDecisionTickRequest): Promise<ForestDecisionTickResponse> => {
  try { return await requestApi<ForestDecisionTickResponse>("/api/forest/decision", { method: "POST", body: JSON.stringify(request) }); }
  catch (error) { if (error instanceof ApiClientError) throw new ForestDecisionServiceError(error.message, error.status); throw new ForestDecisionServiceError(); }
};
