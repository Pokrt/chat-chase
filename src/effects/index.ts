export type Effect = {
  kind: "wall" | "bar" | "shield" | "join" | "boost" | "hype";
  name: string;
  id: string;
};
export interface SourceEvent {
  type: "chat" | "cheer" | "sub" | "gift" | "redemption";
  name: string;
  id: string;
  text?: string;
  bits?: number;
  privileged?: boolean;
  reward?: string;
}
export interface EffectOptions {
  cap: number;
  spacing: number;
  restricted: boolean;
  reward: string;
  boostReward?: string;
  hypeCount: number;
  bitsPerObstacle: number;
}
export class EffectQueue {
  pending: Effect[] = [];
  history: number[] = [];
  hype: number[] = [];
  cooldowns = new Map<string, number>();
  next = -Infinity;
  lastHype = -Infinity;
  constructor(public options: EffectOptions) {}
  ingest(e: SourceEvent, now: number): { accepted: boolean; message: string } {
    let effects: Effect[] = [];
    const make = (kind: Effect["kind"]) => ({ kind, name: e.name, id: e.id });
    const cooldown = (key: string, ms: number) => {
      const last = this.cooldowns.get(key) ?? -Infinity;
      if (now - last < ms) return false;
      this.cooldowns.set(key, now);
      return true;
    };
    if (e.type === "chat") {
      const cmd = e.text?.trim().split(/\s/)[0].toLowerCase();
      if (cmd === "!join") effects = [make("join")];
      if (cmd === "!go" && cooldown(e.id + ":boost", 10000))
        effects = [make("boost")];
      if (cmd === "!wall" || cmd === "!bar") {
        if (this.options.restricted && !e.privileged)
          return {
            accepted: false,
            message: "Obstacles are limited to subs, VIPs and mods",
          };
        if (!cooldown(e.id + ":obstacle", 60000))
          return {
            accepted: false,
            message: `${e.name}, obstacle cooldown is 60 seconds`,
          };
        effects = [make(cmd === "!wall" ? "wall" : "bar")];
      }
    }
    if (e.type === "cheer")
      effects = Array.from(
        {
          length: Math.min(
            3,
            Math.floor(
              (e.bits ?? 0) / Math.max(1, this.options.bitsPerObstacle),
            ),
          ),
        },
        (_, i) => make(i % 2 ? "bar" : "wall"),
      );
    if (e.type === "sub" || e.type === "gift") effects = [make("shield")];
    if (
      e.type === "redemption" &&
      e.reward?.toLowerCase() === this.options.reward.toLowerCase()
    )
      effects = [make("wall")];
    if (
      e.type === "redemption" &&
      this.options.boostReward &&
      e.reward?.toLowerCase() === this.options.boostReward.toLowerCase()
    ) {
      effects = [make("boost")];
    }
    if (!effects.length) return { accepted: false, message: "" };
    let dropped = false;
    for (const effect of effects) {
      if (this.pending.length >= 8) {
        dropped = true;
        continue;
      }
      this.pending.push(effect);
      if (effect.kind === "wall" || effect.kind === "bar") this.hype.push(now);
    }
    this.hype = this.hype.filter((t) => now - t <= 30000);
    if (
      this.hype.length >= this.options.hypeCount &&
      now - this.lastHype >= 20000 &&
      this.pending.length < 8
    ) {
      this.pending.push(make("hype"));
      this.lastHype = now;
      this.hype = [];
    }
    return {
      accepted: !dropped,
      message: dropped
        ? "Queue full — chill, chat 😄"
        : `${e.name} · ${effects.map((x) => x.kind.toUpperCase()).join(" + ")}`,
    };
  }
  drain(now: number, paused: boolean): Effect[] {
    if (paused) return [];
    this.history = this.history.filter((t) => now - t < 60000);
    const out: Effect[] = [];
    this.pending = this.pending.filter((e) => {
      const obstacle = e.kind === "wall" || e.kind === "bar";
      if (
        obstacle &&
        (now < this.next || this.history.length >= this.options.cap)
      )
        return true;
      out.push(e);
      if (obstacle) {
        this.history.push(now);
        this.next = now + Math.max(2500, this.options.spacing * 1000);
      }
      return false;
    });
    return out;
  }
  reset() {
    this.pending = [];
    this.history = [];
    this.hype = [];
    this.cooldowns.clear();
    this.next = -Infinity;
    this.lastHype = -Infinity;
  }
}
