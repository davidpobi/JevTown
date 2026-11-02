"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Gauge, Moon, Sparkles, Sun, Trophy, Volume2, VolumeX } from "lucide-react";
import { applyClash, applyDecision, createMatch, stepMatch, toSnapshot } from "@/game/run/engine";
import { fromLiveMatchState, toLiveMatchState } from "@/game/run/liveMatch";
import { createSeed } from "@/game/run/maze";
import type { GameDifficulty, GameMode, JevDecision, Match, Point } from "@/game/run/types";
import type { LiveMatchEvent } from "@/run/interfaces/liveMatch";
import { completeJevMatch, requestJevClash, requestJevDecisions } from "@/run/services/decision.service";
import {
  finishCrowdRound,
  lockCrowdRound,
  resetCrowdRound,
} from "@/services/crowd.service";
import {
  createCrowdLifecycleQueue,
} from "@/services/crowdLifecycle.service";
import {
  canMirrorLocalLiveMatch,
  publishLocalLiveMatch,
  subscribeToGlobalLiveMatch,
} from "@/run/services/liveMatch.service";
import {
  defaultScenePreferences,
  getScenePreferences,
  saveScenePreferences,
  subscribeToScenePreferences,
} from "@/run/utils/persistenceUtils";
import { isDevelopment, isLocalDevelopment } from "@/utils/environment";
import { GameSound } from "@/run/utils/soundUtils";
import { CrowdPick } from "@/components/CrowdPick";
import { GENERAL } from "@/data/general";
import Link from "next/link";

type SceneTheme = "day" | "night";
type ClashMoment = {
  blueMove: "ROCK" | "PAPER" | "SCISSORS";
  yellowMove: "ROCK" | "PAPER" | "SCISSORS";
  winner: "blue" | "yellow" | null;
  previousKeyHolder: "blue" | "yellow" | null;
};

const colors = {
  blue: "#36a9db",
  yellow: "#e8b632",
  key: "#f1d47a",
  exit: "#8c70d8",
  signal: "#c870d6",
};

const scenePalette = {
  day: {
    floor: "#e9f0df",
    wall: "#88a378",
    background: "#fffdf7",
    routeBlue: "rgba(54, 169, 219, .36)",
    routeYellow: "rgba(211, 153, 41, .38)",
  },
  night: {
    floor: "#0b121e",
    wall: "#1c2b3d",
    background: "#090e17",
    routeBlue: "rgba(87, 202, 234, .4)",
    routeYellow: "rgba(244, 198, 85, .42)",
  },
} as const;
const size = 36;

const drawCell = (context: CanvasRenderingContext2D, point: Point, color: string, inset = 0) => {
  context.fillStyle = color;
  context.fillRect(point.x * size + inset, point.y * size + inset, size - inset * 2, size - inset * 2);
};

