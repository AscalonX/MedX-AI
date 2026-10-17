// "Mali", the MedX mascot: a baby elephant (Thailand's national animal; elephants hear well,
// like Mali listens to patients in their own language). A helper, never a clinician.
// Single source of truth for web (apps/web/components/ui/Mascot.tsx) and React Native (react-native-svg).
// Plain data: SVG path strings, colours and gradient stops in a 200x200 viewBox. No platform code.
// Rules: docs/design/DIRECTION.md section 11. Never on red-flag / emergency screens or next to alerts.

export type MascotPose = "wave" | "listening" | "thinking" | "happy" | "pointing";
export const MASCOT_POSES: MascotPose[] = ["wave", "listening", "thinking", "happy", "pointing"];
export const MASCOT_VIEWBOX = "0 0 200 200";

/** Animation hooks. Web maps these to CSS classes; RN may animate the same groups with Reanimated. */
export type MascotPart = "body" | "eyes" | "waveArm" | "ears" | "signal";

export interface MascotGradient {
  id: string;
  type: "linear" | "radial";
  /** linear: x1 y1 x2 y2; radial: cx cy r (+ optional fx fy). userSpaceOnUse, viewBox units. */
  coords: Record<string, number>;
  stops: { offset: number; color: string; opacity?: number }[];
}

export interface MascotLayer {
  d: string;
  /** Hex colour or `url(#id)` of a gradient below. */
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  part?: MascotPart;
}

export const mascotColors = {
  bodyLight: "#2BB3A3",
  teal: "#0A8077",
  ocean: "#1A5FC4",
  deep: "#174A9C",
  belly: "#F2FBFA",
  bellyShade: "#D5ECEE",
  earInner: "#FFD3DC",
  earInnerShade: "#F7B6C4",
  cheek: "#FF7E9F",
  eye: "#10213A",
  white: "#FFFFFF",
  tube: "#22344A",
  metal: "#E7EDF4",
  metalShade: "#9DADC0",
  shadow: "#0F2D50",
} as const;

const c = mascotColors;

export const mascotGradients: MascotGradient[] = [
  {
    id: "mali-body",
    type: "linear",
    coords: { x1: 60, y1: 40, x2: 150, y2: 190 },
    stops: [
      { offset: 0, color: c.bodyLight },
      { offset: 0.45, color: c.teal },
      { offset: 1, color: c.ocean },
    ],
  },
  {
    id: "mali-ear-l",
    type: "linear",
    coords: { x1: 20, y1: 44, x2: 84, y2: 126 },
    stops: [
      { offset: 0, color: c.bodyLight },
      { offset: 1, color: c.ocean },
    ],
  },
  {
    id: "mali-ear-r",
    type: "linear",
    coords: { x1: 180, y1: 44, x2: 116, y2: 126 },
    stops: [
      { offset: 0, color: c.bodyLight },
      { offset: 1, color: c.ocean },
    ],
  },
  {
    id: "mali-trunk",
    type: "linear",
    coords: { x1: 96, y1: 92, x2: 118, y2: 136 },
    stops: [
      { offset: 0, color: c.bodyLight },
      { offset: 1, color: c.teal },
    ],
  },
  {
    id: "mali-sheen",
    type: "radial",
    coords: { cx: 84, cy: 58, r: 46 },
    stops: [
      { offset: 0, color: c.white, opacity: 0.45 },
      { offset: 1, color: c.white, opacity: 0 },
    ],
  },
  {
    id: "mali-belly",
    type: "linear",
    coords: { x1: 100, y1: 122, x2: 100, y2: 176 },
    stops: [
      { offset: 0, color: c.belly },
      { offset: 1, color: c.bellyShade },
    ],
  },
  {
    id: "mali-ear-inner",
    type: "linear",
    coords: { x1: 40, y1: 60, x2: 70, y2: 120 },
    stops: [
      { offset: 0, color: c.earInner },
      { offset: 1, color: c.earInnerShade },
    ],
  },
  {
    id: "mali-metal",
    type: "radial",
    coords: { cx: 124, cy: 130, r: 10 },
    stops: [
      { offset: 0, color: c.white },
      { offset: 0.6, color: c.metal },
      { offset: 1, color: c.metalShade },
    ],
  },
];

