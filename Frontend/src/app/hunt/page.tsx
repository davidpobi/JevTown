import { JevTownGame } from "@/components/JevTownGame";
import { GENERAL } from "@/data/general";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${GENERAL.games.hunt.name} | ${GENERAL.appName}`,
};

export default function HuntPage() {
  // A server request creates an independent reproducible local development town.
  // eslint-disable-next-line react-hooks/purity
  const initialSeed = Date.now().toString(36);

  return <JevTownGame initialSeed={initialSeed} />;
}
