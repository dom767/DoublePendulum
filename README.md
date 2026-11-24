# Double pendulum

A browser experiment about deterministic motion and chaos, progressing from a single arm to ensembles and finite-time maps. Plain HTML, CSS and JavaScript; no development build step.

## Run

Install Node.js 20 or later, double-click `StartServer.cmd` (or `RunLocal.cmd`), and open the printed localhost URL. The default is http://127.0.0.1:7100; `PORT` overrides it. Close the server window or press Ctrl+C to stop. Alternatively, `npm start` serves the same source files. Internet access is optional for fonts.

Packaged local and production builds use `DeployLocal.cmd` and `DeployProd.cmd` (humans only for prod). See [deploy.md](deploy.md).

Use a recent desktop Chrome or Edge with WebGPU and hardware acceleration enabled, on localhost or HTTPS. An unavailable GPU produces an explanation; there is no CPU simulation fallback. Phone layouts are supported, but WebGPU support depends on the browser and device. This first milestone is not a measured recording-performance release.

## The experiment

Angles are absolute, measured from the downward vertical, positive toward the right. The primary pivot is fixed. Lengths are metres, masses kilograms, time seconds, angular velocities radians/second. Gravity is 9.81 m/s²; rods are massless, bobs are point masses, friction is zero, and initial angular velocities are zero. Default lengths and masses are equal, with initial angles 110° and 100°.

The live simulator always integrates on WebGPU using float32 RK4 at Δt = 1/480 s. Canvas 2D draws the GPU states. The independent JavaScript double-precision reference runs only in numerical verification. Simulation time counts integration steps, independently of frame rate. Work is bounded per frame, but pending steps are retained and reported as catching up; hidden tabs suspend playback. Trails are display samples, not a full numerical history.

The default opening grows the second arm from zero to the configured length in eight simulation seconds. At exactly zero, an explicit simple-pendulum equation avoids division by zero. During growth, the fixed-length equations use the instantaneous length with a 5 cm numerical floor. **This is an illustrative changing system, not the dynamics of a physical telescoping rod.** Energy conservation applies only to fixed-length runs. Choose “Fixed lengths” for physical experiments; a second length of zero gives the simple-pendulum branch. Growth is deterministic per integration step.

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

From the single view, click **Grid**, or use **Play grid story** in Settings. The opening arm finishes growing first if necessary. A 100-second guided sequence then follows the currently running primary pendulum into the top-left of a nested field:

| Story seconds | Visual |
|---|---|
| 0–5 | Hold on the original experiment |
| 5–13 | Ease the camera back to 2×2 |
| 13–17 | Hold on four pendulums |
| 17–29 | Pull back to 10×10 |
| 29–34 | Hold on a hundred experiments |
| 34–38 | Fade the moving poses out, reset every cell, fade starting poses back in |
| 38–44 | Slowly fade in the angle colours, with all pendulums stationary |
| 44–48 | Read the initial-colour field |
| 48–60 | Restart all simulations together and watch colours evolve |
| 60–72 | Ease back to 40×40 |
| 72–77 | Hold on 1,600 experiments |
| 77–92 | Ease back to 160×160 |
| 92–100 | Closing chapter, with the field continuing to evolve |

Chapter headings and captions fade between beats. Camera motion uses quintic easing with zero endpoint velocity/acceleration; the first frame shares the single-view geometry. The same top-left pendulum remains present as the view widens. Neighbouring initial angles differ by 2.25°; the complete 160×160 field covers one 360° period on each axis, anchored to the original initial angles. The original cell carries its current pose and angular velocities into the opening shot, while new experiments begin at rest. The visible reset synchronises **every** cell at its initial angles with zero velocities before the colour reveal. After that reset, hidden and visible cells always advance together. Zooming changes the camera, never the initial samples or integration history.

**Pause** freezes both chapters and physics. **Replay** returns to the captured opening state, and **Explore grid** keeps the current field and simulation history for manual inspection. After the closing chapter, the field continues evolving until paused or exited. Home cancels the story and restarts the single experiment. Physics speed changes simulation speed; chapter pacing remains independent. Story timing pauses in hidden tabs and slows through long browser stalls instead of skipping beats. GPU steps are retained while catching up; rendering the camera uses the latest completed GPU readback independently of new GPU work.

Guided/instant switching is a tab-only preference, applied immediately and restored to Guided by Restore defaults or reload. Guided mode uses the applied single-experiment physics and its own anchored domain, rather than draft grid settings. It starts playing on request, except for reduced-motion users, who start paused and receive camera cuts instead of spatial zoom. This sequence is an implemented part of the eventual presentation, not the full two-minute milestone 5 production.

For target-hardware verification, `/checks/gpu.html` now also runs 25,600 states for 32 steps and checks dense corners against isolated runs. It reports compute-plus-readback time; that excludes drawing and is not a recording frame-rate benchmark. Actual GPU performance and visual pacing must still be reviewed in the recording browser.

See [PLAN.md](PLAN.md) for all five milestones and [PROGRESS.md](PROGRESS.md) for evidence and remaining work.
