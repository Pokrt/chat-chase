import { describe, it, expect } from "vitest";
import { Game } from "../src/game";
import { EffectQueue, type SourceEvent } from "../src/effects";
import { Calibration, Detector, metrics, type Point } from "../src/motion";
import { mapNotification } from "../src/twitch";
import running from "./fixtures/running.json";
import jumping from "./fixtures/jumping.json";
import squatting from "./fixtures/squatting.json";
const options = {
  cap: 6,
  spacing: 2.5,
  restricted: false,
  reward: "Drop an obstacle",
  hypeCount: 5,
  bitsPerObstacle: 100,
};
const chat = (text: string, id = "a"): SourceEvent => ({
  type: "chat",
  name: id,
  id,
  text,
});
function tick(
  g: Game,
  seconds: number,
  input = { cadence: 156, jump: false, squat: false },
) {
  for (let i = 0; i < Math.round(seconds * 100); i++) g.tick(0.01, input);
}
describe("effect safety", () => {
  it("caps all obstacle sources in a sliding minute", () => {
    const q = new EffectQueue({ ...options });
    let count = 0;
    for (let t = 0; t < 60000; t += 100) {
      q.ingest({ type: "cheer", name: "fan", id: "fan", bits: 9999 }, t);
      count += q
        .drain(t, false)
        .filter((e) => e.kind === "wall" || e.kind === "bar").length;
    }
    expect(count).toBe(6);
    expect(q.pending.length).toBeLessThanOrEqual(8);
  });
  it("enforces spacing even for different actions", () => {
    const q = new EffectQueue({ ...options });
    q.ingest(chat("!wall", "a"), 0);
    q.ingest(chat("!bar", "b"), 0);
    expect(q.drain(0, false).length).toBe(1);
    expect(q.drain(2499, false)).toHaveLength(0);
    expect(q.drain(2500, false)).toHaveLength(1);
  });
  it("freezes every effect while paused", () => {
    const q = new EffectQueue({ ...options });
    q.ingest({ type: "sub", id: "a", name: "a" }, 0);
    expect(q.drain(0, true)).toHaveLength(0);
    expect(q.pending).toHaveLength(1);
  });
  it("applies viewer cooldown across obstacle commands", () => {
    const q = new EffectQueue({ ...options });
    expect(q.ingest(chat("!wall"), 0).accepted).toBe(true);
    expect(q.ingest(chat("!bar"), 59999).accepted).toBe(false);
    expect(q.ingest(chat("!bar"), 60000).accepted).toBe(true);
  });
  it("boost cooldown is independent of obstacle cooldown", () => {
    const q = new EffectQueue({ ...options });
    q.ingest(chat("!wall"), 0);
    expect(q.ingest(chat("!go"), 0).accepted).toBe(true);
    expect(q.ingest(chat("!go"), 9999).accepted).toBe(false);
    expect(q.ingest(chat("!go"), 10000).accepted).toBe(true);
  });
  it("restricts chat but allows channel point rewards", () => {
    const q = new EffectQueue({ ...options, restricted: true });
    expect(q.ingest(chat("!wall"), 0).accepted).toBe(false);
    expect(q.ingest({ ...chat("!wall"), privileged: true }, 0).accepted).toBe(
      true,
    );
    expect(
      q.ingest(
        { type: "redemption", name: "a", id: "a", reward: "Drop an obstacle" },
        0,
      ).accepted,
    ).toBe(true);
  });
  it("drops overflow visibly and caps cheers at 3", () => {
    const q = new EffectQueue({ ...options, hypeCount: 30 });
    q.ingest({ type: "cheer", name: "a", id: "a", bits: 99999 }, 0);
    expect(q.pending).toHaveLength(3);
    for (let i = 0; i < 5; i++) q.ingest(chat("!join", String(i)), 0);
    expect(q.ingest(chat("!join", "overflow"), 0).message).toContain(
      "Queue full",
    );
    expect(q.pending).toHaveLength(8);
  });
  it("triggers hype only after five obstacle events", () => {
    const q = new EffectQueue({ ...options });
    for (let i = 0; i < 5; i++) q.ingest(chat("!wall", String(i)), i * 100);
    expect(q.pending.filter((e) => e.kind === "hype")).toHaveLength(1);
  });
});
describe("game", () => {
  it("starts idle and moves with cadence", () => {
    const g = new Game();
    g.start();
    tick(g, 1, { cadence: 0, jump: false, squat: false });
    expect(g.distance).toBe(0);
    tick(g, 2);
    expect(g.distance).toBeGreaterThan(5);
  });
  it("freezes timer, distance, obstacles and powerups when paused", () => {
    const g = new Game();
    g.start();
    g.effect({ kind: "wall", id: "a", name: "a" });
    g.pause();
    tick(g, 3);
    expect(g.time).toBe(0);
    expect(g.obstacles).toHaveLength(1);
  });
  it("jump dodges a wall at impact", () => {
    const g = new Game();
    g.start();
    g.effect({ kind: "wall", name: "a", id: "a" });
    tick(g, 1.5);
    g.tick(0.01, { cadence: 156, jump: true, squat: false });
    tick(g, 0.6);
    expect(g.dodges).toBe(1);
    expect(g.hits).toBe(0);
  });
  it("duck dodges a bar; jump does not", () => {
    for (const squat of [true, false]) {
      const g = new Game();
      g.start();
      g.effect({ kind: "bar", name: "a", id: "a" });
      tick(g, 2.1, { cadence: 156, jump: false, squat });
      expect(g.dodges).toBe(squat ? 1 : 0);
      expect(g.hits).toBe(squat ? 0 : 1);
    }
  });
  it("shield ignores exactly one hit", () => {
    const g = new Game();
    g.start();
    g.effect({ kind: "shield", name: "a", id: "a" });
    g.effect({ kind: "shield", name: "b", id: "b" });
    g.effect({ kind: "wall", name: "a", id: "a" });
    tick(g, 2.1);
    expect(g.shield).toBe(false);
    expect(g.hits).toBe(0);
    g.effect({ kind: "wall", name: "a", id: "a" });
    tick(g, 2.1);
    expect(g.hits).toBe(1);
  });
  it("finishes and enforces minimum rest", () => {
    const g = new Game(1, 1);
    g.start();
    tick(g, 1.1);
    expect(g.phase).toBe("results");
    expect(g.restLeft).toBeGreaterThan(29);
    expect(g.start()).toBe(false);
    tick(g, 31);
    expect(g.start()).toBe(true);
  });
  it("joins only once and boosts a viewer ghost", () => {
    const g = new Game();
    g.start();
    g.effect({ kind: "join", id: "a", name: "a" });
    g.effect({ kind: "join", id: "a", name: "a" });
    expect(g.ghosts).toHaveLength(1);
    g.effect({ kind: "boost", id: "a", name: "a" });
    tick(g, 1);
    expect(g.ghosts[0].distance).toBeGreaterThan(g.ghosts[0].pace);
    expect(g.leaderboard()).toHaveLength(2);
  });
  it("sprint doubles distance without increasing required pace", () => {
    const a = new Game(),
      b = new Game();
    a.start();
    b.start();
    b.effect({ kind: "hype", id: "a", name: "a" });
    tick(a, 5);
    tick(b, 5);
    expect(b.speed).toBe(a.speed);
    expect(b.distance).toBeCloseTo(a.distance * 2);
  });
});
describe("motion regression fixtures (synthetic, not webcam recordings)", () => {
  it("requires 3 seconds of visible full body", () => {
    const c = new Calibration();
    const p = running.frames[0].points as Point[];
    expect(c.update({ t: 0, points: p })).toBeNull();
    expect(c.update({ t: 2999, points: p })).toBeNull();
    expect(c.update({ t: 3000, points: p })).not.toBeNull();
  });
  it("resets calibration if feet are missing", () => {
    const c = new Calibration();
    const p = structuredClone(running.frames[0].points);
    c.update({ t: 0, points: p });
    p[27].visibility = 0.1;
    expect(c.update({ t: 3000, points: p })).toBeNull();
    expect(c.start).toBeNull();
  });
  it("counts alternating steps without false jumps", () => {
    const d = new Detector(running.baseline);
    const out = running.frames.map((f) => d.update(f));
    expect(Math.max(...out.map((m) => m.cadence))).toBeGreaterThanOrEqual(120);
    expect(out.flatMap((m) => m.events)).not.toContain("jump");
  });
  it("detects a single jump with refractory period", () => {
    const d = new Detector(jumping.baseline);
    expect(
      jumping.frames
        .flatMap((f) => d.update(f).events)
        .filter((e) => e === "jump"),
    ).toHaveLength(1);
  });
  it("detects squat start and end", () => {
    const d = new Detector(squatting.baseline);
    expect(squatting.frames.flatMap((f) => d.update(f).events)).toEqual([
      "squatStart",
      "squatEnd",
    ]);
  });
  it("reports a lost person after a second", () => {
    const d = new Detector(running.baseline);
    d.update(running.frames[0]);
    expect(d.update({ t: 1100, points: [] }).visible).toBe(false);
  });
  it("normalizes torso scale", () => {
    const p = running.frames[0].points;
    expect(metrics(p).scale).toBeCloseTo(0.2);
  });
});
describe("Twitch event mapping", () => {
  it("maps chat with privileges", () =>
    expect(
      mapNotification("channel.chat.message", {
        chatter_user_id: "1",
        chatter_user_name: "Hi",
        message: { text: "!wall" },
        badges: [{ set_id: "vip" }],
      }),
    ).toMatchObject({ type: "chat", text: "!wall", privileged: true }));
  it("does not double count gifted subscribe notifications", () =>
    expect(mapNotification("channel.subscribe", { is_gift: true })).toBeNull());
  it("maps all other subscribed types", () => {
    for (const [type, expected] of [
      ["channel.cheer", "cheer"],
      ["channel.subscribe", "sub"],
      ["channel.subscription.gift", "gift"],
      ["channel.channel_points_custom_reward_redemption.add", "redemption"],
    ])
      expect(mapNotification(type, {} as any)?.type).toBe(expected);
  });
});