// ---------- geometry helpers (run once at module load; output is plain path strings) ----------
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Ellipse as a path, optionally rotated (degrees) about its centre. */
export function ellipsePath(cx: number, cy: number, rx: number, ry: number, rot = 0): string {
  const t = (rot * Math.PI) / 180;
  const dx = rx * Math.cos(t);
  const dy = rx * Math.sin(t);
  const [x1, y1, x2, y2] = [cx - dx, cy - dy, cx + dx, cy + dy].map(r2);
  return `M${x1} ${y1}A${rx} ${ry} ${rot} 1 0 ${x2} ${y2}A${rx} ${ry} ${rot} 1 0 ${x1} ${y1}Z`;
}
const circle = (cx: number, cy: number, r: number) => ellipsePath(cx, cy, r, r);

// ---------- shared parts ----------
const shadow: MascotLayer = { d: ellipsePath(100, 187, 50, 6), fill: c.shadow, opacity: 0.14 };

const legs: MascotLayer[] = [
  { d: ellipsePath(80, 168, 15, 17), fill: "url(#mali-body)" },
  { d: ellipsePath(120, 168, 15, 17), fill: "url(#mali-body)" },
  { d: ellipsePath(80, 181, 10, 4), fill: c.belly, opacity: 0.95 },
  { d: ellipsePath(120, 181, 10, 4), fill: c.belly, opacity: 0.95 },
];

const body: MascotLayer[] = [
  { d: ellipsePath(100, 138, 44, 39), fill: "url(#mali-body)" },
  { d: ellipsePath(100, 147, 27, 25), fill: "url(#mali-belly)" },
];

function ears(raised: boolean): MascotLayer[] {
  const tilt = raised ? 32 : 18;
  const y = raised ? 70 : 80;
  const x = raised ? 46 : 50;
  return [
    { d: ellipsePath(x, y, 33, 37, -tilt), fill: "url(#mali-ear-l)", part: "ears" },
    { d: ellipsePath(200 - x, y, 33, 37, tilt), fill: "url(#mali-ear-r)", part: "ears" },
    { d: ellipsePath(x + 4, y + 3, 21, 26, -tilt), fill: "url(#mali-ear-inner)", part: "ears" },
    { d: ellipsePath(196 - x, y + 3, 21, 26, tilt), fill: "url(#mali-ear-inner)", part: "ears" },
  ];
}

const head: MascotLayer[] = [
  { d: ellipsePath(100, 118, 34, 9), fill: c.deep, opacity: 0.18 },
  { d: ellipsePath(100, 82, 45, 41), fill: "url(#mali-body)" },
  { d: ellipsePath(100, 82, 45, 41), fill: "url(#mali-sheen)" },
  // tuft
  { d: "M97 43C95 35 99 30 104 31C100 34 101 38 103 42Z", fill: c.teal },
];

// Trunk curls down and to the right, holding the stethoscope chest piece.
const trunk: MascotLayer[] = [
  { d: ellipsePath(110, 141, 15, 4.5), fill: c.deep, opacity: 0.12 },
  {
    d: "M87 90C85 112 88 130 102 137C112 142 124 138 128 129C130 123 125 119 120 122C116 124 115 128 109 127C101 125 103 110 113 90C106 84 94 84 87 90Z",
    fill: "url(#mali-trunk)",
  },
  // side outlines only, so the trunk melts into the face at the top
  { d: "M87.5 98C86 114 89 130 102 137C112 142 124 138 128 129C130 123 125 119 120 122C116 124 115 128 109 127C101 125 103 112 111 98", stroke: c.deep, strokeWidth: 1.2, opacity: 0.55 },
  { d: "M91 108Q98 111 106 107", stroke: c.deep, strokeWidth: 1.6, opacity: 0.28 },
  { d: "M92 117Q99 120 105 116", stroke: c.deep, strokeWidth: 1.6, opacity: 0.28 },
  { d: "M96 125Q101 128 106 125", stroke: c.deep, strokeWidth: 1.6, opacity: 0.28 },
  { d: ellipsePath(93, 102, 3, 8, 8), fill: c.white, opacity: 0.22 },
];

