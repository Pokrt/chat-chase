import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./style.css";
import { Game } from "./game";
import { EffectQueue, type SourceEvent } from "./effects";
import {
  Calibration,
  Detector,
  visible,
  type Frame,
  type Motion,
} from "./motion";
import { Camera } from "./pose";
import { render } from "./render";
import { loadSettings, saveSettings, presets } from "./config";
import { demoEvent } from "./demo";
import { authenticate, login, Twitch } from "./twitch";
const settings = loadSettings();
let game = new Game(settings.duration, settings.rest);
const queue = new EffectQueue({
  cap: presets[settings.preset].cap,
  spacing: settings.spacing,
  restricted: settings.restricted,
  reward: settings.reward,
  boostReward: settings.boostReward,
  hypeCount: settings.hypeCount,
  bitsPerObstacle: settings.bitsPerObstacle,
});
let twitch: Twitch | null = null;
let mode: "keyboard" | "camera" = "keyboard";
let detector: Detector | null = null;
let calibration = new Calibration();
let calibrating = false;
let motion: Motion = {
  cadence: 0,
  status: "IDLE",
  events: [],
  squat: false,
  visible: false,
  lifts: [],
  angle: 0,
};
let jump = false;
let lostAt = performance.now();
let demoIndex = 0;
let autoAt = 0;
let previous = performance.now();
let uiAt = 0;
let clock = 0;
let debug = false;
let replaying = false;
let replayFrames: Frame[] = [];
let replayIndex = 0;
let replayStart = 0;
let name = "You";
let logs: string[] = [];
let graph: number[] = [];
const keys = new Set<string>();
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const icon = (path: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${path}</svg>`;
const pauseIcon = icon('<path d="M8 5v14M16 5v14"/>');
document.querySelector("#app")!.innerHTML = `
<header><a class="wordmark" href="/" aria-label="Chat Chase home">CHAT<span>CHASE</span><i>${icon('<path d="M4 12h16m-6-6 6 6-6 6"/>')}</i></a><span class="tagline">Chat throws it. You dodge it.</span><div class="header-actions"><span class="connection" id="connection">LOCAL / OFFLINE</span><button id="connect">Connect Twitch ${icon('<path d="m9 5 7 7-7 7"/>')}</button><button id="controls" class="square" aria-label="Open controls" title="Controls (backtick)">${icon('<path d="M4 7h16M4 17h16M8 4v6M16 14v6"/>')}</button></div></header>
<main><div class="race-heading"><div><span class="live-dot"></span><h1>THE CHAT CHASE</h1><span class="mode-label" id="modeLabel">KEYBOARD MODE</span></div><div class="session">MOVE AT YOUR PACE. <strong>CHAT CAN WAIT.</strong></div></div>
<section class="top-grid"><div class="camera-panel"><div class="panel-label"><span>YOUR CORNER</span><span id="cameraState">CAMERA OFF</span></div><video id="video" muted playsinline></video><canvas id="skeleton"></canvas><div id="cameraEmpty" class="camera-empty"><div class="viewfinder">${icon('<path d="M3 8V3h5m8 0h5v5m0 8v5h-5M8 21H3v-5"/><circle cx="12" cy="9" r="3"/><path d="M6 19c0-6 12-6 12 0"/>')}</div><h2>Make your move.</h2><p>Your body is the controller.<br>Step back, give yourself some room.</p><button class="primary" id="camera">Enable webcam ${icon('<path d="M5 12h14m-5-5 5 5-5 5"/>')}</button><small>Or try it with your keyboard ↓</small></div><div class="camera-bottom"><span id="motionStatus">READY WHEN YOU ARE</span><button id="recalibrate" class="text-button" hidden>Recalibrate</button></div></div>
<div class="race-info"><div class="telemetry"><div><span class="label">DISTANCE</span><div class="distance"><span id="distance">0</span><small>m</small></div></div><div class="time"><span class="label">TIME LEFT</span><strong id="timer">03:00</strong><div class="time-track"><i id="timebar"></i></div></div></div><div class="pace"><div><span class="label">YOUR PACE</span><strong id="cadence">0 <small>SPM</small></strong></div><div class="pace-bars">${Array.from({ length: 24 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div><span id="paceState">IDLE</span></div><div class="leaderboard"><div class="panel-label"><span>THE PACK</span><span id="racerCount">1 RUNNER</span></div><div id="leaders"></div><p class="join-note">Chat, type <b>!join</b> to get in the race.</p></div></div></section>
<section class="game-panel"><div class="game-toolbar"><div><span class="track-label">NIGHT SHIFT / OPEN TRACK</span><span class="badge" id="shield">NO SHIELD</span><span class="badge" id="sprint" hidden>2× SPRINT ZONE</span></div><span id="warning">A little movement. A lot of chat.</span></div><canvas id="game" aria-label="Side-scrolling race track"></canvas><div class="game-bottom"><div class="keyboard-help"><kbd>→</kbd> RUN <kbd>↑</kbd> JUMP <kbd>↓</kbd> DUCK <span>SPACE TO PAUSE</span></div><div class="game-actions"><button id="pause">${pauseIcon} Pause</button><button class="primary" id="start">Start a run ${icon('<path d="m9 5 7 7-7 7"/>')}</button></div></div></section>
<div class="ticker"><span>CHAT FEED</span><p id="ticker" role="status">The track is yours. Start a run, then invite a little chaos.</p><span id="queueCount">0 QUEUED</span></div>
<section class="demo-deck"><div><h2>Be the chat.</h2><p>Try the chaos. Same rules, no audience needed.</p></div><div class="demo-buttons">${[
  ["join", "Join race"],
  ["wall", "Drop wall"],
  ["bar", "Drop bar"],
  ["cheer100", "100 bits"],
  ["cheer300", "300 bits"],
  ["sub", "Send shield"],
  ["gift", "Gift sub"],
  ["redemption", "Redeem"],
  ["go", "Boost ghost"],
  ["hype", "Hype burst"],
]
  .map(([k, v]) => `<button data-demo="${k}">${v}</button>`)
  .join(
    "",
  )}</div><label class="switch-label"><input type="checkbox" id="demoToggle"> Demo mode</label></section>
<footer><span>BUILT FOR THE CHASE. MADE WITH CODEX.</span><span>Space to pause · D to debug · &#96; for controls</span></footer></main>
<aside id="panel" hidden aria-label="Streamer controls"><div class="panel-top"><h2>Streamer controls</h2><button id="closePanel" aria-label="Close controls">Close ×</button></div><p>Stay comfortable. Chat changes the game; you choose your pace.</p><label>Intensity<select id="preset">${Object.keys(
  presets,
)
  .map((p) => `<option>${p}</option>`)
  .join(
    "",
  )}</select></label><p id="capLabel"></p><label>Run length (seconds)<input id="duration" type="number" min="30" max="1800"></label><label>Rest break (seconds, minimum 30)<input id="rest" type="number" min="30" max="600"></label><label>Obstacle spacing (seconds, minimum 2.5)<input id="spacing" type="number" min="2.5" max="30" step=".5"></label><label class="check"><input id="restricted" type="checkbox"> Obstacles: subs, VIPs and mods only</label><label class="check"><input id="chatOutput" type="checkbox"> Post run updates to Twitch chat</label><label class="check"><input id="autoChat" type="checkbox"> Automatic demo chat</label><label>Demo event interval (seconds)<input id="autoRate" type="number" min="2" max="60"></label><label>Channel point reward title<input id="reward" maxlength="100"></label><label>Ghost boost reward title<input id="boostReward" maxlength="100"></label><label>Bits per obstacle<input id="bitsPerObstacle" type="number" min="1" max="10000"></label><label>Obstacle events for hype (30 seconds)<input id="hypeCount" type="number" min="2" max="30"></label><details><summary>Motion tuning & recording</summary><label>Knee lift upper threshold<input id="upper" type="number" step=".05" min="-1" max="1"></label><label>Knee lift lower threshold<input id="lower" type="number" step=".05" min="-2" max="0"></label><button id="record">Record landmarks</button><button id="download">Save last 30 seconds</button><label>Replay landmark JSON<input type="file" id="replay" accept=".json"></label><button id="stopCamera">Stop webcam / use keyboard</button></details><button id="disconnect">Disconnect Twitch</button><h3>Connection log</h3><pre id="logs">No Twitch connection yet.</pre></aside>
<div id="debug" hidden><h3>Motion signals</h3><pre id="signals"></pre><canvas id="graph" width="440" height="90"></canvas></div><div id="toast" role="status" hidden></div>`;
const canvas = $<HTMLCanvasElement>("game"),
  video = $<HTMLVideoElement>("video");
function notify(s: string) {
  if (!s) return;
  $("ticker").textContent = s;
  logs.push(s);
  logs = logs.slice(-40);
  $("logs").textContent = logs.join("\n");
}
function cameraError(s: string) {
  notify(s);
  $("cameraEmpty").hidden = false;
  $("cameraState").textContent = "CAMERA ERROR";
  if (game.phase === "playing") game.pause();
  mode = "keyboard";
  calibrating = false;
  $("modeLabel").textContent = "KEYBOARD MODE";
  $("camera").textContent = "Try webcam again";
}
const camera = new Camera(video, onFrame, cameraError);
function onFrame(f: Frame) {
  drawSkeleton(f);
  if (visible(f.points)) lostAt = performance.now();
  if (calibrating) {
    const b = calibration.update(f);
    const remaining = Math.max(
      0,
      3 - (f.t - (calibration.start ?? f.t)) / 1000,
    );
    $("motionStatus").textContent = visible(f.points)
      ? `STAND STILL · ${remaining.toFixed(1)}s`
      : "STEP BACK SO YOUR FEET ARE VISIBLE";
    if (b) {
      detector = new Detector(b, {
        upper: settings.upper,
        lower: settings.lower,
        idle: 40,
        run: 120,
        sprint: 170,
      });
      calibrating = false;
      notify("Calibration complete. Start a run when comfortable.");
      $("recalibrate").hidden = false;
    }
  } else if (detector) {
    motion = detector.update(f);
    if (motion.events.includes("jump")) jump = true;
    $("motionStatus").textContent = motion.visible
      ? motion.status
      : "CAN’T SEE YOU";
  }
}
function drawSkeleton(f: Frame) {
  const c = $<HTMLCanvasElement>("skeleton"),
    ctx = c.getContext("2d")!;
  c.width = video.videoWidth || 640;
  c.height = video.videoHeight || 360;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#a5e2c0";
  ctx.fillStyle = "#ff8a58";
  ctx.lineWidth = 4;
  for (const [a, b] of [
    [11, 12],
    [11, 23],
    [12, 24],
    [23, 24],
    [23, 25],
    [24, 26],
    [25, 27],
    [26, 28],
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16],
  ]) {
    const p = f.points[a],
      q = f.points[b];
    if (!p || !q || (p.visibility ?? 1) < 0.5 || (q.visibility ?? 1) < 0.5)
      continue;
    ctx.beginPath();
    ctx.moveTo(p.x * c.width, p.y * c.height);
    ctx.lineTo(q.x * c.width, q.y * c.height);
    ctx.stroke();
  }
  for (const p of f.points) {
    if ((p.visibility ?? 1) < 0.5) continue;
    ctx.beginPath();
    ctx.arc(p.x * c.width, p.y * c.height, 4, 0, 7);
    ctx.fill();
  }
}
async function enableCamera() {
  if (camera.active) return;
  $("camera").textContent = "Loading camera & pose model…";
  mode = "camera";
  calibrating = true;
  calibration = new Calibration();
  lostAt = performance.now();
  await camera.start();
  if (camera.active) {
    $("cameraEmpty").hidden = true;
    $("cameraState").textContent = "LIVE / MIRRORED";
    $("modeLabel").textContent = "WEBCAM MODE";
  }
}
$("camera").onclick = () => void enableCamera();
$("recalibrate").onclick = () => {
  calibrating = true;
  calibration = new Calibration();
  if (game.phase === "playing") game.pause();
};
$("stopCamera").onclick = () => {
  camera.stop();
  mode = "keyboard";
  replaying = false;
  calibrating = false;
  $("cameraEmpty").hidden = false;
  $("camera").textContent = "Enable webcam";
  $("cameraState").textContent = "CAMERA OFF";
  $("modeLabel").textContent = "KEYBOARD MODE";
  notify("Keyboard mode enabled. Hold right arrow to run.");
};
function ingest(e: SourceEvent) {
  if (game.phase !== "playing" && game.phase !== "paused") {
    notify("Start a run before sending chat effects.");
    return;
  }
  const result = queue.ingest(e, clock);
  notify(result.message);
  if (result.accepted && e.type === "chat" && e.text === "!join")
    twitch?.say(`${e.name} joined the chase!`);
  if (result.accepted && (e.type === "sub" || e.type === "gift"))
    twitch?.say(`Thanks ${e.name}! A shield for the runner.`);
}
$("start").onclick = () => {
  if (mode === "camera" && (calibrating || !detector)) {
    notify("Finish calibration before starting.");
    return;
  }
  if (game.phase === "playing" || game.phase === "paused") return;
  if (game.restLeft > 0) {
    notify(`Rest first · ${Math.ceil(game.restLeft)} seconds remaining.`);
    return;
  }
  game.duration = settings.duration;
  game.rest = settings.rest;
  if (game.start()) {
    queue.reset();
    clock = 0;
    twitch?.say(
      "Chat Chase is on! !join to race, !wall or !bar to send obstacles.",
    );
    notify("Run started. Move at your pace.");
  }
};
function pause() {
  game.pause();
  keys.clear();
  jump = false;
}
$("pause").onclick = pause;
function panel() {
  const p = $("panel");
  p.hidden = !p.hidden;
  if (!p.hidden) $("closePanel").focus();
}
$("controls").onclick = panel;
$("closePanel").onclick = panel;
window.addEventListener("keydown", (e) => {
  if (
    e.target instanceof HTMLElement &&
    e.target.matches("input,select,textarea")
  )
    return;
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowRight", "Backquote"].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (e.code === "Space" && !e.repeat) pause();
  if (e.code === "Backquote" && !e.repeat) panel();
  if (e.code === "Escape") $("panel").hidden = true;
  if (e.code === "KeyD" && !e.repeat) {
    debug = !debug;
    $("debug").hidden = !debug;
  }
  if (e.code === "ArrowUp" && !e.repeat && mode === "keyboard") jump = true;
  keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => {
  keys.clear();
  if (game.phase === "playing") {
    game.pause();
    notify("Paused while this window is out of focus.");
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.phase === "playing") pause();
});
$<HTMLInputElement>("demoToggle").checked = settings.demo;
function demoVisibility() {
  document
    .querySelectorAll<HTMLButtonElement>("[data-demo]")
    .forEach((b) => (b.disabled = !settings.demo));
  $("demoToggle")
    .closest("section")!
    .classList.toggle("enabled", settings.demo);
}
demoVisibility();
$("demoToggle").onchange = () => {
  settings.demo = $<HTMLInputElement>("demoToggle").checked;
  saveSettings(settings);
  demoVisibility();
};
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-demo]"))
  b.onclick = () => {
    if (!settings.demo) return;
    const kind = b.dataset.demo!;
    if (kind === "go" && game.ghosts.length) {
      const ghost = game.ghosts.at(-1)!;
      ingest({ type: "chat", text: "!go", id: ghost.id, name: ghost.name });
      return;
    }
    if (kind === "hype") {
      for (let i = 0; i < 5; i++)
        ingest(demoEvent(i % 2 ? "bar" : "wall", demoIndex++));
    } else {
      ingest(
        demoEvent(
          kind,
          kind === "go" ? Math.max(0, demoIndex - 1) : demoIndex++,
        ),
      );
    }
  };
for (const key of [
  "preset",
  "duration",
  "rest",
  "spacing",
  "restricted",
  "chatOutput",
  "autoChat",
  "autoRate",
  "reward",
  "boostReward",
  "hypeCount",
  "bitsPerObstacle",
  "upper",
  "lower",
] as const) {
  const el = $(key) as HTMLInputElement;
  const val = settings[key];
  if (typeof val === "boolean") el.checked = val;
  else el.value = String(val);
  el.onchange = () => {
    if (typeof val === "boolean") (settings as any)[key] = el.checked;
    else if (typeof val === "number") {
      const num = Number(el.value);
      (settings as any)[key] = Number.isFinite(num)
        ? Math.max(
            Number(el.min) || -Infinity,
            Math.min(Number(el.max) || Infinity, num),
          )
        : val;
    } else (settings as any)[key] = el.value;
    if (key === "preset") {
      const p = presets[settings.preset];
      settings.duration = p.duration;
      settings.rest = p.rest;
      $<HTMLInputElement>("duration").value = String(p.duration);
      $<HTMLInputElement>("rest").value = String(p.rest);
    }
    settings.rest = Math.max(30, settings.rest);
    settings.spacing = Math.max(2.5, settings.spacing);
    settings.lower = Math.min(settings.lower, settings.upper - 0.05);
    if (detector) {
      detector.thresholds.upper = settings.upper;
      detector.thresholds.lower = settings.lower;
    }
    Object.assign(queue.options, {
      cap: presets[settings.preset].cap,
      spacing: settings.spacing,
      restricted: settings.restricted,
      reward: settings.reward,
      boostReward: settings.boostReward,
      hypeCount: settings.hypeCount,
      bitsPerObstacle: settings.bitsPerObstacle,
    });
    if (twitch) twitch.output = isMock ? false : settings.chatOutput;
    saveSettings(settings);
    $("capLabel").textContent =
      `${presets[settings.preset].cap} obstacles per minute maximum. Run settings apply next run.`;
  };
}
$("capLabel").textContent =
  `${presets[settings.preset].cap} obstacles per minute maximum.`;
$("record").onclick = () => {
  camera.recording = !camera.recording;
  $("record").textContent = camera.recording
    ? "Stop recording"
    : "Record landmarks";
  notify(
    camera.recording
      ? "Recording up to 30 seconds of landmarks. No video is saved."
      : "Landmark recording stopped.",
  );
};
$("download").onclick = () => {
  if (!camera.frames.length) {
    notify("Enable the webcam, then record some landmarks first.");
    return;
  }
  const blob = new Blob(
    [JSON.stringify({ baseline: detector?.baseline, frames: camera.frames })],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "chat-chase-landmarks.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("replay").onchange = async () => {
  try {
    const file = $<HTMLInputElement>("replay").files?.[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    if (
      !data.baseline ||
      !Array.isArray(data.frames) ||
      !data.frames.length ||
      !data.frames.every(
        (f: Frame) => Number.isFinite(f.t) && Array.isArray(f.points),
      )
    )
      throw Error("Expected baseline and timestamped landmark frames.");
    camera.stop();
    replayFrames = data.frames;
    detector = new Detector(data.baseline);
    replayIndex = 0;
    replayStart = performance.now();
    replaying = true;
    mode = "camera";
    calibrating = false;
    lostAt = performance.now();
    $("modeLabel").textContent = "LANDMARK REPLAY";
    notify("Replaying landmarks; video is not recorded.");
  } catch (e) {
    notify(`Could not load replay: ${String(e)}`);
  }
};
$("connect").onclick = () => {
  try {
    login();
  } catch (e) {
    notify(String(e));
    $("panel").hidden = false;
  }
};
$("disconnect").onclick = () => {
  twitch?.close();
  twitch = null;
  sessionStorage.removeItem("cc.token");
  name = "You";
  $("connection").textContent = "LOCAL / OFFLINE";
  $("connect").textContent = "Connect Twitch";
  notify("Twitch disconnected.");
};
const mockUser = import.meta.env.VITE_TWITCH_MOCK_USER_ID as string | undefined;
const mockUrl = import.meta.env.VITE_TWITCH_WS_URL || "";
const isMock =
  !!mockUser && /^ws:\/\/(127\.0\.0\.1|localhost):\d+\//.test(mockUrl);
const authReady = isMock
  ? Promise.resolve({
      token: "local-mock-only",
      identity: {
        user_id: mockUser!,
        login: "mock-runner",
        client_id: "local-mock-only",
        expires_in: 86400,
      },
    })
  : authenticate();
void authReady
  .then((auth) => {
    if (!auth) return;
    name = auth.identity.login;
    twitch = new Twitch(
      auth.token,
      auth.identity,
      ingest,
      (s) => {
        notify(s);
        if (s === "Twitch connected")
          $("connection").textContent = "TWITCH / CONNECTED";
        if (s.includes("disconnected"))
          $("connection").textContent = "TWITCH / RECONNECTING";
      },
      isMock ? false : settings.chatOutput,
    );
    twitch.connect();
    $("connect").textContent = auth.identity.login;
    setTimeout(
      () => {
        void authenticate().catch((e) => {
          notify(String(e));
          twitch?.close();
        });
      },
      Math.max(1000, auth.identity.expires_in * 1000),
    );
  })
  .catch((e) => notify(String(e)));
function updateUI(cadence: number) {
  $("distance").textContent = Math.floor(game.distance).toLocaleString();
  const left = Math.max(0, Math.ceil(game.duration - game.time));
  $("timer").textContent = `${Math.floor(left / 60)
    .toString()
    .padStart(2, "0")}:${(left % 60).toString().padStart(2, "0")}`;
  $("timebar").style.width = `${100 * (1 - game.time / game.duration)}%`;
  $("cadence").innerHTML = `${Math.round(cadence)} <small>SPM</small>`;
  $("paceState").textContent =
    cadence < 40
      ? "IDLE"
      : cadence < 120
        ? "JOGGING"
        : cadence <= 170
          ? "RUNNING"
          : "SPRINTING";
  document
    .querySelectorAll<HTMLElement>(".pace-bars i")
    .forEach((b, i) => b.classList.toggle("lit", i < cadence / 8));
  $("racerCount").textContent =
    `${game.ghosts.length + 1} ${game.ghosts.length ? "RUNNERS" : "RUNNER"}`;
  const leaders = $("leaders");
  leaders.replaceChildren();
  game.leaderboard(name).forEach((r, i) => {
    const row = document.createElement("div");
    row.className = "leader" + (r.id === "streamer" ? " you" : "");
    const rank = document.createElement("span");
    rank.textContent = String(i + 1).padStart(2, "0");
    const n = document.createElement("b");
    n.textContent = r.name + (r.id === "streamer" ? " / YOU" : "");
    const d = document.createElement("strong");
    d.textContent = Math.floor(r.distance) + " m";
    const avatar = document.createElement("i");
    avatar.className = "leader-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = r.name.slice(0, 1).toUpperCase();
    row.append(rank, avatar, n, d);
    leaders.append(row);
  });
  $("queueCount").textContent = queue.pending.length + " QUEUED";
  $("shield").textContent = game.shield ? "SHIELD READY" : "NO SHIELD";
  $("shield").classList.toggle("active", game.shield);
  $("sprint").hidden = game.sprintUntil <= game.time;
  const o = game.obstacles[0];
  $("warning").textContent = o
    ? `${o.kind === "wall" ? "JUMP ↑" : "DUCK ↓"} · ${o.name} · ${Math.max(0, o.arrival - game.time).toFixed(1)}s`
    : "A little movement. A lot of chat.";
  $("warning").classList.toggle("urgent", !!o);
  $("pause").innerHTML =
    pauseIcon + (game.phase === "paused" ? " Resume" : " Pause");
  $<HTMLButtonElement>("pause").disabled = !["playing", "paused"].includes(
    game.phase,
  );
  $<HTMLButtonElement>("start").disabled =
    ["playing", "paused"].includes(game.phase) || game.restLeft > 0;
  $("start").textContent =
    game.restLeft > 0
      ? `Rest · ${Math.ceil(game.restLeft)}s`
      : game.phase === "results"
        ? "Start next run"
        : "Start a run";
  if (debug) {
    $("signals").textContent = JSON.stringify(
      {
        mode,
        cadence,
        squat: motion.squat,
        lifts: motion.lifts,
        angle: motion.angle,
        thresholds: detector?.thresholds,
        events: motion.events,
      },
      null,
      2,
    );
    graph.push(motion.lifts[0] ?? -1);
    graph = graph.slice(-150);
    const ctx = $<HTMLCanvasElement>("graph").getContext("2d")!;
    ctx.clearRect(0, 0, 440, 90);
    ctx.strokeStyle = "#ff8a58";
    ctx.beginPath();
    graph.forEach((n, i) =>
      i ? ctx.lineTo(i * 3, 45 - n * 25) : ctx.moveTo(0, 45 - n * 25),
    );
    ctx.stroke();
    ctx.strokeStyle = "#a5e2c0";
    for (const threshold of [settings.upper, settings.lower]) {
      ctx.beginPath();
      ctx.moveTo(0, 45 - threshold * 25);
      ctx.lineTo(440, 45 - threshold * 25);
      ctx.stroke();
    }
  }
}
function loop(now: number) {
  const dt = Math.min(0.1, Math.max(0, (now - previous) / 1000));
  previous = now;
  if (replaying) {
    while (
      replayIndex < replayFrames.length &&
      replayFrames[replayIndex].t - replayFrames[0].t <= now - replayStart
    )
      onFrame({
        ...replayFrames[replayIndex],
        t: replayStart + replayFrames[replayIndex++].t - replayFrames[0].t,
      });
    if (replayIndex >= replayFrames.length) {
      replaying = false;
      if (game.phase === "playing") game.pause();
      notify("Landmark replay complete.");
    }
  }
  if (
    mode === "camera" &&
    !calibrating &&
    now - lostAt > 1000 &&
    game.phase === "playing"
  ) {
    game.pause();
    notify("Can’t see you. Step back into frame, then resume.");
  }
  const cadence =
    mode === "keyboard" ? (keys.has("ArrowRight") ? 156 : 0) : motion.cadence;
  const squat = mode === "keyboard" ? keys.has("ArrowDown") : motion.squat;
  const before = game.phase;
  if (game.phase === "playing") {
    clock += dt * 1000;
    if (settings.demo && settings.autoChat && clock >= autoAt) {
      autoAt = clock + Math.max(2, settings.autoRate) * 1000;
      const choices = ["join", "wall", "bar", "go", "sub"];
      ingest(
        demoEvent(
          choices[Math.floor(Math.random() * choices.length)],
          demoIndex++,
        ),
      );
    }
    for (const e of queue.drain(clock, false)) game.effect(e);
  }
  game.tick(dt, { cadence, jump, squat });
  jump = false;
  if (before === "playing" && game.phase === "results") {
    queue.pending = [];
    twitch?.say(
      "Run complete! " +
        game
          .leaderboard(name)
          .slice(0, 3)
          .map((r, i) => `${i + 1}. ${r.name} ${Math.round(r.distance)}m`)
          .join(" · "),
    );
    notify("Run complete. Take a well-earned rest.");
  }
  while (game.notices.length) notify(game.notices.shift()!);
  render(canvas, game, squat, now);
  if (now - uiAt > 100) {
    updateUI(cadence);
    uiAt = now;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.addEventListener("beforeunload", () => {
  camera.stop();
  twitch?.close();
});
