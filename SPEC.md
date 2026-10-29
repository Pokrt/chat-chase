# Chat Chase — Product & Technical Specification

Hackathon: Codex x TwitchCon Hackathon (Devpost). Deadline: **Mon Nov 2, 2026, 14:00 PST (23:00 CET)**.
Hard requirements from the rules: the project is built during the hackathon period, it is built with OpenAI Codex, it works on Twitch, it has a public repo with run instructions, and it has a public YouTube demo video under 3 minutes.

---

## 1. One-sentence pitch

**Chat throws it, you dodge it.** The streamer runs in place in front of a normal webcam; their real body movement drives an avatar in a side-scrolling race, while Twitch chat throws obstacles that the streamer must physically dodge — jump over walls, squat under bars.

## 2. Goals and non-goals

### Goals (in priority order)
1. Reliable webcam-based detection of **running in place (cadence)**, **jump**, and **squat**, in the browser, no extra hardware.
2. A fun, readable side-scroller game driven by those movements.
3. Live Twitch integration: chat commands and Twitch events spawn obstacles, power-ups, and rival runners.
4. A streamer control panel with safety limits and a pause button.
5. A **demo mode** that simulates all Twitch events locally, so the full experience can be shown and tested without a live audience.

### Non-goals
- No backend server, no database, no user accounts beyond Twitch OAuth.
- No payments, no external donation services (Streamlabs/StreamElements), no Patreon.
- No Twitch Extension packaging (overlay is captured with OBS).
- No mobile support. Desktop Chrome only.
- No physical hardware (treadmills etc.).

## 3. Users and setup

- **Streamer**: opens the web app in desktop Chrome, logs in with Twitch, calibrates, plays. Captures the browser window in OBS with **Window Capture** (not a Browser Source — the webcam can usually only be opened by one app at a time on Windows).
- **Viewers**: interact only through Twitch chat and Twitch features (bits, subs, channel points). They do not need to open anything.

## 4. Tech stack

- **TypeScript + Vite**, single-page app, no framework required (vanilla TS or a very small UI layer is fine). If a UI framework is used, use Vue 3.
- **Pose**: `@mediapipe/tasks-vision` `PoseLandmarker`, `runningMode: "VIDEO"`, `numPoses: 1`, `delegate: "GPU"` (fallback to CPU), model `pose_landmarker_lite` (switch to `full` only if accuracy is insufficient and fps stays ≥ 25).
- **Game rendering**: **PixiJS** (v8) or plain Canvas 2D. Keep the game logic independent of the renderer.
- **Twitch**: EventSub over **WebSocket** directly from the browser + Helix REST API. OAuth **implicit grant flow** (no client secret).
- **Testing**: Vitest for unit tests of pure logic (motion detection, event→effect mapping, rate limiting, game rules).
- Package manager: npm.

## 5. Screen layout (1920×1080, designed for stream capture)

```
+--------------------------------------------------------------+
|  [Webcam feed with skeleton overlay]   |  LEADERBOARD        |
|  (left ~40%, mirrored)                 |  1. viewerA 1240 m  |
|                                        |  2. viewerB  980 m  |
|  Cadence: 162 spm   Status: RUNNING    |  ...                |
+--------------------------------------------------------------+
|  GAME: side-scroller, full width, bottom ~55%                |
|  streamer avatar, rival ghosts, obstacles, distance, timer   |
|  incoming-obstacle warnings with the name of who sent it     |
+--------------------------------------------------------------+
|  Event ticker: "viewerC dropped a WALL!"  "viewerD: SHIELD"  |
+--------------------------------------------------------------+
```

