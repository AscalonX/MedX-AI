// "Mali", the MedX Bridge mascot: a baby elephant (Thailand's national animal; elephants hear well,
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
  cheek: "#FF8FA8",
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
    id: "mali-ear",
    type: "linear",
    coords: { x1: 20, y1: 40, x2: 90, y2: 130 },
    stops: [
      { offset: 0, color: c.bodyLight },
      { offset: 1, color: c.deep },
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
    { d: ellipsePath(x, y, 33, 37, -tilt), fill: "url(#mali-ear)", part: "ears" },
    { d: ellipsePath(200 - x, y, 33, 37, tilt), fill: "url(#mali-ear)", part: "ears" },
    { d: ellipsePath(x + 4, y + 3, 21, 26, -tilt), fill: "url(#mali-ear-inner)", part: "ears" },
    { d: ellipsePath(196 - x, y + 3, 21, 26, tilt), fill: "url(#mali-ear-inner)", part: "ears" },
  ];
}

const head: MascotLayer[] = [
  { d: ellipsePath(100, 82, 45, 41), fill: "url(#mali-body)" },
  { d: ellipsePath(100, 82, 45, 41), fill: "url(#mali-sheen)" },
  // tuft
  { d: "M97 43C95 35 99 30 104 31C100 34 101 38 103 42Z", fill: c.teal },
];

// Trunk curls down and to the right, holding the stethoscope chest piece.
const trunk: MascotLayer[] = [
  {
    d: "M89 96C87 112 90 128 103 134C112 138 122 135 126 128C128 123 124 119 119 121C116 123 115 126 110 126C102 125 104 112 110 97Z",
    fill: "url(#mali-body)",
  },
  { d: "M93 112Q99 114 106 111", stroke: c.deep, strokeWidth: 1.6, opacity: 0.35 },
  { d: "M95 120Q101 122 107 119", stroke: c.deep, strokeWidth: 1.6, opacity: 0.35 },
];

const cheeks: MascotLayer[] = [
  { d: ellipsePath(70, 96, 8, 5), fill: c.cheek, opacity: 0.45 },
  { d: ellipsePath(130, 96, 8, 5), fill: c.cheek, opacity: 0.45 },
];

// Stethoscope: tube around the neck, a drop to the chest piece held by the trunk.
const stethoscope: MascotLayer[] = [
  { d: "M70 110C78 126 92 130 100 130", stroke: c.tube, strokeWidth: 3.6, opacity: 1 },
  { d: "M130 110C126 118 122 122 122 124", stroke: c.tube, strokeWidth: 3.6 },
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
    { d: ellipsePath(81, 80, 7.5, 9.5), fill: c.eye, part: "eyes" },
    { d: ellipsePath(119, 80, 7.5, 9.5), fill: c.eye, part: "eyes" },
    { d: circle(83.5 + ox, 76 + oy, 3), fill: c.white, part: "eyes" },
    { d: circle(121.5 + ox, 76 + oy, 3), fill: c.white, part: "eyes" },
    { d: circle(79 + ox, 84 + oy, 1.3), fill: c.white, part: "eyes", opacity: 0.9 },
    { d: circle(117 + ox, 84 + oy, 1.3), fill: c.white, part: "eyes", opacity: 0.9 },
  ];
}
const happyEyes: MascotLayer[] = [
  { d: "M73 82Q81 72 89 82", stroke: c.eye, strokeWidth: 3.4 },
  { d: "M111 82Q119 72 127 82", stroke: c.eye, strokeWidth: 3.4 },
];

const smile: MascotLayer = { d: "M78 101Q83 106 88 103", stroke: c.eye, strokeWidth: 2.4 };
const bigSmile: MascotLayer = { d: "M76 99Q83 110 90 102Z", fill: c.eye };
const flat: MascotLayer = { d: "M79 103Q83 104 87 102", stroke: c.eye, strokeWidth: 2.2 };

// Arms (shoulders at ~ (66,126) and (134,126)).
const armLeftDown: MascotLayer = { d: ellipsePath(62, 142, 11, 17, 22), fill: "url(#mali-body)" };
const armRightDown: MascotLayer = { d: ellipsePath(138, 142, 11, 17, -22), fill: "url(#mali-body)" };
const armRightWave: MascotLayer = { d: ellipsePath(150, 110, 10.5, 18, 32), fill: "url(#mali-body)", part: "waveArm" };
const armLeftUp: MascotLayer = { d: ellipsePath(50, 110, 10.5, 18, -32), fill: "url(#mali-body)" };
const armRightPoint: MascotLayer = { d: ellipsePath(156, 130, 18, 10, -8), fill: "url(#mali-body)" };
const palmWave: MascotLayer = { d: ellipsePath(158, 96, 6, 5, 32), fill: c.belly, opacity: 0.9, part: "waveArm" };

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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MASCOT_VIEWBOX}" width="${size}" height="${size}" role="img" aria-label="Mali, the MedX Bridge elephant"><defs>${defs}</defs>${body}</svg>`;
}
