"use client";

import { CrowdPickLockedError } from "@/services/crowd.service";

type CrowdLifecycleOperation = () => Promise<unknown>;
type CrowdLifecycleFailureHandler = (error: unknown) => void;

export interface CrowdLifecycleQueue {
  enqueue(operation: CrowdLifecycleOperation): void;
}

export const createCrowdLifecycleQueue = (
  onUnexpectedFailure: CrowdLifecycleFailureHandler,
): CrowdLifecycleQueue => {
  let pending = Promise.resolve();

  return {
    enqueue(operation) {
      pending = pending
        .catch(() => undefined)
        .then(async () => {
          await operation();
        })
        .catch((error) => {
          if (!(error instanceof CrowdPickLockedError)) {
            onUnexpectedFailure(error);
          }
        });
    },
  };
};
