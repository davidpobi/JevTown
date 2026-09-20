import { JevTownGame } from "@/components/JevTownGame";

export const dynamic = "force-dynamic";

export default function Page() {
  // This is a server component. A new request deliberately starts a new,
  // reproducible town; the resulting seed is then hydrated as a plain prop.
  // eslint-disable-next-line react-hooks/purity
  const initialSeed = Date.now().toString(36);

  return <JevTownGame initialSeed={initialSeed} />;
}
