import type { SourceEvent } from "../effects";
const names = [
  "pixelpanda",
  "moss.jpeg",
  "speedybeans",
  "lunarloop",
  "tangerine",
  "cozychaos",
  "ghostmode",
  "hey_nova",
];
export function demoEvent(kind: string, index = 0): SourceEvent {
  const name = names[index % names.length],
    base = { name, id: name };
  if (kind === "cheer100" || kind === "cheer300")
    return { ...base, type: "cheer", bits: kind === "cheer100" ? 100 : 300 };
  if (kind === "sub" || kind === "gift") return { ...base, type: kind };
  if (kind === "redemption")
    return { ...base, type: "redemption", reward: "Drop an obstacle" };
  return { ...base, type: "chat", text: "!" + kind };
}