const cheeks: MascotLayer[] = [
  { d: ellipsePath(68, 96, 8, 5), fill: c.cheek, opacity: 0.6 },
  { d: ellipsePath(132, 96, 8, 5), fill: c.cheek, opacity: 0.6 },
];

// Stethoscope: tube around the neck, a drop to the chest piece held by the trunk.
const stethoscope: MascotLayer[] = [
  { d: "M68 108C76 126 92 132 102 132", stroke: c.tube, strokeWidth: 4 },
  { d: "M132 108C130 116 126 120 125 123", stroke: c.tube, strokeWidth: 4 },
];
const chestPiece: MascotLayer[] = [
  { d: circle(124, 130, 7.5), fill: "url(#mali-metal)", stroke: c.metalShade, strokeWidth: 1.2 },
  { d: circle(124, 130, 3.4), fill: c.metalShade, opacity: 0.55 },
];

type Look = "front" | "up" | "right";
function eyes(look: Look): MascotLayer[] {
  const ox = look === "right" ? 3 : look === "up" ? -1.5 : 0;
  const oy = look === "up" ? -3 : 0;
  return [
    { d: ellipsePath(78, 80, 8.5, 10.5), fill: c.eye, part: "eyes" },
    { d: ellipsePath(122, 80, 8.5, 10.5), fill: c.eye, part: "eyes" },
    { d: circle(81 + ox, 75.5 + oy, 3.4), fill: c.white, part: "eyes" },
    { d: circle(125 + ox, 75.5 + oy, 3.4), fill: c.white, part: "eyes" },
    { d: circle(76 + ox, 84.5 + oy, 1.5), fill: c.white, part: "eyes", opacity: 0.9 },
    { d: circle(120 + ox, 84.5 + oy, 1.5), fill: c.white, part: "eyes", opacity: 0.9 },
  ];
}
const happyEyes: MascotLayer[] = [
  { d: "M70 82Q78 72 86 82", stroke: c.eye, strokeWidth: 3.6 },
  { d: "M114 82Q122 72 130 82", stroke: c.eye, strokeWidth: 3.6 },
];

const smile: MascotLayer = { d: "M76 100Q80 105 85 102", stroke: c.eye, strokeWidth: 2.2 };
const bigSmile: MascotLayer = { d: "M73 99Q79 111 86 102Z", fill: c.eye };
const flat: MascotLayer = { d: "M76 103Q80 104 84 102", stroke: c.eye, strokeWidth: 2.2 };

// Arms (shoulders at ~ (66,126) and (134,126)).
const armLeftDown: MascotLayer = { d: ellipsePath(62, 142, 11, 17, 22), fill: "url(#mali-body)" };
const armRightDown: MascotLayer = { d: ellipsePath(138, 142, 11, 17, -22), fill: "url(#mali-body)" };
const armRightWave: MascotLayer = { d: ellipsePath(150, 110, 10.5, 18, 32), fill: "url(#mali-body)", part: "waveArm" };
const armLeftUp: MascotLayer = { d: ellipsePath(50, 110, 10.5, 18, -32), fill: "url(#mali-body)" };
const armRightPoint: MascotLayer = { d: ellipsePath(150, 128, 16, 9.5, -10), fill: "url(#mali-body)" };
const palmWave: MascotLayer = { d: ellipsePath(158, 96, 5, 4, 32), fill: c.belly, opacity: 0.5, part: "waveArm" };

