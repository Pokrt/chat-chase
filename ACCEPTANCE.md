# Scope and acceptance audit

This matrix preserves the supplied specification's full scope. “Implemented” describes source/runtime evidence; it does not claim outstanding physical or account-dependent acceptance tests passed.

| Spec | Requirement | Current evidence / remaining gate |
| --- | --- | --- |
| 1–3 | Webcam runner, chat interaction, no hardware/backend/database | Implemented in browser; keyboard/demo playable. User webcam trial remains pending. |
| 4 | TypeScript/Vite, MediaPipe GPU then CPU, Canvas, npm, Vitest | package.json, pose adapter, renderer, strict build and tests. |
| 5 | Mirrored webcam/skeleton, cadence/status, track, leaderboard, sender warnings, feed, hidden controls | Desktop screenshots and browser checks; backtick controls. OBS instructions in README. Phone stream legibility should be checked with actual OBS output. |
| 6.1–6.2 | Landmark visibility, torso normalization, 3 s still calibration | Pure motion module and calibration tests. Camera field-of-view/distance trial pending. |
| 6.3 | Smoothed knee lift, hysteresis, step filtering, 3 s cadence and pace states | Pure Detector implementation and synthetic running replay test. Real running latency/false-positive measurement pending. |
| 6.4 | Simultaneous ankles, rapid ascent, straight-enough knees, 600 ms jump refractory | Detector plus jump fixture and ascent/landing/reappearance tests. ≥90% physical accuracy unverified. |
| 6.5 | Hip drop and knee angle squat with start/end | Detector plus squat fixture test. ≥90% physical accuracy unverified. |
| 6.6 | Lost-person pause, debug signals/graphs, landmark recording and replay | Main loop timeout, debug graph, Camera recording and JSON replay. Three committed fixtures are synthetic, not the requested real recorded fixtures. Actual recordings require a person/camera session. |
| 7.1 | Smoothed cadence speed, distance, duration, results, rest | Game module and tests; runtime browser movement check. |
| 7.2 | Wall/jump, bar/duck, 2 s sender warnings, stumbles, bonuses, spacing | Collision/timing/spacing tests and browser/video demo. |
| 7.3 | One shield; 20 s double-distance Sprint Zone | Game tests, demo and official Twitch mock shield/cheer run. |
| 7.4 | Unique viewer ghosts, 10 s !go, channel-point boost, eight rendered, all ranked | Game/effect modules; configurable boost reward added; ghost and redemption tests. All ghosts are in the scrollable ranking. |
| 8.1 | Browser OAuth state, token fragment removal, validation, session storage, env settings | Auth implementation and state rejection test; real broadcaster authentication pending user client ID/sign-in. |
| 8.2 | WebSocket welcome/subscriptions, keepalive watchdog, reconnect transfer, revocation, dedup, partial failures, mock URLs | Transport tests and official Twitch CLI run. Four event types verified with CLI v1.1.24; that CLI predates chat-message v1. Real chat check pending. |
| 8.3 | Command/event mapping, configurable titles/bits/hype/roles, cooldowns, one bounded capped queue | Effect tests, controls, real CLI mock delivery and demo. |
| 8.4 | Start/results/join/thanks output, five-second throttle, toggle | Twitch queue/flush implementation and throttle test. Real chat posting remains pending broadcaster sign-in. |
| 9 | Preset caps, pause, minimum rest, lost-person pause, friendly copy | Pure queue/game tests, browser pause test, recorded safety controls. |
| 10 | Demo toggle/query, source simulation buttons, automatic chat rate | Browser-tested; same ingest/queue/game paths. |
| 11 | Pure motion/game/effects separated from adapters | Source organization. Camera management is co-located with pose adapter, not a separate camera directory. |
| 12 | Runnable pose/game/demo/Twitch/polish deliverables | Built application, public source, tests, screenshots, GIF, local video. Physical/live acceptance outstanding. |
| 13 | ≥90% motion accuracy; ≥30 fps on mid-range laptop | Not proven: requires physical validation on the target machine. |
| 13 | Mock events and real non-Affiliate chat | Four CLI event types verified; chat tested with mocked notification transport. Real non-Affiliate end-to-end chat remains unverified. |
| 13 | Safety limits cannot be bypassed by events | Mixed-source cap, cooldown, spacing, pause and overflow tests. |
| 13 | Fresh install/run; tests | GitHub CI runs npm ci, npm test and production build successfully. README documents npm install/dev. |
| 14 | README pitch/GIF, play, commands, Twitch, OBS, CLI, safety, Codex usage | README, demo.gif, preview.png, DEMO.md and VALIDATION.md. |
| Hackathon | Public repository with run instructions | https://github.com/Pokrt/chat-chase |
| Hackathon | Public YouTube demo under 3 minutes | Local demo.mp4 and final webcam video script supplied. YouTube upload not published; authorized upload access is unavailable. |

## Required external participation

To close full acceptance, the broadcaster must provide their public Twitch client ID and sign in, perform the physical webcam trials/recordings on the target laptop, and provide an authorized YouTube upload path for the final public video. These are the remaining blockers, rather than passing results inferred from synthetic fixtures or mocked events.
