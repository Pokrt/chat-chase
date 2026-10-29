import type { Game } from "../game";
export function render(
  canvas: HTMLCanvasElement,
  g: Game,
  squat: boolean,
  t: number,
) {
  const c = canvas.getContext("2d")!;
  const dpr = Math.min(devicePixelRatio, 2),
    w = canvas.clientWidth,
    h = canvas.clientHeight;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  const floor = h * 0.76;
  c.fillStyle = "#17232a";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#1c3038";
  for (let i = 0; i < 14; i++) {
    const x = (i * 130 - g.distance * 7) % (w + 200);
    const height = 25 + ((i * 37) % 80);
    c.fillRect(x, h * 0.25 - height, 80, height);
  }
  c.fillStyle = "#132027";
  c.beginPath();
  c.moveTo(0, floor);
  c.lineTo(w, floor);
  c.lineTo(w, h * 0.25);
  for (let x = w; x >= 0; x -= 40)
    c.lineTo(x, h * 0.36 + Math.sin(x * 0.008) * 24);
  c.closePath();
  c.fill();
  c.fillStyle = "#26363c";
  c.fillRect(0, floor, w, h - floor);
  c.strokeStyle = "#44524e";
  c.lineWidth = 1;
  [0, 25, 57].forEach((y) => {
    c.beginPath();
    c.moveTo(0, floor + y);
    c.lineTo(w, floor + y);
    c.stroke();
  });
  c.strokeStyle = "#687260";
  c.setLineDash([28, 40]);
  c.lineDashOffset = g.distance * 18;
  c.beginPath();
  c.moveTo(0, floor + 37);
  c.lineTo(w, floor + 37);
  c.stroke();
  c.setLineDash([]);
  const x = w * 0.22;
  g.ghosts.slice(-8).forEach((ghost, i) => {
    const gx = Math.max(
      36,
      Math.min(w - 80, x + (ghost.distance - g.distance) * 12),
    );
    runner(
      c,
      gx,
      floor - 7 - (i % 3) * 10,
      42,
      "#829cab",
      g.time * 8 + i,
      false,
      true,
    );
    c.font = "12px sans-serif";
    c.fillStyle = "#bfd1d8";
    c.fillText(ghost.name, gx - 20, floor - 68 - (i % 3) * 10);
  });
  for (const o of g.obstacles) {
    const ox = x + (o.arrival - g.time) * (w * 0.32);
    c.fillStyle = o.kind === "wall" ? "#f58259" : "#d6c86c";
    if (o.kind === "wall") {
      c.fillRect(ox, floor - 43, 34, 43);
      c.fillStyle = "#bd543c";
      for (let j = 0; j < 3; j++)
        c.fillRect(ox + 4, floor - 37 + j * 13, 26, 2);
    } else {
      c.fillRect(ox, floor - 90, 14, 90);
      c.fillRect(ox - 15, floor - 90, 55, 17);
    }
    c.font = "bold 12px sans-serif";
    c.fillStyle = "#f4f0dc";
    c.fillText(o.name, ox - 12, floor - 110);
  }
  const jump =
    g.jumpUntil > g.time
      ? Math.sin(((0.85 - (g.jumpUntil - g.time)) / 0.85) * Math.PI) * 95
      : 0;
  runner(
    c,
    x,
    floor - jump,
    66,
    "#ff8a58",
    g.time * (g.speed + 4),
    squat,
    false,
  );
  if (g.shield) {
    c.strokeStyle = "#a5e2c0";
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(x, floor - jump - 35, 37, 47, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.fillStyle = "#8faaa8";
  c.font = "12px sans-serif";
  for (let i = 0; i < 7; i++)
    c.fillText(
      `${Math.floor(g.distance / 50) * 50 + i * 50} m`,
      (i * 210 - g.distance * 4) % (w + 210),
      h - 12,
    );
  if (g.phase === "ready") {
    c.fillStyle = "#faf4e5";
    c.font = '600 42px "Barlow Condensed",sans-serif';
    c.fillText("YOUR CHAT. YOUR CHASE.", w * 0.41, h * 0.35);
    c.font = "15px sans-serif";
    c.fillStyle = "#bcc8c7";
    c.fillText(
      "Run at your pace. Let chat bring the chaos.",
      w * 0.41,
      h * 0.35 + 28,
    );
  }
  if (g.phase === "paused") {
    c.fillStyle = "#11171bcc";
    c.fillRect(0, 0, w, h);
    c.textAlign = "center";
    c.fillStyle = "#faf4e5";
    c.font = '600 52px "Barlow Condensed"';
    c.fillText("TAKE A BREATHER", w / 2, h * 0.42);
    c.font = "16px sans-serif";
    c.fillText("Race and incoming obstacles are paused.", w / 2, h * 0.42 + 35);
    c.textAlign = "left";
  }
  if (g.phase === "results" || g.phase === "rest") {
    c.fillStyle = "#11171be8";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#f5efdd";
    c.font = '600 44px "Barlow Condensed"';
    c.fillText("THAT’S A RUN.", w * 0.3, h * 0.32);
    c.font = "20px sans-serif";
    c.fillText(
      `${Math.round(g.distance)} m  /  ${g.dodges} dodges  /  ${g.hits} stumbles`,
      w * 0.3,
      h * 0.32 + 40,
    );
    c.font = "16px sans-serif";
    c.fillStyle = "#a5e2c0";
    c.fillText(
      g.restLeft > 0
        ? `Rest break · ${Math.ceil(g.restLeft)} seconds left`
        : "Ready when you are. Start your next run.",
      w * 0.3,
      h * 0.32 + 75,
    );
  }
  void t;
}
function runner(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  phase: number,
  duck: boolean,
  ghost: boolean,
) {
  c.save();
  c.globalAlpha = ghost ? 0.45 : 1;
  const s = size / 66,
    cy = y - (duck ? 27 : 55) * s;
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 7 * s;
  c.lineCap = "round";
  c.beginPath();
  c.arc(x + 5 * s, cy - 10 * s, 8 * s, 0, Math.PI * 2);
  c.fill();
  const hip = { x: x - 4 * s, y: y - (duck ? 16 : 28) * s };
  c.beginPath();
  c.moveTo(x + 2 * s, cy + 2 * s);
  c.lineTo(hip.x, hip.y);
  c.moveTo(x, cy + 9 * s);
  c.lineTo(x - 17 * s, cy + 19 * s);
  c.lineTo(x - 25 * s, cy + 8 * s);
  c.moveTo(x, cy + 9 * s);
  c.lineTo(x + 18 * s, cy + 17 * s);
  c.lineTo(x + 27 * s, cy + 5 * s);
  const a = Math.sin(phase) * 17 * s;
  c.moveTo(hip.x, hip.y);
  c.lineTo(x - 12 * s + a, y - 12 * s);
  c.lineTo(x - 22 * s + a, y);
  c.moveTo(hip.x, hip.y);
  c.lineTo(x + 13 * s - a, y - 13 * s);
  c.lineTo(x + 24 * s - a, y);
  c.stroke();
  c.restore();
}
