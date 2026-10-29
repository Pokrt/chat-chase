# Chat Chase visual system

## Direction
A midnight running-track broadcast: a compact scoreboard above a wide side-scrolling race, warm orange actions, and mint readiness and safety cues. Desktop Chrome and 1920×1080 OBS capture are the primary context. Copy keeps the runner in control: “Move at your pace. Chat can wait.”

## Color and type
- Page: `#11171b`; camera: `#1c262b`; race shell: `#1b272d`; controls drawer: `#192327`.
- Main text: warm off-white `#f4f0e5`; secondary text: `#a8b9ba`; dividers: `#354145`.
- Action/player: orange `#ff8a58`, with dark button text `#181a16`; primary hover: `#ffa67f`.
- Readiness, pace, timer, shield, focus: mint `#a5e2c0`. The current runner row uses `#252d29` with mint text.
- Canvas adds blue-black skyline layers, slate track lanes, orange walls, yellow overhead bars, translucent blue-gray ghosts, and a mint shield outline.
- Locally bundled Barlow Condensed 600/700 supplies the wordmark, headings, score and timer. Arial/Helvetica supplies interface text. Distance is 72px, timer 47px, camera heading 30px; small uppercase labels use generous tracking. Timer and leaderboard distances use tabular numerals.

## Layout and components
The 84px header holds the wordmark, tagline, connection state and actions. Main content is centered at a maximum 1720px with 3.3% horizontal padding. The upper grid pairs camera and telemetry in a `1fr 1.1fr` split, separated by 25px. At standard desktop widths it is 355px tall. Distance and time lead the telemetry, followed by 24 slanted pace bars and a five-entry leaderboard.

The full-width race panel follows after 24px, with toolbar, 290px canvas and keyboard/action bar. Below it sit the live chat ticker, manual demo controls and footer. Panels use 10px corners; buttons use 6px corners and thin outlines. Orange is reserved for primary actions and race emphasis. Most structure comes from spacing and fine rules rather than stacked cards.

At 1600px and above, the upper grid grows to 420px and the canvas to 360px. Below 850px, secondary header details disappear and spacing tightens. Below 600px, the upper grid stacks, camera height becomes 320px, canvas height becomes 250px, and action/demo rows wrap. The composition remains desktop-first; the canvas uses fixed-position text rather than a separately designed mobile scene.

## Interaction and states
- Keyboard mode is available immediately. Right arrow runs, up jumps, down ducks; Space pauses/resumes. Backtick toggles controls, Escape closes them, and D toggles motion diagnostics.
- Webcam activation shows loading, mirrored video and a mint skeleton with orange landmarks. Calibration asks the runner to stand still or bring feet into view; recalibration pauses an active run. Camera failures return to keyboard mode with an explanatory ticker message.
- Distance, countdown, pace bars and rank update during play. Incoming obstacles add an orange, bold jump/duck warning with sender and arrival time. Shield and sprint badges expose their state in text.
- Start and pause buttons disable when unavailable. Start becomes a rest countdown or “Start next run.” Canvas overlays distinguish ready, paused, and completed/rest states.
- The 410px right-side controls drawer scrolls independently and contains settings, connection log and advanced landmark tools. Demo buttons depend on the Demo mode checkbox. Event feedback appears in the chat-feed status area.

## Accessibility and boundaries
Native buttons, inputs, selects, labels and checkboxes support keyboard operation. Interactive elements have a 3px mint focus outline with 4px offset; icon-only controls have accessible names and decorative SVGs are hidden from assistive technology. The chat feed uses `role="status"`, and the race canvas has a descriptive accessible label. Warnings and state changes include words rather than relying only on color.

Play pauses on window blur, hidden document, or sustained loss of body visibility. Controls avoid intercepting game shortcuts while a form field is active. The drawer focuses its close button when opened, but has no focus trap or focus restoration. Canvas gameplay/results have no equivalent structured screen-reader representation, and there is no reduced-motion mode. These are implementation boundaries, not claims of full accessibility conformance.

The supplied desktop preview records the idle composition; current source corrects its earlier “1 RUNNERS” label to “1 RUNNER.”
