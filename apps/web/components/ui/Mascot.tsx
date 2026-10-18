"use client";
import { useId, type CSSProperties } from "react";
import { MASCOT_VIEWBOX, mascotGradients, mascotPoses, type MascotLayer, type MascotPose } from "@medx/shared/src/mascot";
import { FinArt } from "./FinArt";
import { cx } from "./cx";

const partClass: Record<string, string> = {
  eyes: "mascot-eyes",
  waveArm: "mascot-wave",
  signal: "mascot-signal",
  ears: "mascot-ears",
  body: "",
};

/** Fin switches from the vector drawing to the owner-approved 3D art at this size (DIRECTION.md 11). */
export const MASCOT_3D_MIN = 96;

/**
 * Fin, the MedX dolphin (DIRECTION.md section 11).
 * At 96px and up Fin is the 3D art (`FinArt`, public/brand); below 96px it is the vector drawing, with the same path
 * data as mobile (`@medx/shared/src/mascot`). `variant` forces one or the other.
 * Decorative by default (aria-hidden). Subtle idle bob (vector also blinks and waves); static under reduced motion.
 * Never render on red-flag / emergency screens or next to alerts.
 */
export function Mascot({
  pose = "wave",
  size = 160,
  label,
  animate = true,
  variant = "auto",
  className,
  style,
}: {
  pose?: MascotPose;
  size?: number;
  /** Give a label only when the mascot carries meaning; otherwise it is hidden from assistive tech. */
  label?: string;
  animate?: boolean;
  /** "auto" (default): 3D at 96px and up, vector below. */
  variant?: "auto" | "vector" | "3d";
  className?: string;
  style?: CSSProperties;
}) {
  const uid = useId().replace(/:/g, "");
  const use3d = variant === "3d" || (variant === "auto" && size >= MASCOT_3D_MIN);
  if (use3d) {
    return <FinArt art={pose} size={size} label={label} className={cx(animate && "mascot-3d-animate", className)} style={style} />;
  }
  const ref = (v?: string) => (v?.startsWith("url(#") ? v.replace("url(#", `url(#${uid}-`) : v);

  // Group consecutive layers with the same animation part.
  const groups: { part?: string; layers: MascotLayer[] }[] = [];
  for (const l of mascotPoses[pose]) {
    const last = groups[groups.length - 1];
    if (last && last.part === l.part) last.layers.push(l);
    else groups.push({ part: l.part, layers: [l] });
  }

  return (
    <svg
      viewBox={MASCOT_VIEWBOX}
      width={size}
      height={size}
      className={cx("mascot", animate && "mascot-animate", className)}
      style={style}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: false })}
    >
      <defs>
        {mascotGradients.map((g) => {
          const stops = g.stops.map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />);
          return g.type === "linear" ? (
            <linearGradient key={g.id} id={`${uid}-${g.id}`} gradientUnits="userSpaceOnUse" {...g.coords}>
              {stops}
            </linearGradient>
          ) : (
            <radialGradient key={g.id} id={`${uid}-${g.id}`} gradientUnits="userSpaceOnUse" {...g.coords}>
              {stops}
            </radialGradient>
          );
        })}
      </defs>
      <g className="mascot-body">
        {groups.map((g, gi) => (
          <g key={gi} className={g.part ? partClass[g.part] : undefined}>
            {g.layers.map((l, i) => (
              <path
                key={i}
                d={l.d}
                fill={ref(l.fill) ?? "none"}
                stroke={l.stroke}
                strokeWidth={l.stroke ? (l.strokeWidth ?? 2) : undefined}
                strokeLinecap={l.stroke ? "round" : undefined}
                strokeLinejoin={l.stroke ? "round" : undefined}
                opacity={l.opacity}
              />
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}
