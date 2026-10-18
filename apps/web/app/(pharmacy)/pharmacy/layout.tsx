import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Shell } from "../_shell";

export const metadata: Metadata = { title: "Pharmacy | MedX" };

export default function PharmacyLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
