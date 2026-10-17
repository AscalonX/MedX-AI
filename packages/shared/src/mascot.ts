// "Fin", the MedX mascot: a baby dolphin. Dolphins use echolocation (they hear what others miss),
// are known for helping people, live in both the Andaman Sea and the Mediterranean (Thai + Italian),
// and teal-to-ocean is literally sea colour. A helper, never a clinician, never the decider.
// Single source of truth for web (apps/web/components/ui/Mascot.tsx) and React Native (react-native-svg).
// Plain data: SVG path strings, colours and gradient stops in a 200x200 viewBox. No platform code.
// Rules: docs/design/DIRECTION.md section 11. Never on red-flag / emergency / alert / error / clinical-content screens.

export const MASCOT_NAME = "Fin";

export type MascotPose = "wave" | "listening" | "thinking" | "happy" | "pointing";
export const MASCOT_POSES: MascotPose[] = ["wave", "listening", "thinking", "happy", "pointing"];
export const MASCOT_VIEWBOX = "0 0 200 200";

/** Animation hooks. Web maps these to CSS classes; RN may animate the same groups with Reanimated.
 *  `ears` is kept for API compatibility (unused by the dolphin). */
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
  bodyLight: "#2BB8A8",
  teal: "#0A8077",
  ocean: "#1A5FC4",
  deep: "#174A9C",
  belly: "#F4FBFB",
  bellyShade: "#D3EBEE",
  cheek: "#FF8FAB",
  eye: "#10213A",
  white: "#FFFFFF",
  tube: "#22344A",
  metal: "#E7EDF4",
  metalShade: "#9DADC0",
  shadow: "#0F2D50",
  bubble: "#E5EEFB",
} as const;

const c = mascotColors;

