export const presets = {
  Chill: { cap: 6, duration: 120, rest: 60 },
  Normal: { cap: 10, duration: 180, rest: 60 },
  Spicy: { cap: 15, duration: 180, rest: 90 },
};
export interface Settings {
  preset: keyof typeof presets;
  duration: number;
  rest: number;
  spacing: number;
  restricted: boolean;
  chatOutput: boolean;
  autoChat: boolean;
  autoRate: number;
  demo: boolean;
  reward: string;
  hypeCount: number;
  bitsPerObstacle: number;
  upper: number;
  lower: number;
}
export const defaults: Settings = {
  preset: "Normal",
  duration: 180,
  rest: 60,
  spacing: 2.5,
  restricted: false,
  chatOutput: true,
  autoChat: false,
  autoRate: 7,
  demo: new URLSearchParams(location.search).get("demo") === "1",
  reward: "Drop an obstacle",
  hypeCount: 5,
  bitsPerObstacle: 100,
  upper: -0.35,
  lower: -0.65,
};
export function loadSettings(): Settings {
  try {
    return {
      ...defaults,
      ...JSON.parse(localStorage.getItem("cc.settings") || "{}"),
      demo: defaults.demo,
    };
  } catch {
    return { ...defaults };
  }
}
export const saveSettings = (s: Settings) =>
  localStorage.setItem("cc.settings", JSON.stringify(s));
