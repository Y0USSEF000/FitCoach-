import { Platform } from "react-native";

// ─── fitwolf — premium dark theme ──────────────────────────
export const C = {
  // surfaces
  bg: "#0c0818",
  bgSoft: "#130f22",
  card: "#1a1330",
  cardAlt: "#221940",
  cardBright: "#261e47",

  // brand purple
  primary: "#a855f7",
  primaryDark: "#7c3aed",
  primarySoft: "#2d1f52",
  primaryGlow: "rgba(168,85,247,0.30)",
  primaryText: "#ffffff",

  // text
  text: "#ede9ff",
  sub: "#9d8ec4",
  faint: "#5a4e7a",

  // lines
  border: "#2a1f48",
  borderStrong: "#3d2f66",
  borderGlow: "rgba(168,85,247,0.35)",

  // status accents — neon on dark bg
  green: "#22d3a5",
  greenDark: "#0d9e7a",
  greenGlow: "rgba(34,211,165,0.25)",
  orange: "#fb923c",
  orangeGlow: "rgba(251,146,60,0.25)",
  blue: "#38bdf8",
  blueGlow: "rgba(56,189,248,0.25)",
  red: "#f43f5e",
  redDark: "#be123c",
  redGlow: "rgba(244,63,94,0.25)",
  yellow: "#fbbf24",
  yellowGlow: "rgba(251,191,36,0.25)",
  gold: "#ffd700",

  track: "#1e1638",
};

export const macroColors = {
  calories: C.orange,
  protein: C.red,
  carbs: C.blue,
  fat: C.yellow,
};

export const macroGlows = {
  calories: C.orangeGlow,
  protein: C.redGlow,
  carbs: C.blueGlow,
  fat: C.yellowGlow,
};

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 };
export const RADIUS = { sm: 12, md: 16, lg: 22, xl: 32, pill: 999 };
export const FONT = { h1: 34, h2: 26, h3: 19, body: 16, small: 14, tiny: 12 };

export function shadow(level: 1 | 2 | 3 = 1) {
  const map = {
    1: { radius: 10, opacity: 0.35, y: 3, elevation: 4 },
    2: { radius: 20, opacity: 0.45, y: 8, elevation: 10 },
    3: { radius: 32, opacity: 0.55, y: 14, elevation: 18 },
  } as const;
  const s = map[level];
  return Platform.select({
    ios: { shadowColor: "#000", shadowOffset: { width: 0, height: s.y }, shadowOpacity: s.opacity, shadowRadius: s.radius },
    android: { elevation: s.elevation },
    default: {},
  })!;
}

export function glow(color: string, radius = 16) {
  return Platform.select({
    ios: { shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: radius },
    android: { elevation: 8 },
    default: {},
  })!;
}
