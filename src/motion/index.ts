export interface Point {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}
export interface Frame {
  t: number;
  points: Point[];
}
export interface Baseline {
  hip: number;
  leftAnkle: number;
  rightAnkle: number;
  scale: number;
  kneeAngle: number;
}
export type MotionEvent = "jump" | "squatStart" | "squatEnd";
export interface Motion {
  cadence: number;
  status: string;
  squat: boolean;
  events: MotionEvent[];
  visible: boolean;
  lifts: number[];
  angle: number;
}
const ids = [11, 12, 23, 24, 25, 26, 27, 28];
export const visible = (p: Point[]) =>
  ids.every((i) => p[i] && (p[i].visibility ?? 1) >= 0.5);
const mid = (p: Point[], a: number, b: number) => ({
  x: (p[a].x + p[b].x) / 2,
  y: (p[a].y + p[b].y) / 2,
});
export function angle(a: Point, b: Point, c: Point) {
  const u = { x: a.x - b.x, y: a.y - b.y },
    v = { x: c.x - b.x, y: c.y - b.y };
  return (
    (Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          (u.x * v.x + u.y * v.y) /
            (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y) || 1),
        ),
      ),
    ) *
      180) /
    Math.PI
  );
}
export function metrics(p: Point[]) {
  const h = mid(p, 23, 24),
    s = mid(p, 11, 12);
  return {
    hip: h.y,
    leftAnkle: p[27].y,
    rightAnkle: p[28].y,
    scale: Math.max(0.01, Math.hypot(h.x - s.x, h.y - s.y)),
    kneeAngle: (angle(p[23], p[25], p[27]) + angle(p[24], p[26], p[28])) / 2,
  };
}
export class Calibration {
  frames: Baseline[] = [];
  start: number | null = null;
  update(f: Frame): Baseline | null {
    if (!visible(f.points)) {
      this.frames = [];
      this.start = null;
      return null;
    }
    const current = metrics(f.points);
    const first = this.frames[0];
    if (
      first &&
      (Math.abs(current.hip - first.hip) > first.scale * 0.18 ||
        Math.abs(current.scale - first.scale) > first.scale * 0.2)
    ) {
      this.frames = [];
      this.start = null;
    }
    this.start ??= f.t;
    this.frames.push(current);
    if (f.t - this.start < 3000) return null;
    const mean = (k: keyof Baseline) =>
      this.frames.reduce((s, v) => s + v[k], 0) / this.frames.length;
    return {
      hip: mean("hip"),
      leftAnkle: mean("leftAnkle"),
      rightAnkle: mean("rightAnkle"),
      scale: mean("scale"),
      kneeAngle: mean("kneeAngle"),
    };
  }
}
export class Detector {
  steps: number[] = [];
  smooth = [-1, -1];
  armed = [true, true];
  lastLeg = -1;
  lastStep = -Infinity;
  lastJump = -Infinity;
  lastVisible = -Infinity;
  squat = false;
  riseStart: number | null = null;
  constructor(
    public baseline: Baseline,
    public thresholds = {
      upper: -0.35,
      lower: -0.65,
      idle: 40,
      run: 120,
      sprint: 170,
    },
  ) {}
  update(f: Frame): Motion {
    const events: MotionEvent[] = [];
    const ok = visible(f.points);
    if (!ok) {
      this.steps = this.steps.filter((t) => f.t - t < 3000);
      return {
        cadence: 0,
        status: "IDLE",
        squat: false,
        events,
        visible: f.t - this.lastVisible <= 1000,
        lifts: this.smooth,
        angle: 0,
      };
    }
    this.lastVisible = f.t;
    const m = metrics(f.points),
      b = this.baseline;
    [25, 26].forEach((k, i) => {
      const lift = (f.points[k - 2].y - f.points[k].y) / b.scale;
      this.smooth[i] += 0.45 * (lift - this.smooth[i]);
      if (this.smooth[i] < this.thresholds.lower) this.armed[i] = true;
      if (
        this.armed[i] &&
        this.smooth[i] > this.thresholds.upper &&
        (this.lastLeg !== i || f.t - this.lastStep >= 150)
      ) {
        this.steps.push(f.t);
        this.lastLeg = i;
        this.lastStep = f.t;
        this.armed[i] = false;
      }
    });
    this.steps = this.steps.filter((t) => f.t - t <= 3000);
    const cadence = this.steps.length * 20;
    const raised =
      (b.leftAnkle - m.leftAnkle) / b.scale > 0.25 &&
      (b.rightAnkle - m.rightAnkle) / b.scale > 0.25;
    if (!raised) this.riseStart = f.t;
    if (
      raised &&
      this.riseStart !== null &&
      f.t - this.riseStart <= 300 &&
      m.kneeAngle >= 120 &&
      f.t - this.lastJump >= 600
    ) {
      events.push("jump");
      this.lastJump = f.t;
      this.riseStart = null;
    }
    const squat = (m.hip - b.hip) / b.scale > 0.35 && m.kneeAngle < 120;
    if (squat !== this.squat) events.push(squat ? "squatStart" : "squatEnd");
    this.squat = squat;
    return {
      cadence,
      status:
        cadence < this.thresholds.idle
          ? "IDLE"
          : cadence < this.thresholds.run
            ? "JOGGING"
            : cadence <= this.thresholds.sprint
              ? "RUNNING"
              : "SPRINTING",
      squat,
      events,
      visible: true,
      lifts: [...this.smooth],
      angle: m.kneeAngle,
    };
  }
}
