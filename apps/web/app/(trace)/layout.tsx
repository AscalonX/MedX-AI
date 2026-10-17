import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClinicianFrame } from "../(clinician)/_frame";

export const metadata: Metadata = { title: "Case trace | MedX" };

export default function TraceLayout({ children }: { children: ReactNode }) {
  return <ClinicianFrame active="review">{children}</ClinicianFrame>;
}