export const mascotGradients: MascotGradient[] = [
  {
    id: "fin-body",
    type: "linear",
    coords: { x1: 70, y1: 30, x2: 140, y2: 180 },
    stops: [
      { offset: 0, color: c.bodyLight },
      { offset: 0.42, color: c.teal },
      { offset: 1, color: c.ocean },
    ],
  },
  {
    id: "fin-fin",
    type: "linear",
    coords: { x1: 120, y1: 50, x2: 180, y2: 190 },
    stops: [
      { offset: 0, color: c.teal },
      { offset: 1, color: c.deep },
    ],
  },
  {
    id: "fin-sheen",
    type: "radial",
    coords: { cx: 84, cy: 52, r: 50 },
    stops: [
      { offset: 0, color: c.white, opacity: 0.5 },
      { offset: 1, color: c.white, opacity: 0 },
    ],
  },
  {
    id: "fin-belly",
    type: "linear",
    coords: { x1: 80, y1: 100, x2: 100, y2: 172 },
    stops: [
      { offset: 0, color: c.belly },
      { offset: 1, color: c.bellyShade },
    ],
  },
  {
    id: "fin-metal",
    type: "radial",
    coords: { cx: 70, cy: 146, r: 10 },
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
// Fin floats upright, 3/4 view facing left: snout to the left, dorsal fin on the back (right),
// tail curling to the right at the bottom.
const shadow: MascotLayer = { d: ellipsePath(104, 188, 46, 5.5), fill: c.shadow, opacity: 0.14 };

const dorsal: MascotLayer = { d: "M136 50C146 40 160 36 170 38C162 46 156 58 154 72Z", fill: "url(#fin-fin)" };

const tail: MascotLayer[] = [
  { d: "M100 160C114 172 130 178 146 176L152 184C134 190 112 184 96 170Z", fill: "url(#fin-body)" },
  // flukes
  { d: "M146 172C150 160 162 152 176 152C170 162 164 170 156 178C166 180 178 186 182 196C168 196 156 192 148 184Z", fill: "url(#fin-fin)" },
];

const body: MascotLayer[] = [
  { d: "M102 26C140 26 158 58 156 98C154 134 140 160 118 170C104 176 88 174 78 166C60 152 52 128 52 108C52 96 52 86 56 74C64 46 80 26 102 26Z", fill: "url(#fin-body)" },
  // snout (rostrum)
  { d: ellipsePath(48, 101, 16, 12, -6), fill: "url(#fin-body)" },
  { d: ellipsePath(46, 107, 12, 5, -4), fill: c.belly, opacity: 0.95 },
  // belly from under the snout down the front
  { d: "M34 106C46 112 58 112 66 110C64 128 70 150 86 164C100 172 118 168 128 158C118 170 98 176 82 168C64 158 56 138 58 120C48 120 38 114 34 106Z", fill: "url(#fin-belly)" },
  { d: ellipsePath(88, 138, 26, 30, -8), fill: "url(#fin-belly)" },
  { d: "M102 26C140 26 158 58 156 98C154 134 140 160 118 170C104 176 88 174 78 166C60 152 52 128 52 108C52 96 52 86 56 74C64 46 80 26 102 26Z", fill: "url(#fin-sheen)" },
  // blowhole
  { d: "M100 34Q106 31 112 34", stroke: c.deep, strokeWidth: 2, opacity: 0.45 },
];

const cheeks: MascotLayer[] = [
  { d: ellipsePath(70, 99, 7, 4.5), fill: c.cheek, opacity: 0.7 },
  { d: ellipsePath(126, 95, 7, 4.5), fill: c.cheek, opacity: 0.7 },
];

// Stethoscope: tube around the "neck", a drop to the chest piece the front fin holds.
const stethoscope: MascotLayer[] = [
  { d: "M64 124C80 140 122 140 150 118", stroke: c.tube, strokeWidth: 3.6 },
  { d: "M82 134C76 138 72 140 71 140", stroke: c.tube, strokeWidth: 3.4 },
];
const chestPiece: MascotLayer[] = [
  { d: circle(70, 146, 7.5), fill: "url(#fin-metal)", stroke: c.metalShade, strokeWidth: 1.2 },
  { d: circle(70, 146, 3.4), fill: c.metalShade, opacity: 0.55 },
];

type Look = "front" | "up" | "right";
function eyes(look: Look): MascotLayer[] {
  const ox = look === "right" ? 3 : look === "up" ? -1 : 0;
  const oy = look === "up" ? -3 : 0;
  return [
    { d: ellipsePath(80, 80, 8.5, 10.5), fill: c.eye, part: "eyes" },
    { d: ellipsePath(116, 78, 8.5, 10.5), fill: c.eye, part: "eyes" },
    { d: circle(83 + ox, 75.5 + oy, 3.4), fill: c.white, part: "eyes" },
    { d: circle(119 + ox, 73.5 + oy, 3.4), fill: c.white, part: "eyes" },
    { d: circle(78 + ox, 84.5 + oy, 1.5), fill: c.white, part: "eyes", opacity: 0.9 },
    { d: circle(114 + ox, 82.5 + oy, 1.5), fill: c.white, part: "eyes", opacity: 0.9 },
  ];
}
const happyEyes: MascotLayer[] = [
  { d: "M72 82Q80 72 88 82", stroke: c.eye, strokeWidth: 3.6 },
  { d: "M108 80Q116 70 124 80", stroke: c.eye, strokeWidth: 3.6 },
];

// Mouth runs along the snout line.
const smile: MascotLayer = { d: "M42 107Q58 116 74 106", stroke: c.eye, strokeWidth: 2.4 };
const bigSmile: MascotLayer = { d: "M44 106Q60 124 76 105Q60 113 44 106Z", fill: c.eye };
const flat: MascotLayer = { d: "M46 108Q60 111 72 107", stroke: c.eye, strokeWidth: 2.2 };

// Pectoral fins. Front fin (viewer's left) holds the chest piece; back fin waves / points.
const frontFin: MascotLayer = { d: ellipsePath(62, 154, 8.5, 15, 42), fill: "url(#fin-body)" };
const backFinDown: MascotLayer = { d: ellipsePath(156, 136, 8.5, 17, -28), fill: "url(#fin-fin)" };
const backFinWave: MascotLayer = { d: ellipsePath(164, 100, 9, 20, 32), fill: "url(#fin-fin)", part: "waveArm" };
const backFinPoint: MascotLayer = { d: ellipsePath(170, 120, 20, 8.5, -8), fill: "url(#fin-fin)" };

// Extras: echo arcs from the melon (forehead), bubbles.
const echo: MascotLayer[] = [
  { d: "M48 46Q40 56 46 68", stroke: c.ocean, strokeWidth: 3, opacity: 0.95, part: "signal" },
  { d: "M38 38Q26 54 36 74", stroke: c.ocean, strokeWidth: 3, opacity: 0.65, part: "signal" },
  { d: "M28 30Q12 52 26 80", stroke: c.ocean, strokeWidth: 3, opacity: 0.35, part: "signal" },
];
const bubble = (cx: number, cy: number, r: number, opacity = 1): MascotLayer[] => [
  { d: circle(cx, cy, r), fill: c.bubble, stroke: c.ocean, strokeWidth: 1.6, opacity, part: "signal" },
  { d: circle(cx - r * 0.35, cy - r * 0.35, r * 0.28), fill: c.white, opacity, part: "signal" },
];
const thinkBubbles: MascotLayer[] = [...bubble(150, 40, 4, 0.8), ...bubble(162, 26, 6, 0.9), ...bubble(180, 12, 8)];
const happyBubbles: MascotLayer[] = [...bubble(30, 70, 5, 0.85), ...bubble(22, 52, 3.5, 0.7), ...bubble(176, 70, 5, 0.85), ...bubble(186, 52, 3.5, 0.7)];

function assemble(o: { fins: MascotLayer[]; finsFront?: MascotLayer[]; face: MascotLayer[]; extra?: MascotLayer[] }): MascotLayer[] {
  return [
    shadow,
    dorsal,
    ...tail,
    ...o.fins,
    ...body,
    ...stethoscope,
    ...cheeks,
    ...o.face,
    ...(o.finsFront ?? [frontFin]),
    ...chestPiece,
    ...(o.extra ?? []),
  ];
}

export const mascotPoses: Record<MascotPose, MascotLayer[]> = {
  wave: assemble({ fins: [backFinWave], face: [...eyes("front"), smile] }),
  listening: assemble({ fins: [backFinDown], face: [...eyes("front"), smile], extra: echo }),
  thinking: assemble({ fins: [backFinDown], face: [...eyes("up"), flat], extra: thinkBubbles }),
  happy: assemble({ fins: [{ ...backFinWave, part: undefined }], face: [...happyEyes, bigSmile], extra: happyBubbles }),
  pointing: assemble({ fins: [backFinPoint], face: [...eyes("right"), smile] }),
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MASCOT_VIEWBOX}" width="${size}" height="${size}" role="img" aria-label="${MASCOT_NAME}, the MedX dolphin"><defs>${defs}</defs>${body}</svg>`;
}
