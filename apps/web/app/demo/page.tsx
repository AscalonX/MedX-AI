import type { Metadata } from "next";
import { PATIENT_URL, patientQrSvg } from "../_landing/data";
import { DemoHub } from "./DemoHub";

// The persona hub: the six demo roles, the patient QR and the live demo counts (moved from the old home page).
export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Try a role",
  description: "Open the MedX demo as the patient, a nurse, a doctor, either pharmacist or clinic operations. Synthetic data only.",
  alternates: { canonical: "/demo" },
};

export default function DemoPage() {
  const qr = patientQrSvg();
  return <DemoHub qrSvg={qr} patientUrl={PATIENT_URL} />;
}
