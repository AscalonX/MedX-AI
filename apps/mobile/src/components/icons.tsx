import Svg, { Circle, Path } from "react-native-svg";

type P = { size?: number; color: string; sw?: number };
const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none" as const });
const stroke = (color: string, sw: number) => ({ stroke: color, strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

// Decorative: screen readers get the label on the parent control.
export const Check = ({ size = 16, color, sw = 3 }: P) => <Svg {...base(size)} accessibilityElementsHidden importantForAccessibility="no"><Path d="M5 12.5l4.5 4.5L19 7.5" {...stroke(color, sw)} /></Svg>;
export const Alert = ({ size = 24, color, sw = 2.8 }: P) => (
  <Svg {...base(size)} accessibilityElementsHidden importantForAccessibility="no"><Path d="M12 6v8" {...stroke(color, sw)} /><Circle cx="12" cy="18.2" r="1.6" fill={color} /></Svg>
);
export const Plus = ({ size = 26, color, sw = 3 }: P) => <Svg {...base(size)} accessibilityElementsHidden importantForAccessibility="no"><Path d="M12 5v14M5 12h14" {...stroke(color, sw)} /></Svg>;
export const Home = ({ size = 24, color, sw = 2 }: P) => <Svg {...base(size)} accessibilityElementsHidden importantForAccessibility="no"><Path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5" {...stroke(color, sw)} /></Svg>;
export const Visit = ({ size = 24, color, sw = 2 }: P) => <Svg {...base(size)} accessibilityElementsHidden importantForAccessibility="no"><Path d="M6 3.5h8l4 4V20.5H6zM9 12h6M9 16h6" {...stroke(color, sw)} /></Svg>;
export const Help = ({ size = 24, color, sw = 2 }: P) => (
  <Svg {...base(size)} accessibilityElementsHidden importantForAccessibility="no"><Circle cx="12" cy="12" r="9" {...stroke(color, sw)} /><Path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.8" {...stroke(color, sw)} /><Circle cx="12" cy="16.8" r="1" fill={color} /></Svg>
);
export const Globe = ({ size = 24, color, sw = 2 }: P) => (
  <Svg {...base(size)} accessibilityElementsHidden importantForAccessibility="no"><Circle cx="12" cy="12" r="9" {...stroke(color, sw)} /><Path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" {...stroke(color, sw)} /></Svg>
);
export const Mic = ({ size = 30, color, sw = 2.2 }: P) => (
  <Svg {...base(size)} accessibilityElementsHidden importantForAccessibility="no"><Path d="M12 3.5a3 3 0 0 0-3 3V12a3 3 0 0 0 6 0V6.5a3 3 0 0 0-3-3zM6 11.5a6 6 0 0 0 12 0M12 17.5V21" {...stroke(color, sw)} /></Svg>
);
export const Stop = ({ size = 26, color }: P) => <Svg {...base(size)} accessibilityElementsHidden importantForAccessibility="no"><Path d="M7 7h10v10H7z" fill={color} stroke={color} strokeWidth={2} strokeLinejoin="round" /></Svg>;
export const Speaker = ({ size = 22, color, sw = 2, off }: P & { off?: boolean }) => (
  <Svg {...base(size)} accessibilityElementsHidden importantForAccessibility="no">
    <Path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" {...stroke(color, sw)} />
    {off ? <Path d="M16 9.5l5 5M21 9.5l-5 5" {...stroke(color, sw)} /> : <Path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" {...stroke(color, sw)} />}
  </Svg>
);
