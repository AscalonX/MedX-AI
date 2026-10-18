import { Landing } from "../../_landing/Landing";
import { landingMetadata } from "../../_landing/meta";

// Thai landing. Strings are marked "native review pending" on the page until a native speaker signs off.
export const dynamic = "force-static";
export const metadata = landingMetadata("th");

export default function ThaiHome() {
  return <Landing lang="th" />;
}
