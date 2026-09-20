"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Clock3,
  Gauge,
  Gem,
  Layers3,
  Map,
  Moon,
  Play,
  Sparkles,
  Sun,
  Trophy,
} from "lucide-react";
import { apply, candidatePlans, step } from "@/game/rules";
import { createTown } from "@/game/town";
import type { Town, TownDifficulty } from "@/game/types";
import {
  createTownRenderer,
  type MapView,
  type SceneTheme,
} from "@/renderer/TownView";
import {
  defaultScenePreferences,
  getScenePreferences,
  saveScenePreferences,
  subscribeToScenePreferences,
} from "@/utils/persistenceUtils";
import { isDevelopment } from "@/utils/environment";
import { CrowdPick } from "@/components/CrowdPick";

const createSeed = () => Date.now().toString(36);

const formatTactic = (tactic: string | null) =>
  tactic ? tactic.replaceAll("_", " ") : "WAITING";

const formatRpsMove = (move: "rock" | "paper" | "scissors") =>
  move.charAt(0).toUpperCase() + move.slice(1);

const rpsSymbol = (move: "rock" | "paper" | "scissors") =>
  ({ rock: "✊", paper: "✋", scissors: "✌" })[move];

function ExplorerCard({
  name,
  colour,
  treasures,
  tactic,
  steps,
}: {
  name: "Blue" | "Yellow";
  colour: "blue" | "yellow";
  treasures: number;
  tactic: string | null;
  steps: number;
}) {
  return (
    <article className={`explorer-card explorer-card--${colour}`}>
      <div className="explorer-card__heading">
        <span className="explorer-token" aria-hidden="true" />
        <strong>{name}</strong>
        <span className="score-pill">
          <Gem size={13} aria-hidden="true" />
          {treasures}/3
        </span>
      </div>
      <span className="tactic-pill">{formatTactic(tactic)}</span>
      <span className="steps-label">{steps ? `${steps} steps queued` : "Awaiting route"}</span>
    </article>
  );
}