// Extras
const soundWaves: MascotLayer[] = [
  { d: "M178 60Q186 72 178 84", stroke: c.ocean, strokeWidth: 3, opacity: 0.9, part: "signal" },
  { d: "M186 52Q198 72 186 92", stroke: c.ocean, strokeWidth: 3, opacity: 0.5, part: "signal" },
  { d: "M22 60Q14 72 22 84", stroke: c.ocean, strokeWidth: 3, opacity: 0.9, part: "signal" },
  { d: "M14 52Q2 72 14 92", stroke: c.ocean, strokeWidth: 3, opacity: 0.5, part: "signal" },
];
const thoughtDots: MascotLayer[] = [
  { d: circle(150, 44, 3.5), fill: c.ocean, opacity: 0.55, part: "signal" },
  { d: circle(162, 32, 5), fill: c.ocean, opacity: 0.75, part: "signal" },
  { d: circle(178, 18, 7), fill: c.ocean, part: "signal" },
];

function assemble(o: { ears?: boolean; arms: MascotLayer[]; front?: MascotLayer[]; face: MascotLayer[]; extra?: MascotLayer[] }): MascotLayer[] {
  return [
    shadow,
    ...ears(!!o.ears),
    ...legs,
    ...body,
    ...o.arms,
    ...stethoscope,
    ...head,
    ...cheeks,
    ...o.face,
    ...trunk,
    ...chestPiece,
    ...(o.front ?? []),
    ...(o.extra ?? []),
  ];
}

export const mascotPoses: Record<MascotPose, MascotLayer[]> = {
  wave: assemble({ arms: [armLeftDown, armRightWave, palmWave], face: [...eyes("front"), smile] }),
  listening: assemble({ ears: true, arms: [armLeftDown, armRightDown], face: [...eyes("front"), smile], extra: soundWaves }),
  thinking: assemble({ arms: [armLeftDown, armRightDown], face: [...eyes("up"), flat], extra: thoughtDots }),
  happy: assemble({ arms: [armLeftUp, { ...armRightWave, part: undefined }], face: [...happyEyes, bigSmile] }),
  pointing: assemble({ arms: [armLeftDown, armRightPoint], face: [...eyes("right"), smile] }),
};

/** Standalone SVG markup for a pose (static files, covers, previews). */
export function mascotSvg(pose: MascotPose, size = 200, idPrefix = "m"): string {
  const ref = (s?: string) => (s && s.startsWith("url(#") ? s.replace("url(#", `url(#${idPrefix}-`) : s);
  const defs = mascotGradients
    .map((g) => {
      const attrs = Object.entries(g.coords).map(([k, v]) => `${k}="${v}"`).join(" ");
      const stops = g.stops
        .map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"${s.opacity !== undefined ? ` stop-opacity="${s.opacity}"` : ""}/>`)
        .join("");
      const tag = g.type === "linear" ? "linearGradient" : "radialGradient";
      return `<${tag} id="${idPrefix}-${g.id}" gradientUnits="userSpaceOnUse" ${attrs}>${stops}</${tag}>`;
    })
    .join("");
  const body = mascotPoses[pose]
    .map((l) => {
      const fill = l.fill ? ref(l.fill) : "none";
      const stroke = l.stroke ? ` stroke="${l.stroke}" stroke-width="${l.strokeWidth ?? 2}" stroke-linecap="round" stroke-linejoin="round"` : "";
      const op = l.opacity !== undefined ? ` opacity="${l.opacity}"` : "";
      return `<path d="${l.d}" fill="${fill}"${stroke}${op}/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MASCOT_VIEWBOX}" width="${size}" height="${size}" role="img" aria-label="Mali, the MedX elephant"><defs>${defs}</defs>${body}</svg>`;
}
