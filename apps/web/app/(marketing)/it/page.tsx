import { Landing } from "../../_landing/Landing";
import { landingMetadata } from "../../_landing/meta";

// Italian landing. Strings are marked "native review pending" on the page until a native speaker signs off.
export const dynamic = "force-static";
export const metadata = landingMetadata("it");

export default function ItalianHome() {
  return <Landing lang="it" />;
}