export function JevTownGame({ initialSeed }: { initialSeed: string }) {
  const [town, setTown] = useState<Town>(() => createTown(initialSeed));
  const [winnerStageSeed, setWinnerStageSeed] = useState<string | null>(null);
  const [rendererReady, setRendererReady] = useState(false);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [rendererHost, setRendererHost] = useState<HTMLDivElement | null>(null);
  const scenePreferences = useSyncExternalStore(
    subscribeToScenePreferences,
    getScenePreferences,
    () => defaultScenePreferences,
  );
  const sceneTheme: SceneTheme = scenePreferences.theme;
  const mapView: MapView = scenePreferences.view;
  const development = isDevelopment();
  const townRef = useRef<Town>(town);
  const renderer = useRef<Awaited<ReturnType<typeof createTownRenderer>> | null>(
    null,
  );
  const attachRendererHost = useCallback((node: HTMLDivElement | null) => {
    setRendererHost(node);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.jevtownTheme = sceneTheme;
  }, [sceneTheme]);

  // The host does not exist during the loading render. A callback ref lets us
  // initialise the renderer exactly when that element is mounted.
  useEffect(() => {
    if (!rendererHost) return;

    let isMounted = true;

    void createTownRenderer(rendererHost)
      .then((nextRenderer) => {
        if (isMounted) {
          renderer.current = nextRenderer;
          // The renderer can resolve after the current town's draw effect.
          // Draw it here as well, so the first scene is never skipped.
          nextRenderer.draw(townRef.current, { theme: "day", view: "plan" });
          setRendererReady(true);
        } else {
          nextRenderer.destroy();
        }
      })
      .catch((error: unknown) => {
        console.error("JevTown renderer failed to initialise", error);
        if (isMounted) setRendererError("Town renderer could not start.");
      });

    return () => {
      isMounted = false;
      setRendererReady(false);
      renderer.current?.destroy();
      renderer.current = null;
    };
  }, [rendererHost]);

  useEffect(() => {
    if (rendererReady) {
      renderer.current?.draw(town, { theme: sceneTheme, view: mapView });
    }
  }, [mapView, rendererReady, sceneTheme, town]);

  useEffect(() => {
    if (town.status !== "running") return;

    const movementTimer = window.setInterval(() => {
      setTown((currentTown) => step(currentTown, 360));
    }, 360);

    const requestLocalDecisions = () => {
      setTown((currentTown) => {
        if (currentTown.status !== "running") return currentTown;

        let nextTown = currentTown;

        (["blue", "yellow"] as const).forEach((battler) => {
          const plans = candidatePlans(nextTown, battler);
          const plan = plans[0];
          if (!plan) return;

          // The current local policy selects one engine-priced candidate. The
          // candidate shape is deliberately compatible with a live Jev choice.
          nextTown = apply(nextTown, {
            battler,
            tactic: plan.tactic,
            target: plan.target,
            confidence: 0.5,
          });
        });

        return nextTown;
      });
    };

    // The first route starts immediately. Subsequent decisions refresh it at
    // the same four-second cadence used by the live Jev loop.
    requestLocalDecisions();
    const decisionTimer = window.setInterval(requestLocalDecisions, 4_000);

    return () => {
      window.clearInterval(movementTimer);
      window.clearInterval(decisionTimer);
    };
  }, [town.seed, town.status]);

  const matchStatus =
    town.status === "finished"
      ? `${town.winner} found all three`
      : town.status === "idle"
        ? "Ready to begin"
        : `${Math.floor(town.elapsed / 1_000)}s elapsed`;
  const winnerName = town.winner
    ? town.winner.charAt(0).toUpperCase() + town.winner.slice(1)
    : null;
  const clashJustDecidedMatch = Boolean(
    town.status === "finished" &&
      town.lastEncounter &&
      town.elapsed - town.lastEncounter.elapsed < 2_200,
  );
  const showWinnerStage = town.status === "finished" && winnerStageSeed === town.seed;
  const showClash = Boolean(
    town.lastEncounter &&
      town.elapsed - town.lastEncounter.elapsed < 2_200 &&
      !showWinnerStage,
  );
  const resetTown = (difficulty: TownDifficulty = town.difficulty) => {
    setWinnerStageSeed(null);
    const next = createTown(createSeed(), difficulty);
    setTown(next);
    if (development) void fetch("/api/crowd", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset", roundId: next.seed }) });
  };

  useEffect(() => {
    if (town.status !== "finished") return;
    const timer = window.setTimeout(
      () => setWinnerStageSeed(town.seed),
      clashJustDecidedMatch ? 2_400 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [clashJustDecidedMatch, town.seed, town.status]);
  useEffect(() => {
    if (!development || town.status !== "finished" || !town.winner) return;
    void fetch("/api/crowd", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "finish", winner: town.winner }) });
  }, [development, town.status, town.winner]);

  return (
    <main className="game-shell min-h-dvh">
      <header>
        <small>LIVE JEV TREASURE HUNT</small>
        <h1>JevTown</h1>
        <code>{town.seed}</code>
        <nav aria-label="Scene controls">
          <button
            className="icon-button"
            aria-label={
              sceneTheme === "day" ? "Switch to night scene" : "Switch to day scene"
            }
            title={
              sceneTheme === "day" ? "Switch to night scene" : "Switch to day scene"
            }
            onClick={() =>
              saveScenePreferences({
                theme: sceneTheme === "day" ? "night" : "day",
                view: mapView,
              })
            }
          >
            {sceneTheme === "day" ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <button
            className="icon-button"
            aria-label={
              mapView === "isometric" ? "Switch to 2D plan" : "Switch to 2.5D scene"
            }
            title={
              mapView === "isometric" ? "Switch to 2D plan" : "Switch to 2.5D scene"
            }
            onClick={() =>
              saveScenePreferences({
                theme: sceneTheme,
                view: mapView === "isometric" ? "plan" : "isometric",
              })
            }
          >
            {mapView === "isometric" ? <Map size={17} /> : <Layers3 size={17} />}
          </button>
        </nav>
      </header>

      <section>
        <div className="town-stage">
          <div ref={attachRendererHost} className="town-canvas" aria-label="JevTown game world" />
          {showClash && town.lastEncounter && (
            <div className="clash-stage" role="status">
              <span>Rock paper scissors · {town.lastEncounter.rounds === 1 ? "decisive round" : `round ${town.lastEncounter.rounds}`}</span>
              <div className="clash-stage__throws">
                <div className="clash-stage__throw clash-stage__throw--blue">
                  <b>Blue</b>
                  <strong>{rpsSymbol(town.lastEncounter.blueMove)}</strong>
                  <em>{formatRpsMove(town.lastEncounter.blueMove)}</em>
                </div>
                <div className="clash-stage__versus">VS</div>
                <div className="clash-stage__throw clash-stage__throw--yellow">
                  <b>Yellow</b>
                  <strong>{rpsSymbol(town.lastEncounter.yellowMove)}</strong>
                  <em>{formatRpsMove(town.lastEncounter.yellowMove)}</em>
                </div>
              </div>
              <strong className="clash-stage__result">
                {town.lastEncounter.winner === "blue" ? "Blue" : "Yellow"} wins the square
                {town.lastEncounter.stolenTreasure ? " and takes a treasure" : ""}.
              </strong>
            </div>
          )}
          {showWinnerStage && winnerName && town.winner && (
            <div className={`town-victory-stage town-victory-stage--${town.winner}`} role="status">
              <Sparkles size={18} aria-hidden="true" />
              <Trophy size={42} aria-hidden="true" />
              <span>Treasure hunt complete</span>
              <strong>{winnerName} wins!</strong>
              <em>All three treasures recovered</em>
            </div>
          )}
        </div>

        <aside className="match-panel">
          <div className="match-panel__topline">
            <span className="eyebrow">
              <Sparkles size={13} aria-hidden="true" /> Treasure hunt
            </span>
            <span className={`status-pill status-pill--${town.status}`}>
              {town.status === "running" ? "Live" : town.status === "finished" ? "Complete" : "Ready"}
            </span>
          </div>

          <div className="match-panel__title">
            <h2>{sceneTheme === "day" ? "Daylight" : "Moonlit"} hunt</h2>
            <p>First explorer to recover three treasures wins.</p>
          </div>

          {showWinnerStage && winnerName && (
            <div className={`winner-banner winner-banner--${town.winner}`}>
              <Trophy size={20} aria-hidden="true" />
              <div>
                <strong>{winnerName} wins</strong>
                <span>Collected all three treasures</span>
              </div>
            </div>
          )}

          <div className="explorer-stack">
            <ExplorerCard
              name="Blue"
              colour="blue"
              treasures={town.blue.treasures.length}
              tactic={town.blue.tactic}
              steps={town.blue.path.length}
            />
            <ExplorerCard
              name="Yellow"
              colour="yellow"
              treasures={town.yellow.treasures.length}
              tactic={town.yellow.tactic}
              steps={town.yellow.path.length}
            />
          </div>

          <CrowdPick />

          <div className="match-summary">
            {town.status === "finished" ? <Trophy size={16} aria-hidden="true" /> : <Clock3 size={16} aria-hidden="true" />}
            <span>{matchStatus}</span>
          </div>
          {town.lastEncounter && (
            <div className="clash-card">
              <span className="eyebrow">Last clash</span>
              <strong>{rpsSymbol(town.lastEncounter.blueMove)} {formatRpsMove(town.lastEncounter.blueMove)} beats {rpsSymbol(town.lastEncounter.yellowMove)} {formatRpsMove(town.lastEncounter.yellowMove)}</strong>
              <span>
                {town.lastEncounter.winner === "blue" ? "Blue" : "Yellow"} holds the square{town.lastEncounter.stolenTreasure ? " and takes a treasure" : "."}
              </span>
            </div>
          )}
          {rendererError && <p role="alert">{rendererError}</p>}
          {development && <div className="panel-controls">
            <div className="difficulty-selector" aria-label="Hunt difficulty">
              <span><Gauge size={14} aria-hidden="true" /> Hunt difficulty</span>
              <div>
                <button className={town.difficulty === "standard" ? "is-selected" : ""} onClick={() => resetTown("standard")}>Standard</button>
                <button className={town.difficulty === "hard" ? "is-selected" : ""} onClick={() => resetTown("hard")}>Hard</button>
              </div>
            </div>
            <div className="primary-actions">
              <button className="new-town-button" onClick={() => resetTown()}>
                New town
              </button>
              <button
                className="start-button"
                disabled={town.status !== "idle"}
                onClick={() => {
                  setTown((currentTown) => ({ ...currentTown, status: "running" }));
                  void fetch("/api/crowd", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lock" }) });
                }}
              >
                <Play size={15} fill="currentColor" aria-hidden="true" />
                {town.status === "idle" ? "Start hunt" : town.status === "running" ? "Running" : "Start new"}
              </button>
            </div>
          </div>}
        </aside>
      </section>
    </main>
  );
}
