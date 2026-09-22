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
  Volume2,
  VolumeX,
} from "lucide-react";
import { apply, step } from "@/game/rules";
import { toHuntDecisionSnapshot } from "@/game/huntDecision";
import { createTown } from "@/game/town";
import { fromLiveHuntMatchState, toLiveHuntMatchState } from "@/game/townLiveMatch";
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
import {
  isDevelopment,
  isHuntPreviewPlayEnabled,
  isLocalDevelopment,
} from "@/utils/environment";
import { GameSound } from "@/utils/soundUtils";
import { CrowdPick } from "@/components/CrowdPick";
import { GENERAL } from "@/data/general";
import Link from "next/link";
import {
  finishCrowdRound,
  lockCrowdRound,
  resetCrowdRound,
} from "@/services/crowd.service";
import { createCrowdLifecycleQueue } from "@/services/crowdLifecycle.service";
import {
  canMirrorLocalHuntMatch,
  publishLocalHuntMatch,
  subscribeToGlobalHuntMatch,
} from "@/services/huntLiveMatch.service";
import { requestHuntDecisions } from "@/services/huntDecision.service";

const createSeed = () => Date.now().toString(36);

const formatTactic = (tactic: string | null) =>
  tactic ? tactic.replaceAll("_", " ") : "WAITING";

const formatRpsMove = (move: "rock" | "paper" | "scissors") =>
  move.charAt(0).toUpperCase() + move.slice(1);

const rpsSymbol = (move: "rock" | "paper" | "scissors") =>
  ({ rock: "✊", paper: "✋", scissors: "✌" })[move];

const liveEventFor = (town: Town) => {
  if (town.status === "finished" && town.winner) {
    return { kind: "finished" as const, message: `${town.winner} found all three treasures.` };
  }

  if (town.status === "paused") {
    return { kind: "paused" as const, message: "Hunt paused." };
  }

  if (town.lastEncounter && town.elapsed - town.lastEncounter.elapsed < 500) {
    return { kind: "clash" as const, message: "Blue and Yellow clashed." };
  }

  if (town.status === "running") {
    return { kind: "decision" as const, message: "Explorers chose their next routes." };
  }

  return { kind: "ready" as const, message: "Hunt ready to begin." };
};

