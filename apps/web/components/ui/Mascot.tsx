"use client";
import { useId, type CSSProperties } from "react";
import { MASCOT_VIEWBOX, mascotGradients, mascotPoses, type MascotLayer, type MascotPose } from "@medx/shared/src/mascot";
import { cx } from "./cx";

const partClass: Record<string, string> = {
  eyes: "mali-eyes",
  waveArm: "mali-wave",
  signal: "mali-signal",
  ears: "mali-ears",
  body: "",
};

/**
 * Mali, the MedX Bridge elephant (DIRECTION.md section 11). Same path data as mobile (`@medx/shared/src/mascot`).
 * Decorative by default (aria-hidden). Subtle idle bob, blink and wave; static under reduced motion.
 * Never render on red-flag / emergency screens or next to alerts.
 */
export function Mascot({
  pose = "wave",
  size = 160,
  label,
  animate = true,
  className,
  style,
}: {
  pose?: MascotPose;
  size?: number;
  /** Give a label only when the mascot carries meaning; otherwise it is hidden from assistive tech. */
  label?: string;
  animate?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const uid = useId().replace(/:/g, "");
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
      className={cx("mali", animate && "mali-animate", className)}
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
      <g className="mali-body">
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
