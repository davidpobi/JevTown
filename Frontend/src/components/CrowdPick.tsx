"use client";

import { Eye, EyeOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { CrowdSide, CrowdState } from "@/interfaces/crowd";
import {
  getCrowdState,
  pickCrowdSide,
} from "@/services/crowd.service";
import {
  crowdStateEventFor,
  crowdStoragePrefixFor,
  type GameKind,
} from "@/interfaces/game";

const pickKey = (game: GameKind, roundId: string) =>
  `${crowdStoragePrefixFor(game)}:${roundId}`;

const displaySide = (side: CrowdSide) => side === "blue" ? "Blue" : "Yellow";

export function CrowdPick({ game }: { game: GameKind }) {
  const [crowd, setCrowd] = useState<CrowdState | null>(null);
  const [picked, setPicked] = useState<CrowdSide | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  const refresh = useCallback(async () => {
    const state = await getCrowdState(game);

    setError(null);
    setCrowd(state);
    setPicked(
      typeof window === "undefined"
        ? null
        : localStorage.getItem(pickKey(game, state.roundId)) as CrowdSide | null,
    );
  }, [game]);

  useEffect(() => {
    const load = () => {
      void refresh().catch((reason: Error) => setError(reason.message));
    };

    const initial = window.setTimeout(load, 0);
    const timer = window.setInterval(load, 15_000);
    window.addEventListener(crowdStateEventFor(game), load);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener(crowdStateEventFor(game), load);
    };
  }, [game, refresh]);

  const choose = async (side: CrowdSide) => {
    if (!crowd || crowd.phase !== "open" || picked) return;

    setError(null);

    try {
      const state = await pickCrowdSide(game, side, crowd.roundId);
      localStorage.setItem(pickKey(game, state.roundId), side);
      setPicked(side);
      setCrowd(state);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pick unavailable.");
    }
  };

  const summary = crowd?.phase === "finished" && crowd.winner
    ? `${crowd.winner === "blue" ? crowd.bluePercent : crowd.yellowPercent}% backed ${displaySide(crowd.winner)}. ${displaySide(crowd.winner)} won.`
    : picked
      ? `You backed ${displaySide(picked)}.`
      : crowd?.phase === "locked"
        ? "Crowd calls locked."
        : "Picks open.";

  if (hidden) {
    return (
      <button
        className="crowd-pick-toggle"
        aria-label="Show placement preview"
        title="Show placement preview"
        onClick={() => setHidden(false)}
      >
        <Eye size={12} aria-hidden="true" />
      </button>
    );
  }

  return (
    <section className="crowd-pick" aria-label="Crowd pick">
      <div className="crowd-pick__heading">
        <span>MAKE YOUR CALL</span>
        <b>{crowd?.phase === "open" ? "OPEN" : crowd?.phase === "finished" ? "FINAL" : "LOCKED"}</b>
        <button
          className="crowd-pick__hide"
          aria-label="Hide placement preview"
          title="Hide placement preview"
          onClick={() => setHidden(true)}
        >
          <EyeOff size={13} aria-hidden="true" />
        </button>
      </div>

      <div className="crowd-pick__score">
        <strong className="blue">Blue</strong>
        <span>{crowd ? `${crowd.blue.toLocaleString()} · ${crowd.bluePercent}%` : "—"}</span>
      </div>
      <div className="crowd-pick__score">
        <strong className="yellow">Yellow</strong>
        <span>{crowd ? `${crowd.yellow.toLocaleString()} · ${crowd.yellowPercent}%` : "—"}</span>
      </div>

      <div className="crowd-pick__actions">
        <button
          disabled={!crowd || crowd.phase !== "open" || Boolean(picked)}
          onClick={() => void choose("blue")}
        >
          Back Blue
        </button>
        <button
          disabled={!crowd || crowd.phase !== "open" || Boolean(picked)}
          onClick={() => void choose("yellow")}
        >
          Back Yellow
        </button>
      </div>

      <small>{error ?? summary}</small>
    </section>
  );
}
