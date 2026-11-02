# JevTown

> **Playable worlds for observable AI decisions.**

[![JevTown gameplay](https://firebasestorage.googleapis.com/v0/b/bashbash-labs.firebasestorage.app/o/projects%2FJevTown%2Fupscaledjev.webp?alt=media&token=062efa44-0b61-4ee8-a3b1-ede059a3688c)](https://firebasestorage.googleapis.com/v0/b/bashbash-labs.firebasestorage.app/o/projects%2FJevTown%2FJEVTOWN-4K.mov?alt=media&token=5a7883bd-6319-4360-8435-963082f4236f)

**[Watch the 4K gameplay demo ↗](https://firebasestorage.googleapis.com/v0/b/bashbash-labs.firebasestorage.app/o/projects%2FJevTown%2FJEVTOWN-4K.mov?alt=media&token=5a7883bd-6319-4360-8435-963082f4236f)**

JevTown is a collection of interactive game experiments built around [`typesafe/jev-1.13`](https://openrouter.ai/typesafe/jev-1.13). It turns a model’s strategic choices into legible, animated games—without handing the model control of the rules.

The Jev model chooses from engine-generated legal plans. Deterministic TypeScript owns hidden information, routes, movement, clashes, scoring, and winners.

## The idea

Most AI demos hide the decision behind a response. JevTown puts the decision on the board.

```text
Game state → legal strategic plans → Jev chooses one → engine executes it → spectators see why
```

This creates an AI experience that is both expressive and inspectable: the model supplies strategy; the system supplies truth.

## Worlds

| World | The challenge |
| --- | --- |
| **Jev Hunt** | Two explorers discover a town, race for three hidden treasures, and resolve contested squares with rock-paper-scissors. |
| **Jev Run** | Two Jevs navigate a tactical maze, competing for a key and gateway while their routes remain engine-validated. |
| **Jev Forest** | Two Jevs explore a hidden forest, scout terrain, collect relics, and intercept a rival through authored scene landmarks. |

Each world has its own rules and visual language, but uses the same core boundary: no model-generated coordinates, no invented objectives, and no model-decided winner.

## What makes it interesting

- **Bounded AI agency** — every decision is selected from an engine-generated, legal choice set.
- **Deterministic resolution** — pathfinding, world discovery, rock-paper-scissors clashes, scoring, and victory conditions remain reproducible application logic.
- **Inspectable play** — decision feeds expose tactics, confidence, routes, events, and outcomes instead of presenting a black-box simulation.
- **Designed interaction** — Pixi-rendered worlds, responsive UI, day/night modes, generated ambient sound, and lightweight event effects make the system feel like a game rather than a dashboard.
- **Real-time foundation** — Firebase Realtime Database projections support public live state; Upstash supports atomic Crowd Pick state and recent replay persistence.

## Architecture

```text
                    Typesafe Jev
                         │
                         ▼
       legal plans ← decision API → validated tactic
            │                              │
            └──── deterministic game engine ┘
                           │
          live projection / crowd state / replay events
                           │
                        spectators
```

The app is structured around typed contracts, client services, thin validated routes, and adjacent server operations. Zod validates request boundaries; server-only configuration protects provider, Firebase Admin, and Upstash credentials.

## Stack

Next.js · React · TypeScript · PixiJS · Zod · Firebase Realtime Database · Upstash Redis · Tone.js · ZzFX · Vitest

## Current status

JevTown is a playable local and preview system. Its live-state, crowd-pick, and replay foundations are in place.

The next production milestone is an authoritative runner: a protected server process that starts matches, invokes Jev, advances the engines, and publishes the shared global state. Until that lands, this repository does not claim continuously running global games.

## Run locally

The application lives in [`Frontend`](./Frontend).

```bash
cd Frontend
npm install
cp .env.example .env.local
npm run dev
```

`OPENROUTER_API_KEY` is required for Jev-powered decision previews. Firebase and Upstash credentials enable the optional live-state, Crowd Pick, and replay infrastructure. Keep all non-`NEXT_PUBLIC_` values server-side.

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Built by BashBash Labs

JevTown is a product and systems-design experiment by [BashBash Labs](https://www.bashbashlabs.com): making AI behavior useful not by hiding complexity, but by giving people a way to see it, understand it, and play with it.
