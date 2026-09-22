export type CrowdSide = "blue" | "yellow";
export type CrowdPhase = "open" | "locked" | "finished";

export interface CrowdState {
  roundId: string;
  phase: CrowdPhase;
  blue: number;
  yellow: number;
  bluePercent: number;
  yellowPercent: number;
  winner: CrowdSide | null;
}

export type CrowdActionRequest =
  | { action: "pick"; side: CrowdSide; roundId: string }
  | { action: "reset"; roundId: string }
  | { action: "lock"; roundId: string }
  | { action: "finish"; roundId: string; winner: CrowdSide };

