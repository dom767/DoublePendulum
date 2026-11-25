# Double pendulum

A browser experiment about deterministic motion and chaos, progressing from a single arm to ensembles and finite-time maps. Plain HTML, CSS and JavaScript; no development build step.

## Run

Install Node.js 20 or later, double-click `StartServer.cmd` (or `RunLocal.cmd`), and open the printed localhost URL. The default is http://127.0.0.1:7100; `PORT` overrides it. Close the server window or press Ctrl+C to stop. Alternatively, `npm start` serves the same source files. Internet access is optional for fonts.

Packaged local and production builds use `DeployLocal.cmd` and `DeployProd.cmd` (humans only for prod). See [deploy.md](deploy.md).

Use a recent desktop Chrome or Edge with WebGPU and hardware acceleration enabled, on localhost or HTTPS. An unavailable GPU produces an explanation; there is no CPU simulation fallback. Phone layouts are supported, but WebGPU support depends on the browser and device. This first milestone is not a measured recording-performance release.

## The experiment

Angles are absolute, measured from the downward vertical, positive toward the right. The primary pivot is fixed. Lengths are metres, masses kilograms, time seconds, angular velocities radians/second. Gravity is 9.81 m/s²; rods are massless, bobs are point masses, friction is zero, and initial angular velocities are zero. Default lengths and masses are equal, with initial angles 110° and 100°.

The live simulator always integrates on WebGPU using float32 RK4 at Δt = 1/480 s. Canvas 2D draws the GPU states. The independent JavaScript double-precision reference runs only in numerical verification. Simulation time counts integration steps, independently of frame rate. Work is bounded per frame, but pending steps are retained and reported as catching up; hidden tabs suspend playback. Trails are display samples, not a full numerical history.

The pendulum's pivot stays at the centre of the viewport on desktop and phone. Settings starts hidden; use the bottom **Settings** button to open it. Resizing preserves the panel's open/closed state rather than opening it automatically.

The default opening begins with ten simulation seconds of an exact single-arm pendulum. Its introduction describes a regular, repeating rhythm under the same frictionless conditions. The second arm then grows from zero to the configured length over eight more simulation seconds, completing the opening at t = 18 s. Playback speed affects these simulation-time durations, and pausing freezes them. At exactly zero, an explicit simple-pendulum equation avoids division by zero; only one bob is drawn. During growth, the fixed-length equations use the instantaneous length with a 5 cm numerical floor. **This is an illustrative changing system, not the dynamics of a physical telescoping rod.** Energy conservation applies only to fixed-length runs. Choose “Fixed lengths” to skip the introduction and growth for direct physical experiments; a second length of zero gives the simple-pendulum branch. Growth is deterministic per integration step.

Settings apply to this tab only and are not persisted. Angles, lengths, masses and opening mode apply with **Apply and restart**. Speed, trails and comparison apply immediately. Home restarts with the currently entered valid parameters. Restore defaults resets all settings; reloading also restores defaults. Reduced-motion users start paused. The nearby trajectory changes only the primary initial angle by +0.0001 rad; sensitivity is not a claim that every trajectory is chaotic.

## Pendulum grid — milestone 2

Use **Grid** in the bottom navigation to begin the guided transition described below. Choose **Instant switch** in Settings for the direct single/grid toggle, which restarts time at zero and preserves playback speed and paused state. All grid cells use fixed lengths and the same GPU shader and physical parameters; the growing opening applies only in single mode.

Choose a 2×2, 6×6, 10×10 (default), 16×16, 40×40 or 160×160 grid. Full-domain sampling covers −180° to +180° on each axis. Neighbourhood and nearly-identical presets cover 20° and 0.02° respectively around (110°, 100°). Custom centres and spans are in degrees; ranges crossing ±180° are allowed because the physics and colour mapping are periodic. Presets fill the draft fields; **Apply and restart** applies domain, grid size, masses and lengths together. Samples sit at cell centres, not domain endpoints: initial primary angle increases rightward, and initial secondary angle increases upward. Row 1 is the top. At dense resolutions the small rods give way to the cell colours.

Each cell's background uses its **current** primary and secondary angles through a shared, smooth periodic RGB map. The 2D legend in Settings uses that same mapping across the full angle domain. **Initial angles · reference** changes colours immediately without restarting or freezing the moving pendulums. Colours encode angle pairs, not sensitivity or stability, and the mapping is not a unique decoding of every angle pair.

Tap a cell to inspect its enlarged pendulum, initial conditions, current angles, time and integration count. Alternatively, use the row/column controls and **Inspect selected cell**, or focus the grid and use arrow keys then Enter. The inspection follows the actual GPU cell state while the grid continues running. **Replay in single view** transfers the selected initial angles, uses fixed lengths and restarts at time zero with the same physical parameters. Close/Escape returns to the selection controls. Grid/domain/colour settings are session-only; Restore defaults resets them as well as the single-view preferences, while retaining the current view mode.

## Verification

`npm ci` installs development-only type declarations and TypeScript. Run `npm test` and `npm run check`. Tests use Node's built-in runner; its VM-modules flag boots the full UI module graph against a small DOM stub. No third-party browser framework is included.