const drawGateway = (
  context: CanvasRenderingContext2D,
  point: Point,
  active: boolean,
  theme: SceneTheme,
) => {
  const x = (point.x + 0.5) * size;
  const y = (point.y + 0.5) * size;
  const colour = active ? colors.exit : theme === "day" ? "#a89e8f" : "#59677d";

  context.save();
  context.shadowColor = active ? "#b291ff" : "transparent";
  context.shadowBlur = active ? 18 : 0;
  context.fillStyle = theme === "day" ? "#f7f3ea" : "#111a28";
  context.beginPath();
  context.ellipse(x, y + 4, 10, 13, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = colour;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(x, y + 3, 10, Math.PI, 0);
  context.lineTo(x + 10, y + 12);
  context.lineTo(x - 10, y + 12);
  context.closePath();
  context.stroke();
  context.globalAlpha = active ? 0.8 : 0.4;
  context.strokeStyle = active ? "#e5d5ff" : colour;
  context.lineWidth = 1.5;
  context.beginPath();
  context.ellipse(x, y + 3, 5, 8, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
};

const draw = (canvas: HTMLCanvasElement, match: Match, theme: SceneTheme) => {
  const context = canvas.getContext("2d");
  if (!context) return;
  const palette = scenePalette[theme];
  canvas.width = match.maze.width * size;
  canvas.height = match.maze.height * size;
  context.fillStyle = palette.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < match.maze.height; y += 1) for (let x = 0; x < match.maze.width; x += 1) {
    const point = { x, y };
    drawCell(context, point, palette.floor);
    if (match.maze.walls[y][x]) drawCell(context, point, palette.wall, 1);
  }
  for (const battler of [match.blue, match.yellow]) {
    context.strokeStyle = battler.id === "blue" ? palette.routeBlue : palette.routeYellow;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo((battler.position.x + .5) * size, (battler.position.y + .5) * size);
    battler.path.slice(0, 8).forEach((point) => context.lineTo((point.x + .5) * size, (point.y + .5) * size));
    context.stroke();
  }
  if (match.mode === "extraction" && !match.keyHolder) {
    const x = (match.key.x + 0.5) * size;
    const y = (match.key.y + 0.5) * size;
    context.save();
    context.shadowColor = "#f1d47a";
    context.shadowBlur = 13;
    context.strokeStyle = colors.key;
    context.fillStyle = colors.key;
    context.lineWidth = 3.5;
    context.beginPath();
    context.arc(x - 7, y - 2, 6, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(x - 1, y - 4);
    context.lineTo(x + 11, y - 4);
    context.lineTo(x + 11, y);
    context.lineTo(x + 7, y);
    context.lineTo(x + 7, y + 5);
    context.lineTo(x + 3, y + 5);
    context.lineTo(x + 3, y);
    context.lineTo(x - 1, y);
    context.closePath();
    context.fill();
    context.restore();
  }
  if (match.mode === "signal-hunt") match.signals.forEach((signal) => {
    context.strokeStyle = colors.signal;
    context.lineWidth = 3;
    context.strokeRect(signal.x * size + 10, signal.y * size + 10, size - 20, size - 20);
  });
  if (match.mode === "extraction") {
    drawGateway(context, match.exit, Boolean(match.keyHolder), theme);
  }
  for (const battler of [match.blue, match.yellow]) {
    context.shadowColor = battler.id === "blue" ? colors.blue : colors.yellow;
    context.shadowBlur = 16;
    context.fillStyle = battler.id === "blue" ? colors.blue : colors.yellow;
    context.beginPath();
    context.arc((battler.position.x + .5) * size, (battler.position.y + .5) * size, 10, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    if (match.keyHolder === battler.id) {
      context.strokeStyle = colors.key;
      context.lineWidth = 2;
      context.stroke();
    }
  }
};

const decisionLabel = (match: Match, id: "blue" | "yellow") => {
  const battler = match[id];
  return battler.tactic ? `${battler.tactic.replaceAll("_", " ")} · ${Math.round((battler.confidence ?? 0) * 100)}%` : "WAITING FOR JEV";
};

const exitKnowledgeLabel = (match: Match, id: "blue" | "yellow") =>
  match.mode === "signal-hunt"
    ? `SIGNALS ${match.capturedSignals[id].length}/${match.signals.length} · ${Object.keys(match.knownSignals[id]).length} DISCOVERED`
    :
  [
    match.knownKeys[id] || match.keyHolder ? "KEY DISCOVERED" : "KEY UNKNOWN",
    match.knownExits[id] ? "EXIT DISCOVERED" : "EXIT UNKNOWN",
  ].join(" · ");

const rpsSymbol = (move: ClashMoment["blueMove"]) =>
  ({ ROCK: "✊", PAPER: "✋", SCISSORS: "✌" })[move];

const liveEventFor = (match: Match): LiveMatchEvent => {
  if (match.status === "waiting") {
    return { kind: "ready", message: "Maze ready" };
  }

  if (match.status === "clash") {
    return { kind: "clash", message: "Blue and Yellow clash" };
  }

  if (match.status === "finished") {
    return { kind: "finished", message: `${match.winner?.toUpperCase()} wins` };
  }

  if (match.status === "paused") {
    return { kind: "paused", message: "Jev is reconnecting" };
  }

  if (match.keyHolder) {
    return { kind: "key", message: `${match.keyHolder.toUpperCase()} has the key` };
  }

  return { kind: "decision", message: "Jev made a move" };
};

function FeedEntry({ item }: { item: string }) {
  const matched = item.match(/^(BLUE|YELLOW|CLASH)\b\s*(?:→\s*)?(.*)$/);
  const actor = matched?.[1] ?? "JEV";
  const detail = matched?.[2] ?? item;
  const tone = actor.toLowerCase();

  return (
    <p className={`feed-entry feed-entry--${tone}`}>
      <span className="feed-entry__actor">{actor}</span>
      <span className="feed-entry__detail">{detail}</span>
    </p>
  );
}

export function JevXGame() {
  const [match, setMatch] = useState(() => createMatch(createSeed()));
  const [feed, setFeed] = useState<string[]>([]);
  const [clashMoment, setClashMoment] = useState<ClashMoment | null>(null);
  const scenePreferences = useSyncExternalStore(
    subscribeToScenePreferences,
    getScenePreferences,
    () => defaultScenePreferences,
  );
  const sceneTheme: SceneTheme = scenePreferences.theme;
  const development = isDevelopment();
  const localDevelopment = isLocalDevelopment();
  const localLiveMirrorConfigured = canMirrorLocalLiveMatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const feedScrollRef = useRef<HTMLDivElement>(null);
  const matchRef = useRef(match);
  const decisionPending = useRef(false);
  const turnRef = useRef(0);
  const lastStepAt = useRef<number | null>(null);
  const observedMatchRef = useRef(match);
  const soundRef = useRef<GameSound | null>(null);
  const liveVersionRef = useRef(0);
  const lastLocalLiveSignatureRef = useRef<string | null>(null);
  const localLiveMirrorUnavailableRef = useRef(false);
  const initialCrowdRoundBound = useRef(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [crowdLifecycleError, setCrowdLifecycleError] = useState<string | null>(null);
  const [liveMatchError, setLiveMatchError] = useState<string | null>(null);

  const [crowdLifecycleQueue] = useState(() =>
    createCrowdLifecycleQueue(() => {
      setCrowdLifecycleError("Crowd Pick is temporarily unavailable. Local match continues.");
    }),
  );

  const enqueueCrowdLifecycle = useCallback((operation: () => Promise<unknown>) => {
    crowdLifecycleQueue.enqueue(operation);
  }, [crowdLifecycleQueue]);

  useEffect(() => {
    const sound = new GameSound("jevx");
    soundRef.current = sound;
    const frame = window.requestAnimationFrame(() => setSoundMuted(sound.isMuted()));
    return () => { window.cancelAnimationFrame(frame); sound.dispose(); };
  }, []);

  useEffect(() => { matchRef.current = match; }, [match]);
  useEffect(() => {
    if (
      initialCrowdRoundBound.current
      || !development
      || localDevelopment
    ) {
      return;
    }

    initialCrowdRoundBound.current = true;
    enqueueCrowdLifecycle(() => resetCrowdRound("run", match.maze.seed));
  }, [development, enqueueCrowdLifecycle, localDevelopment, match.maze.seed]);
  useEffect(() => {
    if (localDevelopment) {
      return;
    }

    return subscribeToGlobalLiveMatch(
      (state) => {
        if (!state) {
          return;
        }

        setLiveMatchError(null);
        setMatch(fromLiveMatchState(state));
      },
      () => setLiveMatchError("Live match is temporarily unavailable."),
    );
  }, [localDevelopment]);
  useEffect(() => {
    if (!localDevelopment || !localLiveMirrorConfigured || localLiveMirrorUnavailableRef.current) {
      return;
    }

    const signature = [
      match.maze.seed,
      turnRef.current,
      match.status,
      match.keyHolder,
      match.winner,
      match.blue.tactic,
      match.yellow.tactic,
    ].join(":");

    if (lastLocalLiveSignatureRef.current === signature) {
      return;
    }

    lastLocalLiveSignatureRef.current = signature;
    const state = toLiveMatchState(match, ++liveVersionRef.current, liveEventFor(match));
    void publishLocalLiveMatch(state).catch(() => {
      localLiveMirrorUnavailableRef.current = true;
    });
  }, [localDevelopment, localLiveMirrorConfigured, match]);
  useEffect(() => {
    document.documentElement.dataset.jevxTheme = sceneTheme;
  }, [sceneTheme]);
  useEffect(() => {
    if (canvasRef.current) draw(canvasRef.current, match, sceneTheme);
  }, [match, sceneTheme]);
  useEffect(() => {
    const feedElement = feedScrollRef.current;
    if (!feedElement) return;
    feedElement.scrollTo({ top: feedElement.scrollHeight, behavior: "smooth" });
  }, [feed]);
  useEffect(() => {
    if (!clashMoment) return;
    const timer = window.setTimeout(() => setClashMoment(null), 2_400);
    return () => window.clearTimeout(timer);
  }, [clashMoment]);
  useEffect(() => {
    const previous = observedMatchRef.current;
    if (previous.maze.seed !== match.maze.seed) {
      observedMatchRef.current = match;
      return;
    }
    const events: string[] = [];
    (['blue', 'yellow'] as const).forEach((id) => {
      const name = id.toUpperCase();
      const corridor = match.maze.corridorByCell[match[id].position.y][match[id].position.x];
      if (match.mode === "extraction" && !previous.knownKeys[id] && match.knownKeys[id]) {
        events.push(`${name} DISCOVERED KEY · ${corridor}`);
      }
      if (match.mode === "extraction" && !previous.knownExits[id] && match.knownExits[id]) {
        events.push(`${name} DISCOVERED EXIT · ${corridor}`);
      }
      match.signals.forEach((_, index) => {
        const signal = `S${index + 1}`;
        if (!previous.knownSignals[id][signal] && match.knownSignals[id][signal]) {
          events.push(`${name} DISCOVERED ${signal} · ${corridor}`);
        }
      });
      if (match.capturedSignals[id].length > previous.capturedSignals[id].length) {
        events.push(`${name} CAPTURED ${match.capturedSignals[id].at(-1)}`);
      }
    });
    if (events.some((event) => event.includes("DISCOVERED"))) {
      void soundRef.current?.play("discover");
    }
    if (!previous.keyHolder && match.keyHolder) {
      events.push(`${match.keyHolder.toUpperCase()} TOOK THE KEY`);
      void soundRef.current?.play("pickup");
    }
    if (previous.keyHolder && match.keyHolder && previous.keyHolder !== match.keyHolder) {
      events.push(`${match.keyHolder.toUpperCase()} STOLE THE KEY FROM ${previous.keyHolder.toUpperCase()}`);
      void soundRef.current?.play("steal");
    }
    if (previous.status !== "finished" && match.status === "finished") {
      events.push(
        match.mode === "signal-hunt"
          ? `${match.winner!.toUpperCase()} WON SIGNAL HUNT`
          : `${match.winner!.toUpperCase()} ESCAPED`,
      );
      void soundRef.current?.play("win");
      soundRef.current?.stopMusic();
    }
    if (events.length) {
      setFeed((items) => [...items, ...events]);
    }
    observedMatchRef.current = match;
  }, [match]);

  const getDecisions = useCallback(async () => {
    const current = matchRef.current;
    if (decisionPending.current || current.status !== "running") {
      return;
    }
    decisionPending.current = true;
    try {
      const snapshots = [toSnapshot(current, "blue"), toSnapshot(current, "yellow")] as [
        ReturnType<typeof toSnapshot>,
        ReturnType<typeof toSnapshot>,
      ];
      const payload = await requestJevDecisions({
        kind: "tick",
        matchId: current.maze.seed,
        turn: ++turnRef.current,
        elapsedMs: current.elapsedMs,
        snapshots,
      });
      const decisions: JevDecision[] = payload.decisions;
      setMatch((previous) => {
        let updated = previous;
        decisions.forEach((decision) => {
          updated = applyDecision(updated, decision);
        });
        return { ...updated, status: "running", error: null };
      });
      setFeed((previous) => [
        ...previous,
        ...decisions.map((decision) => {
          const snapshot = snapshots.find((candidate) => candidate.battler === decision.battler)!;
          const chosen = snapshot.plans.find(
            (plan) => plan.tactic === decision.tactic && plan.frontierId === decision.frontierId,
          )!;
          const alternative = snapshot.plans.find((plan) => plan.id !== chosen.id);
          return `${decision.battler.toUpperCase()} → ${decision.tactic.replaceAll("_", " ")} · ${chosen.steps} steps · ${chosen.target}${alternative ? ` · over ${alternative.tactic.replaceAll("_", " ")}` : ""}`;
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Jev decision unavailable.";
      setMatch((previous) => ({ ...previous, status: "paused", error: message }));
    } finally {
      decisionPending.current = false;
    }
  }, []);

  const resolveClash = useCallback(async () => {
    const current = matchRef.current;
    if (!current.clash || decisionPending.current) return;
    decisionPending.current = true;
    try {
      const payload = await requestJevClash({ kind: "clash", matchId: current.maze.seed, turn: ++turnRef.current, cell: current.clash.cell, snapshots: [toSnapshot(current, "blue"), toSnapshot(current, "yellow")] });
      const clash = payload.clash;
      setMatch((previous) => applyClash(previous, clash));
      const blue = clash.throws.find((throwResult) => throwResult.battler === "blue")!;
      const yellow = clash.throws.find((throwResult) => throwResult.battler === "yellow")!;
      const stoleKey = current.keyHolder && clash.winner && current.keyHolder !== clash.winner;
      setClashMoment({ blueMove: blue.move, yellowMove: yellow.move, winner: clash.winner, previousKeyHolder: current.keyHolder });
      const outcome = stoleKey
        ? `${clash.winner!.toUpperCase()} TAKES KEY FROM ${current.keyHolder!.toUpperCase()}`
        : clash.winner
          ? `${clash.winner.toUpperCase()} WINS THE SQUARE`
          : "BOTH YIELD";
      setFeed((previous) => [...previous, `CLASH → BLUE ${blue.move} / YELLOW ${yellow.move} · ${outcome}`]);
      void soundRef.current?.play("clash");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Jev clash unavailable.";
      setMatch((previous) => ({ ...previous, status: "paused", error: message }));
    } finally { decisionPending.current = false; }
  }, []);

  useEffect(() => {
    if (!isDevelopment() || match.status !== "finished") return;
    void completeJevMatch({
      kind: "complete",
      matchId: match.maze.seed,
    }).catch(() => undefined);
  }, [match.maze.seed, match.status]);

  useEffect(() => {
    if (!development || localDevelopment || match.status !== "finished" || !match.winner) return;
    const roundId = match.maze.seed;
    enqueueCrowdLifecycle(() => finishCrowdRound("run", roundId, match.winner!));
  }, [development, enqueueCrowdLifecycle, localDevelopment, match.maze.seed, match.status, match.winner]);
  useEffect(() => {
    if (development && match.status === "clash") {
      void resolveClash();
    }
  }, [development, match.status, resolveClash]);
  useEffect(() => {
    if (!development) {
      return;
    }

    const movement = window.setInterval(() => {
      const now = Date.now();
      const elapsedMs = Math.min(now - (lastStepAt.current ?? now), 1_000);
      lastStepAt.current = now;
      setMatch((previous) => stepMatch(previous, elapsedMs));
    }, 180);
    const decisionTimer = window.setInterval(() => { void getDecisions(); }, 4_000);
    return () => { window.clearInterval(movement); window.clearInterval(decisionTimer); };
  }, [development, getDecisions]);

  const newMatch = (
    mode: GameMode = match.mode,
    seed = createSeed(),
    difficulty: GameDifficulty = match.difficulty,
  ) => {
    const next = createMatch(seed, mode, difficulty);

    decisionPending.current = false;
    turnRef.current = 0;
    lastStepAt.current = null;
    matchRef.current = next;
    setMatch(next);
    setFeed([]);
    setClashMoment(null);
    soundRef.current?.stopMusic();

    if (development && !localDevelopment) {
      enqueueCrowdLifecycle(() => resetCrowdRound("run", seed));
    }
  };

  const startMatch = () => {
    if (matchRef.current.status !== "waiting") return;

    const next = { ...matchRef.current, status: "running" as const, error: null };
    matchRef.current = next;
    lastStepAt.current = Date.now();
    setMatch(next);
    void soundRef.current?.play("start");
    void soundRef.current?.startMusic();

    if (development && !localDevelopment) {
      const roundId = next.maze.seed;
      enqueueCrowdLifecycle(() => lockCrowdRound("run", roundId));
    }

    void getDecisions();
  };

  const matchStatus = match.status === "finished"
    ? `${match.winner!.toUpperCase()} ${match.mode === "signal-hunt" ? "WON SIGNAL HUNT" : "ESCAPED"}`
    : match.status === "clash"
      ? "CLASH · ROCK PAPER SCISSORS"
      : match.error
        ? "DECISION PAUSED"
        : match.status === "waiting"
          ? "READY TO START"
          : match.mode === "signal-hunt"
            ? "SIGNAL HUNT"
            : match.keyHolder
              ? `${match.keyHolder.toUpperCase()} HAS THE KEY`
              : "KEY LOCKED";

  return (
    <main className="run-page game-shell min-h-dvh">
      <header className="masthead">
        <div>
          <p className="eyebrow">
            <Link className="app-home-link" href="/" aria-label={`${GENERAL.appName} home`}>
              {GENERAL.appName}
            </Link>
            {" · LIVE GAME"}
          </p>
          <h1>{GENERAL.games.run.name}</h1>
        </div>
        <div className="masthead-actions">
          <div className="seed">
            <span>MAZE SEED</span>
            <code suppressHydrationWarning>{match.maze.seed}</code>
          </div>
          <button
            className="theme-toggle"
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
            className="theme-toggle"
            aria-label={sceneTheme === "day" ? "Switch to night scene" : "Switch to day scene"}
            title={sceneTheme === "day" ? "Switch to night scene" : "Switch to day scene"}
            onClick={() => saveScenePreferences({
              theme: sceneTheme === "day" ? "night" : "day",
            })}
          >
            {sceneTheme === "day" ? <Moon size={17} /> : <Sun size={17} />}
          </button>
        </div>
      </header>
    <section className="game-grid">
      <div className="arena">
        <canvas ref={canvasRef} aria-label="JevX maze arena" />
        {clashMoment && (
          <div
            className={`rps-stage rps-stage--${clashMoment.winner ?? "draw"}`}
            role="status"
          >
            <span>Rock paper scissors</span>
            <div className="rps-stage__throws">
              <div className="rps-stage__throw rps-stage__throw--blue">
                <b>Blue</b>
                <strong>{rpsSymbol(clashMoment.blueMove)}</strong>
                <em>{clashMoment.blueMove}</em>
              </div>
              <div className="rps-stage__versus">VS</div>
              <div className="rps-stage__throw rps-stage__throw--yellow">
                <b>Yellow</b>
                <strong>{rpsSymbol(clashMoment.yellowMove)}</strong>
                <em>{clashMoment.yellowMove}</em>
              </div>
            </div>
            <strong className="rps-stage__result">
              {clashMoment.winner ? `${clashMoment.winner.toUpperCase()} WINS THE SQUARE` : "TIE"}
              {clashMoment.previousKeyHolder
                && clashMoment.winner
                && clashMoment.previousKeyHolder !== clashMoment.winner
                ? ` · TAKES KEY FROM ${clashMoment.previousKeyHolder.toUpperCase()}`
                : ""}
            </strong>
          </div>
        )}
        {match.status === "finished" && match.winner && !clashMoment && (
          <div className={`victory-stage victory-stage--${match.winner}`} role="status">
            <Sparkles size={19} aria-hidden="true" />
            <Trophy size={38} aria-hidden="true" />
            <span>
              {match.mode === "signal-hunt" ? "Signal hunt complete" : "Gateway reached"}
            </span>
            <strong>{match.winner.toUpperCase()} WINS</strong>
            <em>
              {match.mode === "signal-hunt" ? "Captured all three signals" : "Escaped the maze"}
            </em>
          </div>
        )}
      </div>
      <aside className="panel">
        <div className="run-panel__topline">
          <span>{GENERAL.games.run.name}</span>
          <b>{match.status === "running" ? "LIVE" : match.status === "finished" ? "COMPLETE" : "READY"}</b>
        </div>
        <div className="run-panel__title">
          <h2>{sceneTheme === "day" ? "Daylight run" : "Moonlit run"}</h2>
          <p>First Jev to complete the objective wins.</p>
        </div>
        <div className="clock">
          <span>ELAPSED</span>
          <strong>
            {Math.floor(match.elapsedMs / 60_000).toString().padStart(2, "0")}
            :{Math.floor((match.elapsedMs % 60_000) / 1_000).toString().padStart(2, "0")}
          </strong>
        </div>
        <div className={`match-status match-status--${match.status}`}>
          <span>RUN STATUS · {match.difficulty === "hard" ? "HARD" : "STANDARD"}</span>
          <strong>{matchStatus}</strong>
        </div>
        <div className="agent blue">
          <span>BLUE</span>
          <strong>{decisionLabel(match, "blue")}</strong>
          <em>{exitKnowledgeLabel(match, "blue")}</em>
        </div>
        <div className="agent yellow">
          <span>YELLOW</span>
          <strong>{decisionLabel(match, "yellow")}</strong>
          <em>{exitKnowledgeLabel(match, "yellow")}</em>
        </div>
        {!localDevelopment && <CrowdPick game="run" />}
        {crowdLifecycleError && (
          <div className="error"><strong>Crowd Pick unavailable</strong><p>{crowdLifecycleError}</p></div>
        )}
        {liveMatchError && (
          <div className="error"><strong>Live match unavailable</strong><p>{liveMatchError}</p></div>
        )}
        <div className="feed">
          <div className="feed-heading"><span>DECISION FEED</span><b>LIVE</b></div>
          <div ref={feedScrollRef} className="feed-scroll">
            {feed.length
              ? feed.map((item, index) => <FeedEntry key={`${item}-${index}`} item={item} />)
              : <p className="feed-entry">Connecting to Jev…</p>}
          </div>
        </div>
        {match.error && (
          <div className="error"><strong>Jev decision unavailable</strong><p>{match.error}</p></div>
        )}
        {development && <div className="controls">
          <button onClick={() => newMatch(match.mode)}>New maze</button>
          <button
            className="start"
            disabled={match.status !== "waiting"}
            onClick={startMatch}
          >
            Start {match.mode === "signal-hunt" ? "hunt" : "run"}
          </button>
          <button
            className="secondary difficulty difficulty-control"
            title="Change maze difficulty"
            aria-label={`Difficulty: ${match.difficulty === "hard" ? "Hard" : "Standard"}. Change difficulty.`}
            onClick={() => newMatch(
              match.mode,
              createSeed(),
              match.difficulty === "standard" ? "hard" : "standard",
            )}
          >
            <Gauge size={15} aria-hidden="true" />
            <span>Difficulty</span>
            <b>{match.difficulty === "hard" ? "Hard" : "Standard"}</b>
          </button>
        </div>}
      </aside>
      </section>
      <footer>
        {match.mode === "signal-hunt"
          ? "Each Jev discovers and captures signals from its own map. Deterministic A* executes its legal route."
          : `${match.difficulty === "hard" ? "Hard mode uses a larger maze, tight discovery range, and distant key/gateway routes. " : ""}Gateway Run: each Jev discovers the key and gateway from its own map, then chooses where and how to move. Deterministic A* executes its legal route.`}
      </footer>
      <p className="demo-credit">
        A <a href="https://www.bashbashlabs.com" target="_blank" rel="noreferrer">BashBash Labs</a> presentation
      </p>
    </main>
  );
}
