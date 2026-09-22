import Link from "next/link";
import { GENERAL } from "@/data/general";

export default function Page() {
  return (
    <main className="jev-home">
      <header className="jev-home__header">
        <p>LIVE JEV GAMES</p>
        <h1>{GENERAL.appName}</h1>
        <span>Choose a game to watch.</span>
      </header>
      <section className="jev-home__games" aria-label="Choose a Jev game">
        <Link className="jev-home__card jev-home__card--hunt" href={GENERAL.games.hunt.route}>
          <span>GAME ONE</span>
          <strong>{GENERAL.games.hunt.name}</strong>
          <p>{GENERAL.games.hunt.description}</p>
          <b>Enter hunt →</b>
        </Link>
        <Link className="jev-home__card jev-home__card--run" href={GENERAL.games.run.route}>
          <span>GAME TWO</span>
          <strong>{GENERAL.games.run.name}</strong>
          <p>{GENERAL.games.run.description}</p>
          <b>Enter run →</b>
        </Link>
      </section>
      <p className="jev-home__credit">A <a href="https://www.bashbashlabs.com">BashBash Labs</a> presentation</p>
    </main>
  );
}
