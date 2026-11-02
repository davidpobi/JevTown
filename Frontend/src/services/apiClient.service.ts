"use client";

import type { ApiErrorResponse } from "@/interfaces/api";

export class ApiClientError extends Error {
  constructor(message: string, public readonly status: number, public readonly responseBody?: unknown) {
    super(message);
  }
}

const errorMessage = (body: unknown, fallback: string) =>
  body && typeof body === "object" && "error" in body && typeof body.error === "string"
    ? body.error
    : fallback;

export const requestApi = async <TResponse>(
  path: string,
  init: RequestInit = {},
): Promise<TResponse> => {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const body = await response.json().catch(() => null) as TResponse | ApiErrorResponse | null;
  if (!response.ok) throw new ApiClientError(errorMessage(body, "The request could not be completed."), response.status, body);
  return body as TResponse;
};

