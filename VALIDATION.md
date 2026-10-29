# Validation report

## Completed locally

- Strict TypeScript check and Vite production build.
- 33 Vitest checks: obstacle caps across mixed sources, spacing, viewer cooldowns, bounded queue, role gates, pause, hype, collision timing, shield, rest, ghost races, double points, calibration visibility, synthetic running/jump/squat regression fixtures, event mapping, OAuth state mismatch, EventSub subscribe failure isolation, notification deduplication, reconnect transfer, keepalive watchdog and output throttle.
- Chrome browser interaction checks: start, keyboard running (distance advances), demo join, shield effect, paused timer, effects held while paused, controls open/close, no horizontal desktop overflow.
- Independent visual review of the 1440×1100 idle state: ship. Singular “1 RUNNER” label corrected.
- Dependency security audit after updating the test runner: zero reported vulnerabilities at build time.

## Must verify with your hardware/account

1. Calibrate at 2–3 m in room lighting; collect 30 s of running landmarks. Check cadence latency and false jump count.
2. Perform 20 comfortable jumps and 20 squats with a spotter/log. Target ≥18/20 correct for each, zero false jumps in steady running. Save real recordings; fixtures currently committed are synthetic and explicitly labeled.
3. Measure Chrome frame timing with webcam and pose active on a mid-range laptop. Target ≥30 rendered fps and ≥25 pose fps; GPU is attempted first, CPU is a fallback. Synchronous pose work can limit slower machines.
4. On a real non-Affiliate channel, verify !join / !go / !wall / !bar from a viewer account. Verify failed privileged subscriptions remain visible without breaking chat. Test disconnect/reconnect and token expiration.
5. With Twitch CLI, exercise all event types and reconnect; use controlled JSON for actionable chat commands and matching reward titles.
6. Record a real webcam demonstration under 3 minutes and publish to YouTube. The local video demonstrates keyboard/demo gameplay only.

No physical accuracy, frame-rate benchmark or real-channel acceptance result is claimed by this report.

## Official Twitch CLI integration run

Verified with the official Twitch CLI v1.1.24 (Darwin ARM64, archive checksum verified): cheer 300 → three obstacles, subscribe → shield, gift → shield, matching reward redemption → wall, and WebSocket reconnect transfer. Logs showed successful subscriptions for those four types and corresponding in-game effects, including shield absorption and stumbles.

This CLI release rejects `channel.chat.message` v1 because it predates that subscription type. That isolated failure leaves the other four functioning. Chat mapping and transport are covered with mocked notifications in tests; real-channel chat verification remains pending. README documents this version limitation.

## Jump timing audit

Ascent timing now begins when both ankles leave the near-ground band, rather than being reset on every frame below the final jump threshold. Slow drift above 300 ms is rejected, each accepted jump requires landing before rearming, and a lost pose cannot reappear airborne and synthesize a jump. Three regression tests cover these cases. All 33 tests and the strict production build pass. This does not substitute for real-camera accuracy measurement.
