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
  const sky = c.createLinearGradient(0, 0, 0, floor);
  sky.addColorStop(0, "#182b34");
  sky.addColorStop(0.65, "#38504d");
  sky.addColorStop(1, "#a27855");
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  // Distant sunset and city move more slowly than the running track.
  const sunX = w * 0.77,
    sunY = h * 0.35;
  c.fillStyle = "#e8a16e";
  c.beginPath();
  c.arc(sunX, sunY, h * 0.18, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#263d40";
  for (let i = 0; i < 32; i++) {
    const bx =
      ((((i * 93 - g.distance * 0.65) % (w + 180)) + (w + 180)) % (w + 180)) -
      90;
    const bh = 20 + ((i * 43) % 70);
    c.fillRect(bx, floor * 0.72 - bh, 45 + (i % 3) * 15, bh + 60);
    c.fillStyle = "#a29470";
    if (i % 3 === 0)
      for (let j = 0; j < 3; j++)
        c.fillRect(bx + 9, floor * 0.72 - bh + 12 + j * 12, 4, 3);
    c.fillStyle = "#263d40";
  }
  c.fillStyle = "#1b3035";
  c.beginPath();
  c.moveTo(0, floor);
  for (let px = 0; px <= w + 40; px += 40)
    c.lineTo(px, floor * 0.76 + Math.sin(px * 0.006 - g.distance * 0.002) * 18);
  c.lineTo(w, floor);
  c.closePath();
  c.fill();
  // Floodlit track rail and lane markings give the race a physical scale.
  c.strokeStyle = "#52615a";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, floor - 13);
  c.lineTo(w, floor - 13);
  c.stroke();
  for (let i = 0; i < Math.ceil(w / 260) + 2; i++) {
    const px =
      ((((i * 260 - g.distance * 5) % (w + 260)) + (w + 260)) % (w + 260)) -
      130;
    c.fillStyle = "#6b7a69";
    c.fillRect(px, floor - 32, 3, 32);
    c.fillStyle = "#e2be88";
    c.fillRect(px - 2, floor - 34, 7, 4);
  }
  const track = c.createLinearGradient(0, floor, 0, h);
  track.addColorStop(0, "#424e48");
  track.addColorStop(1, "#263733");
  c.fillStyle = track;
  c.fillRect(0, floor, w, h - floor);
  c.fillStyle = "#e7b574";
  c.fillRect(0, floor, w, 3);
  c.strokeStyle = "#89927a";
  c.lineWidth = 1;
  [h * 0.08, h * 0.17].forEach((dy) => {
    c.beginPath();
    c.moveTo(0, floor + dy);
    c.lineTo(w, floor + dy);
    c.stroke();
  });
  c.strokeStyle = "#c4b795";
  c.setLineDash([36, 52]);
  c.lineDashOffset = g.distance * 18;
  c.beginPath();
  c.moveTo(0, floor + h * 0.125);
  c.lineTo(w, floor + h * 0.125);
  c.stroke();
  c.setLineDash([]);
  const x = w * 0.22;
  const nameplates: { x: number; y: number; width: number }[] = [];
  g.ghosts.slice(-8).forEach((ghost, i) => {
    const gx = Math.max(
      36,
      Math.min(w - 80, x + (ghost.distance - g.distance) * 12),
    );
    runner(
      c,
      gx,
      floor - 7 - (i % 3) * 10,
      55,
      "#829cab",
      g.time * 8 + i,
      false,
      true,
    );
    c.font = "600 14px sans-serif";
    const width = c.measureText(ghost.name).width + 16;
    const lx = Math.max(8, Math.min(w - width - 8, gx - width / 2));
    for (let row = 0; row < 8; row++) {
      const ly = floor - 110 - row * 24;
      if (ly < 16) break;
      if (
        nameplates.some(
          (p) =>
            Math.abs(p.y - ly) < 22 &&
            lx < p.x + p.width + 8 &&
            lx + width + 8 > p.x,
        )
      )
        continue;
      nameplates.push({ x: lx, y: ly, width });
      c.fillStyle = "#17282eea";
      c.beginPath();
      c.roundRect(lx, ly - 17, width, 23, 4);
      c.fill();
      c.fillStyle = "#d2e0df";
      c.fillText(ghost.name, lx + 8, ly);
      break;
    }
  });
  for (const o of g.obstacles) {
    const ox = x + (o.arrival - g.time) * (w * 0.32);
    c.fillStyle = o.kind === "wall" ? "#f58259" : "#d6c86c";
    if (o.kind === "wall") {
      c.fillRect(ox, floor - 43, 34, 43);
      c.fillStyle = "#8c4d39";
      c.fillRect(ox + 25, floor - 43, 9, 43);
      c.fillStyle = "#ffd0a1";
      c.fillRect(ox - 2, floor - 45, 38, 6);
      c.strokeStyle = "#703d31";
      c.lineWidth = 3;
      for (let j = 0; j < 3; j++) {
        c.beginPath();
        c.moveTo(ox + 3 + j * 11, floor - 30);
        c.lineTo(ox + 11 + j * 11, floor - 18);
        c.stroke();
      }
    } else {
      c.fillRect(ox, floor - 90, 14, 90);
      c.fillRect(ox - 15, floor - 90, 55, 17);
    }
    c.font = "600 16px sans-serif";
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
    90,
    g.time < g.stumbleUntil ? "#f4bd88" : "#ff8a58",
    g.speed < 0.1 ? 0 : g.distance * 2.6,
    squat,
    false,
  );
  if (g.shield) {
    c.strokeStyle = "#a5e2c0";
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(x, floor - jump - 48, 48, 62, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.fillStyle = "#8faaa8";
  c.font = "12px sans-serif";
  const firstMarker = Math.floor((g.distance - (w * 0.22) / 4) / 50) * 50;
  for (let i = 0; i < Math.ceil(w / 200) + 2; i++) {
    const meters = firstMarker + i * 50;
    const markerX = w * 0.22 + (meters - g.distance) * 4;
    if (meters >= 0 && markerX >= 0 && markerX < w - 38)
      c.fillText(`${meters} m`, markerX, h - 12);
  }
  if (g.phase === "ready") {
    c.fillStyle = "#faf4e5";
    c.font = `700 ${Math.max(24, Math.min(60, w * 0.045))}px "Barlow Condensed",sans-serif`;
    c.fillText(
      "YOUR CHAT. YOUR CHASE.",
      w < 600 ? w * 0.07 : w * 0.37,
      h * 0.34,
    );
    c.font = `${w < 600 ? 12 : 15}px sans-serif`;
    c.fillStyle = "#bcc8c7";
    c.fillText(
      "Run at your pace. Let chat bring the chaos.",
      w < 600 ? w * 0.07 : w * 0.37,
      h * 0.34 + 32,
      w * 0.87,
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
  c.translate(x, y);
  c.scale(size / 66, size / 66);
  c.globalAlpha = ghost ? 0.52 : 1;
  // Athletic silhouette: dark shorts, bright jersey, headband and shoes.
  const bob = duck ? 24 : 0,
    stride = Math.sin(phase) * 17;
  c.fillStyle = "#0c1c2066";
  c.beginPath();
  c.ellipse(0, 2, 29, 5, 0, 0, Math.PI * 2);
  c.fill();
  c.lineCap = "round";
  c.lineJoin = "round";
  const limb = (points: number[][], color: string, width: number) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    points.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
    c.stroke();
  };
  limb(
    [
      [-4, -29 + bob],
      [10 - stride, -15],
      [20 - stride, -2],
    ],
    "#d7ad89",
    6,
  );
  limb(
    [
      [-4, -29 + bob],
      [-12 + stride, -15],
      [-22 + stride, -2],
    ],
    color,
    7,
  );
  limb(
    [
      [16 - stride, -1],
      [24 - stride, -1],
    ],
    "#e9e3ca",
    4,
  );
  limb(
    [
      [-25 + stride, -1],
      [-17 + stride, -1],
    ],
    "#e9e3ca",
    4,
  );
  limb(
    [
      [-1, -50 + bob],
      [-17, -38 + bob],
      [-25, -46 + bob],
    ],
    "#bc7254",
    5,
  );
  limb(
    [
      [-1, -50 + bob],
      [-4, -29 + bob],
    ],
    "#14272c",
    15,
  );
  limb(
    [
      [0, -52 + bob],
      [-2, -37 + bob],
    ],
    color,
    14,
  );
  limb(
    [
      [1, -48 + bob],
      [17, -37 + bob],
      [25, -48 + bob],
    ],
    color,
    6,
  );
  c.fillStyle = "#edc39d";
  c.beginPath();
  c.arc(5, -66 + bob, 9, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#1d3034";
  c.beginPath();
  c.arc(4, -69 + bob, 9, Math.PI, Math.PI * 2);
  c.fill();
  c.fillStyle = color;
  c.fillRect(-4, -70 + bob, 18, 4);
  c.fillStyle = "#14272c";
  c.fillRect(9, -65 + bob, 5, 3);
  c.fillStyle = "#ffe6bc";
  c.fillRect(0, -49 + bob, 4, 7);
  c.restore();
}