function ExplorerCard({
  name,
  colour,
  treasures,
  tactic,
  confidence,
  steps,
}: {
  name: "Blue" | "Yellow";
  colour: "blue" | "yellow";
  treasures: number;
  tactic: string | null;
  confidence: number | null;
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
      <span className="tactic-pill">
        {formatTactic(tactic)}{confidence === null ? "" : ` · ${Math.round(confidence * 100)}%`}
      </span>
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
  const localDevelopment = isLocalDevelopment();
  const huntPreviewPlay = isHuntPreviewPlayEnabled();
  const localPlayEnabled = localDevelopment || huntPreviewPlay;
  const localLiveMirrorConfigured = canMirrorLocalHuntMatch();
  const townRef = useRef<Town>(town);
  const renderer = useRef<Awaited<ReturnType<typeof createTownRenderer>> | null>(
    null,
  );
  const observedTownRef = useRef(town);
  const soundRef = useRef<GameSound | null>(null);
  const initialCrowdRoundBound = useRef(false);
  const liveVersionRef = useRef(0);
  const lastLocalLiveSignatureRef = useRef<string | null>(null);
  const localLiveMirrorUnavailableRef = useRef(false);
  const decisionPendingRef = useRef(false);
  const decisionTurnRef = useRef(0);
  const [soundMuted, setSoundMuted] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [crowdLifecycleError, setCrowdLifecycleError] = useState<string | null>(null);
  const [crowdLifecycleQueue] = useState(() =>
    createCrowdLifecycleQueue(() => {
      setCrowdLifecycleError("Crowd Pick is temporarily unavailable. The local hunt continues.");
    }),
  );

  const attachRendererHost = useCallback((node: HTMLDivElement | null) => {
    setRendererHost(node);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.jevtownTheme = sceneTheme;
  }, [sceneTheme]);

  useEffect(() => {
    townRef.current = town;
  }, [town]);

  useEffect(() => {
    const sound = new GameSound("jevtown");
    soundRef.current = sound;
    const frame = window.requestAnimationFrame(() => setSoundMuted(sound.isMuted()));
    return () => { window.cancelAnimationFrame(frame); sound.dispose(); };
  }, []);

  useEffect(() => {
    if (localPlayEnabled) {
      return;
    }

    return subscribeToGlobalHuntMatch(
      (state) => {
        if (!state) {
          return;
        }

        setTown(fromLiveHuntMatchState(state));
      },
      () => setRendererError("Live hunt is temporarily unavailable."),
    );
  }, [localPlayEnabled]);

  useEffect(() => {
    if (
      !localDevelopment
      || !localLiveMirrorConfigured
      || localLiveMirrorUnavailableRef.current
    ) {
      return;
    }

    const signature = [
      town.seed,
      town.status,
      town.winner,
      town.blue.tactic,
      town.yellow.tactic,
      town.blue.treasures.length,
      town.yellow.treasures.length,
      town.blue.known.size,
      town.yellow.known.size,
      town.lastEncounter?.elapsed,
    ].join(":");

    if (lastLocalLiveSignatureRef.current === signature) {
      return;
    }

    lastLocalLiveSignatureRef.current = signature;
    const state = toLiveHuntMatchState(
      town,
      ++liveVersionRef.current,
      liveEventFor(town),
    );

    void publishLocalHuntMatch(state).catch(() => {
      localLiveMirrorUnavailableRef.current = true;
    });
  }, [localDevelopment, localLiveMirrorConfigured, town]);

  useEffect(() => {
    if (
      initialCrowdRoundBound.current
      || !development
      || localPlayEnabled
    ) {
      return;
    }

    initialCrowdRoundBound.current = true;
    crowdLifecycleQueue.enqueue(() => resetCrowdRound("hunt", town.seed));
  }, [crowdLifecycleQueue, development, localPlayEnabled, town.seed]);

  useEffect(() => {
    const previous = observedTownRef.current;
    if (previous.seed === town.seed) {
      if (town.blue.treasures.length > previous.blue.treasures.length || town.yellow.treasures.length > previous.yellow.treasures.length) {
        void soundRef.current?.play("pickup");
      }
      if (town.lastEncounter && town.lastEncounter !== previous.lastEncounter) {
        void soundRef.current?.play("clash");
        if (town.lastEncounter.stolenTreasure) void soundRef.current?.play("steal");
      }
      if (previous.status !== "finished" && town.status === "finished") {
        void soundRef.current?.play("win");
        soundRef.current?.stopMusic();
      }
    }
    observedTownRef.current = town;
  }, [town]);

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

  const requestLocalDecisions = useCallback(async () => {
    const currentTown = townRef.current;
    if (decisionPendingRef.current || currentTown.status !== "running") return;

    decisionPendingRef.current = true;
    try {
      const snapshots = [
        toHuntDecisionSnapshot(currentTown, "blue"),
        toHuntDecisionSnapshot(currentTown, "yellow"),
      ] as const;
      const result = await requestHuntDecisions({
        kind: "tick",
        matchId: currentTown.seed,
        turn: ++decisionTurnRef.current,
        elapsedMs: currentTown.elapsed,
        snapshots: [snapshots[0], snapshots[1]],
      });

      setTown((previousTown) => {
        if (previousTown.seed !== currentTown.seed || previousTown.status !== "running") {
          return previousTown;
        }
        return result.decisions.reduce(
          (nextTown, decision) => apply(nextTown, decision),
          previousTown,
        );
      });
      setDecisionError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Jev decision is temporarily unavailable.";
      setDecisionError(message);
      setTown((previousTown) => previousTown.seed === currentTown.seed
        ? { ...previousTown, status: "paused" }
        : previousTown);
    } finally {
      decisionPendingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!localPlayEnabled || town.status !== "running") return;

    const movementTimer = window.setInterval(() => {
      setTown((currentTown) => step(currentTown, 360));
    }, 360);

    void requestLocalDecisions();
    const decisionTimer = window.setInterval(() => void requestLocalDecisions(), 4_000);

    return () => {
      window.clearInterval(movementTimer);
      window.clearInterval(decisionTimer);
    };
  }, [localPlayEnabled, requestLocalDecisions, town.seed, town.status]);

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
    setDecisionError(null);
    decisionPendingRef.current = false;
    decisionTurnRef.current = 0;
    const next = createTown(createSeed(), difficulty);
    setTown(next);
    soundRef.current?.stopMusic();
    if (development && !localPlayEnabled) {
      crowdLifecycleQueue.enqueue(() => resetCrowdRound("hunt", next.seed));
    }
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
    const winner = town.winner;
    if (!development || localPlayEnabled || town.status !== "finished" || !winner) return;
    crowdLifecycleQueue.enqueue(() => finishCrowdRound("hunt", town.seed, winner));
  }, [crowdLifecycleQueue, development, localPlayEnabled, town.seed, town.status, town.winner]);

  return (
    <main className="game-shell min-h-dvh">
      <header>
        <small>
          <Link className="app-home-link" href="/" aria-label={`${GENERAL.appName} home`}>
            {GENERAL.appName}
          </Link>
          {" · LIVE GAME"}
        </small>
        <h1>{GENERAL.games.hunt.name}</h1>
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
            aria-label={soundMuted ? "Enable sound" : "Mute sound"}
            title={soundMuted ? "Enable sound" : "Mute sound"}
            onClick={() => {
              const muted = !soundMuted;
              soundRef.current?.setMuted(muted);
              setSoundMuted(muted);
            }}
          >
            {soundMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
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
              <span>{GENERAL.games.hunt.name} complete</span>
              <strong>{winnerName} wins!</strong>
              <em>All three treasures recovered</em>
            </div>
          )}
        </div>

        <aside className={`match-panel${town.status === "finished" ? " match-panel--finished" : ""}`}>
          <div className="match-panel__topline">
            <span className="eyebrow">
              <Sparkles size={13} aria-hidden="true" /> {GENERAL.games.hunt.name}
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
              confidence={town.blue.confidence}
              steps={town.blue.path.length}
            />
            <ExplorerCard
              name="Yellow"
              colour="yellow"
              treasures={town.yellow.treasures.length}
              tactic={town.yellow.tactic}
              confidence={town.yellow.confidence}
              steps={town.yellow.path.length}
            />
          </div>

          {!localPlayEnabled && <CrowdPick game="hunt" />}
          {crowdLifecycleError && <p className="crowd-pick-error" role="alert">{crowdLifecycleError}</p>}

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
          {decisionError && <p role="alert">{decisionError}</p>}
          {localPlayEnabled && <div className="panel-controls">
            <div className="difficulty-selector" aria-label="Hunt difficulty">
              <span><Gauge size={14} aria-hidden="true" /> Hunt difficulty</span>
              <div>
                <button className={town.difficulty === "standard" ? "is-selected" : ""} onClick={() => resetTown("standard")}>Standard</button>
                <button className={town.difficulty === "hard" ? "is-selected" : ""} onClick={() => resetTown("hard")}>Hard</button>
              </div>
            </div>
            <div className="primary-actions">
              <button className="new-town-button" onClick={() => resetTown()}>
                New hunt
              </button>
              <button
                className="start-button"
                disabled={town.status !== "idle"}
                onClick={() => {
                  setTown((currentTown) => ({ ...currentTown, status: "running" }));
                  void soundRef.current?.play("start");
                  void soundRef.current?.startMusic();
                  if (development && !localPlayEnabled) {
                    crowdLifecycleQueue.enqueue(() => lockCrowdRound("hunt", town.seed));
                  }
                }}
              >
                <Play size={15} fill="currentColor" aria-hidden="true" />
                {town.status === "idle" ? "Start hunt" : town.status === "running" ? "Running" : "Start new"}
              </button>
            </div>
          </div>}
        </aside>
      </section>
      <p className="demo-credit">A <a href="https://www.bashbashlabs.com" target="_blank" rel="noreferrer">BashBash Labs</a> demo</p>
    </main>
  );
}