With the server running, open `/checks/gpu.html` in a WebGPU browser for real shader compilation, 1-second CPU/GPU agreement (maximum state error <0.002 rad or rad/s), exact replay, equilibrium, zero length, growth finiteness, and 120-second energy drift (<0.02 J). The page reports PASS or FAIL. Growth advances vary length per step on the GPU with a single readback per batch. Long-time CPU/GPU trajectories may differ because of chaos and floating-point precision; short-time agreement and energy checks are the useful comparisons.

The browser checks also run a 6×6 ensemble for 480 steps, compare every cell bit-for-bit against an isolated single-view run, and compare one batch with 173+307 steps. Node tests verify axis sampling, periodic colours, GPU dispatch/readback sizing through a device stub, and the complete UI switch/step/inspect/replay path through a DOM/GPU stub. Stubs do not validate actual GPU execution or browser layout.

## Guided transition — one to 25,600

From the single view, click **Grid**, or use **Play grid story** in Settings. The ten-second introduction and eight-second arm growth finish first if necessary. A 165-second guided sequence follows the original pendulum into four separate experiments. Only the active grid exists and is drawn; there is no larger field peeking into the small-grid chapters.

| Story seconds | Visual |
|---|---|
| 0–4 | Hold on the original pendulum |
| 4–12 | Keep the original visible, fade in three neighbours, reset at 9 s |
| 12–20 | Pull directly out to the final 2×2 framing |
| 25–46 | Run four nearby starts to demonstrate sensitivity to initial conditions |
| 46–54 | Keep the four visible, fade in new cells, reset the 10×10 positions at 51 s |
| 54–64 | Pull directly out to the final 10×10 framing |
| 66–74 | Fade angle colours in over 66–72 s, hold again |
| 74–90 | Run all 100 pendulums together |
| 90–98 | Keep the hundred visible, fade in new cells, reset the 40×40 positions at 95 s |
| 98–108 | Pull directly out to the final 40×40 framing |
| 112–127 | Run all 1,600 pendulums from rest |
| 127–135 | Keep the existing grid visible, fade in new cells, reset the 160×160 positions at 132 s |
| 135–147 | Pull directly out to the final 160×160 framing |
| 151–165 | Run all 25,600 pendulums from rest; the closing field continues evolving |

Chapter headings and captions fade between beats. Camera motion uses quintic easing with zero endpoint velocity/acceleration; the first frame shares the single-view geometry. Every expansion follows the same order: hold existing cells at full opacity and the same camera position, fade in only new rows/columns over four seconds, ease the reset poses over two seconds, then pull straight back to the final framing. Resets never fade the scene away; angles follow the shortest angular path while physics is held. There is no overshoot or follow-up zoom-in. New cells outside the viewport become visible naturally as the camera pulls back.

The original cell carries its current pose and angular velocities into the top-left of the four-pendulum opening. The four reset around the original starting angles: each axis has a 0.02° span, with cell-centre samples 0.01° apart. The run allows the default nearby starts to separate, demonstrating sensitivity without claiming that every trajectory is chaotic.

The 10×10, 40×40 and 160×160 chapters are fresh full-domain samplings, not camera crops of a precomputed 160×160 field. Each includes both −180° and +180° at its axis endpoints: primary angle increases rightward, secondary angle increases upward. Equivalent periodic edge orientations deliberately appear twice. These endpoint-inclusive story grids differ from the cell-centre convention of manually configured grids. Existing poses are retained at the top-left during the reveal, with the same cell size and screen anchor across the boundary. **Every** cell is then reset to its new starting angles and zero angular velocities before the zoom and fresh run. Colour follows the displayed angles through the reset; the 10×10 colour reveal happens while physics is held still.

**Pause** freezes both chapters and physics. The automatic experiment holds pause physics while the camera and captions continue. **Replay** returns to the captured four-cell opening state. **Explore grid** keeps the active grid's size, current state and simulation history; a later manual Apply resamples using the manual cell-centre convention. After the closing chapter, the field continues evolving until paused or exited. Home cancels the story and restarts the single experiment. Physics speed changes simulation speed; chapter pacing remains independent. Story timing pauses in hidden tabs and slows through long browser stalls instead of skipping beats. Rendering uses the latest completed GPU readback independently of new GPU work.

Guided/instant switching is a tab-only preference, applied immediately and restored to Guided by Restore defaults or reload. Guided mode uses the applied single-experiment physics and the nearby/full-domain stages above, rather than draft grid settings. It starts playing on request, except for reduced-motion users, who start paused and receive camera cuts instead of spatial zoom. This expanded sequence is an implemented presentation segment; editing it down to the eventual two-minute production remains part of milestone 5.

For target-hardware verification, `/checks/gpu.html` now also runs 25,600 states for 32 steps and checks dense corners against isolated runs. It reports compute-plus-readback time; that excludes drawing and is not a recording frame-rate benchmark. Actual GPU performance and visual pacing must still be reviewed in the recording browser.

See [PLAN.md](PLAN.md) for all five milestones and [PROGRESS.md](PROGRESS.md) for evidence and remaining work.