- Large, high-contrast text readable on a phone viewing the stream.
- Every chat-triggered thing shows the viewer's name. Recognition is the core reward.
- A separate **control panel** (toggle with `` ` `` key, or a second route `/#/control`) holds settings; it must not be visible in the captured game area when hidden.

## 6. Motion detection

All detection logic lives in pure, unit-tested modules (`src/motion/*`) that take landmark frames and timestamps and return state. No DOM in these modules.

### 6.1 Landmarks used (MediaPipe pose indices)
- Shoulders 11/12, hips 23/24, knees 25/26, ankles 27/28.
- Use normalized image coordinates (y grows downward). Ignore landmarks with `visibility < 0.5`.
- **Body scale** = distance between shoulder midpoint and hip midpoint. Normalize all vertical thresholds by body scale, so detection works at any distance from the camera.

### 6.2 Calibration (start of every session)
- Prompt: "Stand still, full body visible, for 3 seconds."
- Record baseline: mean hip-mid y, ankle y, knee angles, body scale.
- If the full body (hips, knees, ankles) is not visible, show a clear "Step back so your feet are visible" message and do not start.

### 6.3 Running in place → cadence
- Signal: knee lift = for each leg, (hip y − knee y) normalized by body scale; alternatively vertical hip-mid oscillation. Use whichever is more robust in testing; knee lift is preferred.
- Smooth with an exponential moving average.
- Count a **step** when one knee's lift crosses an upper threshold, re-armed only after it falls below a lower threshold (**hysteresis**). Steps should alternate legs; ignore a second consecutive step from the same leg within 150 ms.
- Cadence = steps per minute over a sliding 3-second window.
- States: `IDLE` (< 40 spm), `JOGGING` (40–120), `RUNNING` (120–170), `SPRINTING` (> 170). Thresholds configurable.

### 6.4 Jump
- Both ankles rise above baseline by > 0.25 × body scale within 300 ms, while knees are not in a deep bend.
- Emit a single `jump` event; 600 ms refractory period.
- Must not be triggered by fast running in place (require both ankles simultaneously).

### 6.5 Squat
- Hip-mid y drops below baseline by > 0.35 × body scale **and** average knee angle < 120°.
- Emit `squatStart` / `squatEnd`. The game counts the player as "ducking" while in squat.

### 6.6 Robustness
- Frame drops or a lost person (no landmarks for > 1 s) → game auto-pauses with "Can't see you".
- Expose a debug overlay (toggle `D`) showing raw signals, thresholds, and detected events as live graphs. This is essential for tuning.
- Record/replay: allow saving ~30 s of landmark frames to JSON and replaying them through the detectors in tests. Commit 2–3 recorded fixtures (running, jumping, squatting) and test against them.

## 7. Game rules

### 7.1 Core loop
- Avatar horizontal speed = f(cadence), smoothed so it never jumps abruptly. Speed 0 at IDLE, max at SPRINTING.
- Distance accumulates in meters; shown prominently.
- A **run** lasts a configurable duration (default 3 minutes), then shows results and the leaderboard, then a configurable rest break (default 60 s) before the next run can start.

### 7.2 Obstacles
| Obstacle | Required action | Visual |
|---|---|---|
| Wall | Jump | low wall on the ground |
| Bar | Squat (duck) | bar at head height |

- Every obstacle is announced **2 seconds** before it arrives with a big warning icon (JUMP / DUCK) and the sender's name.
- Hit = avatar stumbles, loses speed for 2 s, small distance penalty. No game over.
- Successful dodge = "+DODGE" popup, small bonus, and the sender's name shows "dodged!" (fun for chat either way).
- Minimum spacing between obstacles: 2.5 s (configurable). Never two obstacles requiring different actions within 1.5 s.

### 7.3 Power-ups
- **Shield**: next hit is ignored. Max 1 held.
- **Sprint Zone**: 20 s of double distance points. Triggered by hype (see 8.3).

### 7.4 Rival runners (viewers)
- A viewer types `!join` to enter the current run as a ghost runner.
- Ghost speed = a simulated pace that each viewer can boost with chat commands (`!go`, max once every 10 s per viewer) and channel-point redemptions.
- Show up to 8 ghosts on screen (most recent/most active); all are on the leaderboard.
- At run end, the leaderboard ranks streamer and ghosts by distance.

## 8. Twitch integration

### 8.1 Auth
- Implicit grant: `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=<CLIENT_ID>&redirect_uri=<REDIRECT>&scope=<SCOPES>&state=<random>`.
- Read `access_token` from the URL fragment, verify `state`, call `GET https://id.twitch.tv/oauth2/validate` to get `user_id` and `login`. Store the token in `sessionStorage` only.
- Scopes: `user:read:chat user:write:chat bits:read channel:read:subscriptions channel:read:redemptions`.
- `CLIENT_ID` and redirect URI come from `.env` (`VITE_TWITCH_CLIENT_ID`, `VITE_TWITCH_REDIRECT_URI`). Provide `.env.example`.

### 8.2 EventSub over WebSocket
- Connect to `wss://eventsub.wss.twitch.tv/ws`. On `session_welcome`, read `payload.session.id` and **within 10 seconds** create subscriptions via `POST https://api.twitch.tv/helix/eventsub/subscriptions` with `transport: { method: "websocket", session_id }`.
- Handle `session_keepalive` (reset a watchdog; reconnect if nothing arrives for keepalive_timeout + 5 s), `session_reconnect` (connect to the provided `reconnect_url`, then close the old socket), `revocation`, and `notification`.
- Deduplicate notifications by `metadata.message_id`.
- Subscriptions:
  - `channel.chat.message` v1 — condition `{ broadcaster_user_id, user_id }` (both = streamer).
  - `channel.cheer` v1 — condition `{ broadcaster_user_id }`.
  - `channel.subscribe` v1 and `channel.subscription.gift` v1.
  - `channel.channel_points_custom_reward_redemption.add` v1.
- If a subscription fails (e.g. channel is not Affiliate, so no bits/subs/channel points), log it, show it in the control panel, and **continue**. Chat commands must always work.
- Base URLs for WebSocket and the subscriptions endpoint must be configurable so the app can point to the **Twitch CLI mock server** (`twitch event websocket start-server`, default `ws://127.0.0.1:8080/ws` and `http://127.0.0.1:8080/eventsub/subscriptions`).

### 8.3 Event → effect mapping (configurable in control panel)
| Source | Effect |
|---|---|
| `!join` | Viewer joins as ghost runner |
| `!go` | Boost your own ghost (10 s per-viewer cooldown) |
| `!wall` / `!bar` | Queue an obstacle. Per-viewer cooldown 60 s, global rate limit applies. Available to everyone by default (so it works on non-Affiliate channels); optional "subs/VIPs/mods only" toggle |
| Channel points reward "Drop an obstacle" | Queue an obstacle, ignores per-viewer cooldown |
| Cheer | Obstacle wave: 1 obstacle per 100 bits, max 3 per cheer |
| Sub / gift sub | Streamer gets a Shield; chat message thanking the subscriber |
| Hype: ≥ 5 obstacle-type events within 30 s | Sprint Zone for 20 s |

- All triggered effects go through a single **effect queue** that enforces the safety limits (section 9). Excess effects are dropped with a visible "Queue full — chill, chat 😄" ticker message rather than piling up.

### 8.4 Chat output
- Post short messages via `POST https://api.twitch.tv/helix/chat/messages` (`broadcaster_id`, `sender_id`, `message`): run start, run results (top 3), joins acknowledged in batches (max one bot message every 5 s to avoid spam).
- Toggle in control panel to disable chat output.

## 9. Safety & streamer control (must be in the demo video)

Donations and chat only ever change the **game**. The streamer always decides how hard they physically move.

- **Intensity presets**: Chill / Normal / Spicy → max obstacles per minute (6 / 10 / 15), run length, rest break length.
- **Pause** hotkey (`Space`) and a big pause button: freezes the game and the effect queue.
- Mandatory rest break between runs (configurable, minimum 30 s).
- Auto-pause if the person leaves the frame.
- No feature may encourage pain, injury, or exhaustion. No "pay to make the streamer do X more" beyond the capped game mechanics. Keep all copy friendly.

## 10. Demo mode

- Toggle in the control panel (and `?demo=1` URL param).
- Buttons to simulate: viewer joins (random names), `!go`, `!wall`, `!bar`, cheer (100/300 bits), sub, gift sub, channel point redemption, hype burst.
- Optional "auto chat" that generates a realistic stream of events at a configurable rate.
- Demo mode uses the **same effect queue and game code paths** as real Twitch events — it only replaces the event source.

## 11. Project structure

```
src/
  main.ts                 app bootstrap, routing between screens
  config.ts               defaults + localStorage-persisted settings
  camera/                 getUserMedia, video element management
  pose/                   MediaPipe wrapper -> LandmarkFrame stream
  motion/                 PURE: calibration, cadence, jump, squat, types
  game/                   PURE game state + rules (tick(dt, inputs) -> state)
  render/                 PixiJS/Canvas rendering of game state + HUD
  effects/                PURE: effect queue, rate limits, mapping events -> effects
  twitch/                 auth, eventsub websocket client, helix api, chat output
  demo/                   simulated event source
  ui/                     control panel, calibration screens, debug overlay
tests/
  fixtures/               recorded landmark JSON
  *.test.ts
```

Design rule: `motion/`, `game/`, `effects/` are pure TypeScript with no DOM or network access, fully unit-testable. Everything else is a thin adapter.

## 12. Milestones (build in this order; each must be runnable before moving on)

1. **M1 — Pose prototype**: webcam + skeleton overlay + debug graphs; calibration; cadence, jump, squat detection with unit tests and record/replay. *This is the main risk — get it solid first.*
2. **M2 — Game loop**: avatar speed from cadence, obstacles requiring jump/squat, hits/dodges, distance, run timer, results screen. Keyboard fallback (`↑` = jump, `↓` = squat, `→` held = run) for development.
3. **M3 — Effects + demo mode**: effect queue with safety limits, demo event buttons, ghosts and leaderboard.
4. **M4 — Twitch**: OAuth, EventSub WebSocket client (with Twitch CLI mock support), chat commands, cheers/subs/redemptions, chat output.
5. **M5 — Polish**: stream-readable visuals, sounds (optional, toggleable), control panel, README with setup steps, screenshots/GIF.

## 13. Acceptance criteria

- At ~2–3 m from a 720p webcam in normal room light: running in place is detected within 1 s; jumps and squats are detected with ≥ 90% accuracy in manual testing; no false jump during steady running.
- Game holds ≥ 30 fps with pose detection running on a mid-range laptop.
- With the Twitch CLI mock server, every subscribed event type produces the correct in-game effect.
- On a real (non-Affiliate) Twitch channel, chat commands work end to end and failed bits/subs subscriptions do not break anything.
- Safety limits cannot be exceeded by any combination of events.
- `npm install && npm run dev` works from a fresh clone following the README; `npm test` passes.

## 14. README must include

- What it is (pitch + GIF), how to play, chat commands.
- Twitch app setup: create an app at dev.twitch.tv, set redirect URI, copy client ID to `.env`.
- OBS setup (Window Capture, crop).
- Testing with Twitch CLI mock: start-server + trigger examples.
- Safety section.
- How Codex was used.
