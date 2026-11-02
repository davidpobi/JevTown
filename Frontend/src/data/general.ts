export const GENERAL = {
  appName: "JevTown",
  games: {
    hunt: {
      name: "Jev Hunt",
      route: "/hunt",
      description: "Two explorers race to recover three treasures.",
    },
    run: {
      name: "Jev Run",
      route: "/run",
      description: "Two Jevs navigate a live tactical maze.",
    },
    forest: {
      name: "Jev Forest",
      route: "/forest",
      description: "Two Jevs race through a hidden forest for three relics.",
    },
  },
} as const;
