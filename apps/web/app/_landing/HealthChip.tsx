"use client";
import { useEffect, useState } from "react";
import { Chip, Icon } from "../../components/ui";
import { fill } from "./site";

export interface HealthChipLabels {
  modelLabel: string;
  modelLoading: string;
  modelMock: string;
  modelLive: string;
  modelNotConfigured: string;
  modelUnknown: string;
}

interface Health {
  provider?: string;
  model?: string;
  hardware?: string;
  providerConfigured?: boolean;
}

/** The label to show for a /api/health body. Model and hardware claims come only from the server, never from copy. */
export function modelLabel(h: Health | null, t: HealthChipLabels): string {
  if (!h || typeof h.provider !== "string") return t.modelUnknown;
  if (h.provider === "mock") return t.modelMock;
  if (h.providerConfigured === false) return t.modelNotConfigured;
  if (!h.model) return t.modelUnknown;
  const hardware = h.hardware && h.hardware !== "—" ? h.hardware : h.provider;
  return fill(t.modelLive, { model: h.model, hardware });
}

/** Reads /api/health once (no polling) and shows the honest model label (DIRECTION.md 12.1). */
export function HealthChip({ labels }: { labels: HealthChipLabels }) {
  const [text, setText] = useState(labels.modelLoading);
  useEffect(() => {
    let live = true;
    fetch("/api/health", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Health>) : Promise.reject(new Error(String(r.status)))))
      .then((h) => live && setText(modelLabel(h, labels)))
      .catch(() => live && setText(labels.modelUnknown));
    return () => {
      live = false;
    };
  }, [labels]);
  return (
    <p aria-live="polite" className="m-0">
      <Chip tone="ocean" icon={<Icon name="cpu" size={16} />}>
        <span>
          <span className="font-bold">{labels.modelLabel}:</span> {text}
        </span>
      </Chip>
    </p>
  );
}
