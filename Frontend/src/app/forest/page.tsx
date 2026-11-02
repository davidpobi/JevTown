import type { Metadata } from "next";
import { JevForestGame } from "@/components/forest/JevForestGame";
import { GENERAL } from "@/data/general";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `${GENERAL.games.forest.name} | ${GENERAL.appName}` };
export default function ForestPage() {
  // A server request creates an independent reproducible local forest.
  // eslint-disable-next-line react-hooks/purity
  const initialSeed = Date.now().toString(36);
  return <JevForestGame initialSeed={initialSeed} />;
}
