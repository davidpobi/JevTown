import { JevXGame } from "@/components/run/JevXGame";
import { GENERAL } from "@/data/general";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `${GENERAL.games.run.name} | ${GENERAL.appName}`,
};

export default function RunPage() {
  return <JevXGame />;
}
