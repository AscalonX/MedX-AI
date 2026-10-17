import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Shell } from "./_shell";

export const metadata: Metadata = { title: "Clinician review | MedX Bridge" };

export default function ReviewLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
