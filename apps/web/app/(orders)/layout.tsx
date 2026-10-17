import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClinicianFrame } from "../(clinician)/_frame";

export const metadata: Metadata = { title: "Vitals and orders | MedX Bridge" };

export default function OrdersLayout({ children }: { children: ReactNode }) {
  return <ClinicianFrame active="review">{children}</ClinicianFrame>;
}
