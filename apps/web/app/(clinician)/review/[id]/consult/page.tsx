"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import type { ConsultMode } from "@medx/shared";
import { useClinician } from "../../_shell";
import { Consult } from "./_consult";

export default function ConsultPage() {
  const { id } = useParams<{ id: string }>();
  const q = useSearchParams();
  const router = useRouter();
  const { clinicianRole, setClinicianRole } = useClinician();
  const mode: ConsultMode = q.get("mode") === "doctor" ? "doctor" : "nurse";
  // The URL picks the mode on arrival; afterwards the AppShell role switch picks it.
  const arrived = useRef(false);
  useEffect(() => {
    if (!arrived.current) { arrived.current = true; if (clinicianRole !== mode) setClinicianRole(mode); return; }
    if (clinicianRole !== mode) router.replace(`/review/${id}/consult?mode=${clinicianRole}`);
  }, [clinicianRole, mode, id, router, setClinicianRole]);
  return <Consult id={id} mode={mode} />;
}
