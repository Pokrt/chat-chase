# Chat Chase visual system

## Direction
A midnight running-track broadcast with a sunset race scene, warm orange actions and mint readiness/safety cues. Desktop Chrome and 1920×1080 OBS capture are the primary context. Copy keeps the runner in control: “Move at your pace. Chat can wait.”

## Color and type
- Page: `#11171b`; race shell: `#1b272d`; pack panel: `#192328`; controls drawer: `#192327`. Camera uses a radial gradient from `#2b403f` to `#1b292d` with a subtle arched framing guide.
- Main text: warm off-white `#f4f0e5`; secondary text: `#a8b9ba`; dividers: `#354145`.
- Action/player: orange `#ff8a58`, with dark button text `#181a16`; primary hover: `#ffa67f`. Urgent warnings use peach `#ffad80`.
- Readiness, pace, timer, shield and focus: mint `#a5e2c0`. The current runner row uses `#252d29` with mint text and an orange initial badge.
- Locally bundled Barlow Condensed 600/700 supplies the 36px wordmark, headings, score and timer. Arial/Helvetica supplies interface text. Desktop distance is 96px, timer 52px, pace 36px; uppercase labels generally use 11–12px text with generous tracking. Numeric telemetry uses tabular numerals.

## Layout and components
The 76px header holds the wordmark and angled arrow, tagline, connection indicator and actions. Main content is centered at a maximum 1840px with 3.3% horizontal padding. A compact 286px upper grid pairs the camera with race information in a `0.72fr 1.28fr` split, separated by 25px. Race information forms two columns: distance/time with a 24-bar slanted pace meter beneath, and a separate pack panel spanning both rows. All racers appear in rank order in its scrolling list; rows contain rank, viewer initial, name and distance. The join prompt stays beneath that list.

The full-width race panel follows after 20px. Its 58px-minimum toolbar carries track identity, state badges and warnings. The canvas height is `clamp(330px, 38vh, 440px)`, followed by keyboard hints and 44px-minimum action buttons. Below sit the chat ticker, wrapping manual demo controls and footer. Main panels use 12px corners; buttons use 6px corners and fine outlines. Thin rules and spacing organize the broadcast.

At 1700px and above, the upper grid grows to 306px and scoreboard spacing increases. At 1100px and below, race information switches explicitly to a vertical flex stack, keeping telemetry, pace and the pack in sequence without the desktop grid placement. Distance becomes 68px and the upper area 335px tall. Below 700px, camera and race information stack, distance becomes 80px, the pack is constrained to 150–240px, the canvas becomes 300px, and toolbars/actions wrap. Secondary header details disappear. The ready-screen headline also scales and repositions for narrow canvases; paused/results overlays remain desktop-oriented.

## Race illustration
The scene layers a blue-green-to-warm-brown sky (`#182b34`, `#38504d`, `#a27855`), peach sun, windowed city silhouettes, low rolling foreground, illuminated rail and gradient track. Background layers move more slowly than lane markings to establish depth. Sequential world-distance markers advance in 50m increments without wrapping labels out of order.

The player is a larger athletic silhouette with orange jersey and headband, dark shorts, light shoes and a ground shadow. Stride follows distance; ducking changes the silhouette, jumping lifts it, and a mint ellipse indicates a shield. Walls have a lit cap, shaded side and diagonal details; overhead bars remain yellow. Up to eight translucent blue-gray ghosts are drawn on track. Their dark nameplates are clamped to the canvas and placed into available vertical rows to avoid colliding with one another; a label is omitted when no row fits.

## Interaction and states
- Keyboard mode is immediately available. Right arrow runs, up jumps, down ducks; Space pauses/resumes. Backtick toggles controls, Escape closes them, and D toggles motion diagnostics.
- Webcam activation shows loading, mirrored video and a mint skeleton with orange landmarks. Calibration asks the runner to stand still or bring feet into view. Recalibration pauses play; camera failures return to keyboard mode with ticker feedback.
- Distance, countdown, pace and ranks update during play. Incoming obstacles trigger a prominent 25px condensed jump/duck warning with sender and arrival time. Shield and sprint badges include text state.
- Unavailable start/pause actions disable. Start becomes a rest countdown or “Start next run.” Canvas overlays distinguish ready, paused, and completed/rest states.
- The 410px right-side controls drawer scrolls independently and contains settings, connection log and advanced landmark tools. Demo buttons depend on the Demo mode checkbox. Event feedback uses the chat-feed status area.
- Buttons have short color/border transitions, orange demo hover emphasis and a 1px pressed offset. Reduced-motion preference removes button transitions.

## Accessibility and boundaries
Native buttons, inputs, selects, labels and checkboxes support keyboard operation. Interactive elements have a 3px mint focus outline with 4px offset. Icon-only controls have accessible names; decorative SVGs and viewer initials are hidden from assistive technology. The chat feed uses `role="status"`, and the race canvas has a descriptive accessible label. Warnings and state changes include words rather than relying solely on color.

Play pauses on window blur, hidden document, or sustained loss of body visibility. Game shortcuts are ignored while a form field is active. Opening the drawer focuses its close button, but it has no focus trap or focus restoration. Canvas gameplay/results lack an equivalent structured screen-reader representation; reduced-motion handling covers interface transitions, not the animated race. These are implementation boundaries, not claims of full accessibility conformance.
