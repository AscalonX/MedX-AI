import type { Metadata } from "next";
import { OpsDashboard } from "../components/OpsDashboard";

export const metadata: Metadata = {
  title: "Clinic operations | MedX",
  description: "Synthetic intake queue and system ledger for clinician review.",
};

export default function OpsPage() {
  return <OpsDashboard />;
}
