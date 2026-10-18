import { Landing } from "./_landing/Landing";
import { landingMetadata } from "./_landing/meta";

// The marketing landing (owner decision 4). English by default; Thai at /th and Italian at /it.
// Rendered at build time: the page reads public/ (video, stills) and the rule files, never request data.
// The staff home that used to live here moved to /home.
export const dynamic = "force-static";
export const metadata = landingMetadata("en");

export default function Home() {
  return <Landing lang="en" />;
}
