import type { Effect } from "../effects";
export interface Ghost {
  id: string;
  name: string;
  distance: number;
  pace: number;
  boost: number;
}
export interface Obstacle {
  kind: "wall" | "bar";
  name: string;
  arrival: number;
}
export class Game {
  phase: "ready" | "playing" | "paused" | "results" | "rest" = "ready";
  time = 0;
  distance = 0;
  speed = 0;
  jumpUntil = 0;
  stumbleUntil = 0;
  sprintUntil = 0;
  shield = false;
  dodges = 0;
  hits = 0;
  restLeft = 0;
  ghosts: Ghost[] = [];
  obstacles: Obstacle[] = [];
  notices: string[] = [];
  constructor(
    public duration = 180,
    public rest = 60,
  ) {}
  start() {
    if (this.restLeft > 0) return false;
    this.phase = "playing";
    this.time = 0;
    this.distance = 0;
    this.speed = 0;
    this.dodges = 0;
    this.hits = 0;
    this.obstacles = [];
    this.ghosts = [];
    this.shield = false;
    this.jumpUntil = 0;
    this.stumbleUntil = 0;
    this.sprintUntil = 0;
    return true;
  }
  pause() {
    if (this.phase === "playing") this.phase = "paused";
    else if (this.phase === "paused") this.phase = "playing";
  }
  effect(e: Effect) {
    if (e.kind === "wall" || e.kind === "bar")
      this.obstacles.push({
        kind: e.kind,
        name: e.name,
        arrival: this.time + 2,
      });
    if (e.kind === "shield") this.shield = true;
    if (e.kind === "hype") this.sprintUntil = this.time + 20;
    if (e.kind === "join" && !this.ghosts.some((g) => g.id === e.id))
      this.ghosts.push({
        id: e.id,
        name: e.name,
        distance: 0,
        pace: 2.4 + (hash(e.id) % 180) / 100,
        boost: 0,
      });
    if (e.kind === "boost") {
      const g = this.ghosts.find((g) => g.id === e.id);
      if (g) g.boost = this.time + 4;
    }
  }
  tick(dt: number, input: { cadence: number; jump: boolean; squat: boolean }) {
    dt = Math.max(0, Math.min(dt, 0.1));
    if (this.phase === "results" || this.phase === "rest") {
      this.restLeft = Math.max(0, this.restLeft - dt);
      return;
    }
    if (this.phase !== "playing") return;
    this.time += dt;
    if (input.jump && this.time >= this.jumpUntil)
      this.jumpUntil = this.time + 0.85;
    const target =
      input.cadence < 40
        ? 0
        : Math.min(6, input.cadence / 32) *
          (this.time < this.stumbleUntil ? 0.35 : 1);
    this.speed += (target - this.speed) * (1 - Math.exp(-dt * 3));
    this.distance += this.speed * dt * (this.time < this.sprintUntil ? 2 : 1);
    for (const g of this.ghosts)
      g.distance += g.pace * dt * (g.boost > this.time ? 1.6 : 1);
    this.obstacles = this.obstacles.filter((o) => {
      if (o.arrival > this.time) return true;
      const dodge =
        o.kind === "wall" ? this.jumpUntil > this.time : input.squat;
      if (dodge) {
        this.dodges++;
        this.distance += 5;
        this.notices.push(`${o.name} · dodged! +5 m`);
      } else if (this.shield) {
        this.shield = false;
        this.notices.push(`${o.name} · shield saved you`);
      } else {
        this.hits++;
        this.stumbleUntil = this.time + 2;
        this.distance = Math.max(0, this.distance - 3);
        this.notices.push(`${o.name} · stumble! Keep moving at your pace`);
      }
      return false;
    });
    if (this.time >= this.duration) {
      this.time = this.duration;
      this.phase = "results";
      this.restLeft = Math.max(30, this.rest);
    }
  }
  leaderboard(name = "You") {
    return [
      { name, distance: this.distance, id: "streamer" },
      ...this.ghosts,
    ].sort((a, b) => b.distance - a.distance);
  }
}
function hash(s: string) {
  return [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
}