describe("jump ascent timing", () => {
  const lifted = (rise: number, t: number) => {
    const points = structuredClone(jumping.frames[0].points);
    for (const i of [11, 12, 23, 24, 25, 26, 27, 28])
      points[i].y -= rise * jumping.baseline.scale;
    return { t, points };
  };
  it("rejects a slow upward drift taking more than 300 ms", () => {
    const d = new Detector(jumping.baseline);
    const events = [
      lifted(0, 0),
      lifted(0.1, 100),
      lifted(0.18, 300),
      lifted(0.23, 450),
      lifted(0.3, 600),
    ].flatMap((f) => d.update(f).events);
    expect(events).not.toContain("jump");
  });
  it("requires a landing before another jump even after the refractory interval", () => {
    const d = new Detector(jumping.baseline);
    const events = [
      lifted(0, 0),
      lifted(0.3, 100),
      lifted(0.3, 800),
      lifted(0.3, 1000),
    ].flatMap((f) => d.update(f).events);
    expect(events.filter((e) => e === "jump")).toHaveLength(1);
  });
  it("cannot create a jump when a person reappears already airborne", () => {
    const d = new Detector(jumping.baseline);
    d.update(lifted(0, 0));
    d.update({ t: 100, points: [] });
    expect(d.update(lifted(0.3, 1200)).events).not.toContain("jump");
    d.update(lifted(0, 1500));
    expect(d.update(lifted(0.3, 1600)).events).toContain("jump");
  });
});

it("channel-point boost targets the redeeming viewer through the frozen effect queue", () => {
  const q = new EffectQueue({ ...options, boostReward: "Boost my ghost" });
  const g = new Game();
  g.start();
  g.effect({ kind: "join", id: "fan", name: "fan" });
  expect(
    q.ingest(
      { type: "redemption", id: "fan", name: "fan", reward: "Boost my ghost" },
      0,
    ).accepted,
  ).toBe(true);
  expect(q.drain(0, true)).toHaveLength(0);
  for (const e of q.drain(0, false)) g.effect(e);
  tick(g, 1);
  expect(g.ghosts[0].distance).toBeGreaterThan(g.ghosts[0].pace);
  expect(q.history).toHaveLength(0);
});
