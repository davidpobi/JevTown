export type GameKind = "hunt" | "run";

export const crowdApiPathFor = (game: GameKind) => `/api/crowd/${game}`;

export const crowdStoragePrefixFor = (game: GameKind) =>
  `jev:${game}:crowd-pick`;

export const crowdStateEventFor = (game: GameKind) =>
  `jev:${game}:crowd-state-updated`;
