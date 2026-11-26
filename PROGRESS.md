# Implementation progress

## Milestone status

- [ ] **1 — Single pendulum and GPU physics:** implemented; real-browser/GPU acceptance remains outstanding.
- [ ] **2 — Visible grid and periodic colour map:** implemented; real-browser/GPU acceptance remains outstanding.
- [ ] **3 — Pixel field and density transition:** implemented (full-canvas one-sim-per-CSS-pixel live field + 1000-step map with domain pan/zoom); real-browser/GPU and recording-performance acceptance remain outstanding.
- [ ] **4 — Fixed-duration maps and exploration:** implemented (cancellable tiled progressive runner, configurable N and Δt with T = N·Δt, final-angle / first-flip / nearby-divergence GPU metrics, distinctly marked coarse/tile/pan previews, reset view & zoom controls, curated & browser-saved bookmarks, shareable URL hash, and click-to-replay point probe); real-browser/GPU and visual acceptance remain outstanding.
- [ ] **5 — Two-minute guided presentation:** partial: revised 165-second staged story implemented; full 120-second edit with maps remains outstanding.

## Milestone 1 implementation

- [x] Plain HTML/CSS/ES modules, no development build step, Node static server and Windows launcher.
- [x] WebGPU-only live physics, float32 RK4, explicit zero-length simple-pendulum branch.
- [x] Ten-second single-arm introduction, then eight-second growing-arm opening, documented as a changing-length illustration with a 5 cm regularisation.
- [x] Pause, restart, single-step, speed, trails, initial angles, nearby trajectory and unequal mass/length controls.
- [x] Fixed integration timestep and accumulated pending work; tab visibility suspends playback.
- [x] Centred pendulum pivot, initially hidden desktop/phone settings, keyboard focus, fullscreen control and reduced-motion paused start.
- [x] Independent double-precision reference; equilibrium, symmetry, reproducibility, zero-length, 120 s energy and timestep-refinement tests.
- [x] Browser verification page covering real GPU compilation, agreement, replay, equilibrium, zero length, energy and growth.
- [ ] Actual WebGPU numerical/browser tests and visual checks at 360px, 768px, landscape and portrait.
- [ ] Measured GPU recording performance and refinement on target hardware.

## Verification record — 2026-11-24

`npm test`: all 7 tests pass. `npm run check`: passes. All source JavaScript passes `node --check`; `git diff --check` passes. Static server smoke checks return 200 for the app, main module, GPU backend and GPU check page; dotfile requests return 404. The full UI module graph is booted against a lightweight HTML-seeded DOM stub, including unsupported-WebGPU feedback and restart binding. CPU energy tolerance is <0.0001 J absolute drift over 120 seconds at Δt=1/480 s.

Launching Chrome for automated browser verification was blocked by the execution policy. No real browser/GPU pass or visual inspection is claimed. Open `/checks/gpu.html` using the local server for the remaining numerical acceptance; it checks a <0.002 short-time state tolerance and <0.02 J GPU energy drift. The preview server uses claimed port 7101 for this run and is stopped before handoff; the launcher defaults to 7100.

## Outstanding choices and limits

- Confirm measured full-canvas live/map performance on the recording machine (Field uses the actual CSS canvas size).
- Decide whether milestone 4 needs additional metrics after final-angle maps work.
- Growth is an explicitly labelled pedagogical approximation, not a telescoping-rod dynamics model.
- Session settings deliberately do not persist; browser-scoped user bookmarks (`localStorage`) and shareable URL hash links are implemented in milestone 4.
- Direct video export is still out of scope. Guided timeline covers the single-to-dense-grid transition; Field covers per-pixel live and N=1000 map modes.
- Deployment scripts (Run Local / Deploy Local / Deploy Prod) package to `Export/` and target `https://baffledcat.com/pendulum/`; first production upload is still a human Deploy Prod step. Packaged HTML loads `/consent.js`; a Cookie settings footer link is not in the UI yet. Packaging smoke: `packageBuild` + `npm test` (8 pass) + served `Export/Local` on 7101 with versioned bundles.

## Milestone 1 opening revision — 2026-11-25

- [x] Pivot fixed at viewport centre for desktop and phone; story camera shares that geometry.
- [x] Settings hidden in initial HTML and at startup, with toggle access and open-state preservation on resize.
- [x] First ten simulation seconds use an exactly zero second-arm length on the GPU, render one bob, and explain predictable single-pendulum rhythms.
- [x] Second arm then grows for eight seconds; captions/title change with the opening stage. Fixed-length mode remains a direct skip.
- [x] A queued grid story waits until the introduction and growth finish. GPU browser verification includes the ten-second single-arm run before growth.
- [x] Automated coverage for opening boundaries, GPU parameters, centred geometry and hidden desktop/phone settings.
- [ ] Actual browser visual/GPU acceptance remains outstanding.

Opening-revision verification: all 26 Node tests pass, including packaging and UI flow; `npm run check`, source syntax checks and `git diff --check` pass. No development server or deployment was started for this revision.

## Milestone 2 implementation

- [x] Single/grid mode switch, with fixed lengths for the grid and shared physical settings.
- [x] GPU backend resizes state/readback buffers for ensembles and dispatches every cell through the same integration count. No CPU simulation fallback.
- [x] 6×6, 10×10 and 16×16 visible pendulum grids with current-angle cell colours.
- [x] Immutable initial-condition sampling at cell centres; primary angle increases rightward, secondary upward.
- [x] Full-domain, 20° neighbourhood and 0.02° nearly-identical presets; custom centres/spans.
- [x] Shared periodic two-angle colour function and 2D full-domain legend; optional initial-colour reference without restarting physics.
- [x] Pointer, row/column and keyboard cell selection; enlarged live inspection with initial/current angles and time/step counts.
- [x] Replay selected initial conditions in single mode at fixed lengths with the same physical settings.
- [x] Documented session-only settings, apply/restart behaviour and defaults.
- [x] Node tests for sampling, colour wrapping, hit testing, GPU dispatch/buffer lifecycle and complete grid/step/inspect/replay UI flow using stubs.
- [x] Browser acceptance page extended to compare every cell of a 6×6 GPU ensemble against isolated runs and check frame-grouping independence.
- [ ] Run actual browser/GPU acceptance at `/checks/gpu.html` and inspect desktop/portrait/360px layouts. Previous Chrome automation launch was policy-blocked; no hardware execution or visual pass is claimed for this build.

Milestone 2 verification: `npm test` passes all 15 tests, including packaging; `npm run check`, source syntax checks and `git diff --check` pass. Local HTTP smoke checks return 200 for the app, new ensemble/grid/colour/domain modules and GPU check page on claimed port 7101. The preview server is stopped before handoff. The test command now uses directory discovery because Node 20 does not expand the previous quoted glob. Milestone 3 remains unbuilt. No production deployment performed.

## Milestone 3 implementation — 2026-11-25

- [x] Full-canvas pixel field: one simulation per CSS pixel (width×height from the view on Apply / resample).
- [x] Live animation mode with GPU in-place integration, GPU colourize, never-dropped steps, catching-up status.
- [x] Map mode: exactly N = 1000 steps per pixel, progress lozenge, T = NΔt shown when complete.
- [x] Angle-domain wheel zoom (cursor-centred) and drag pan; both resample and recompute (no bitmap magnify). Pan rebuilds on pointer release.
- [x] Status reports true simulation resolution vs canvas size; Field run and domain controls are session-only with Restore defaults.
- [x] Rectangular ensembles, raised GPU buffer limits, colour compute shader; unsupported WebGPU still surfaces a clear error.
- [x] Node tests for sampling, pan/zoom, map runner, GPU colour path and UI field/map/zoom flow; browser check extended with a 64×48 map + colourize timing.
- [ ] Actual WebGPU full-canvas performance and visual acceptance on the recording browser.

Verification: `npm test` and `npm run check` pass after the field work; source syntax and `git diff --check` pass. No production deployment. Open Field in a WebGPU browser and `/checks/gpu.html` for hardware acceptance.

## Milestone 4 implementation — 2026-11-26

- [x] Cancellable tiled progressive `MapRunner` (`src/maps/runner.js`) with optional coarse ¼-scale preview pass followed by row-aligned tiles; stale generations are discarded before and after every async GPU call and cannot overwrite newer views.
- [x] Configurable map step count `N` (10–100,000, default 1000) and timestep `Δt` (`1/480 s`, `1/960 s`, `1/1920 s`) with physical duration `T = N·Δt` shown in Settings, the canvas HUD, the progress lozenge, and the status bar.
- [x] Defined GPU-only map metrics (`src/maps/metrics.js`, `src/compute/flip-shader.js`, `src/compute/colour-shader.js`):
  - **Final angles (θ₁, θ₂):** existing periodic 2D RGB torus map + 2D legend.
  - **First flip time:** first step at which either arm crosses the upward vertical (`±π mod 2π`); dark slate marks non-flipping candidate regular regions, with labelled 1D key.
  - **Nearby divergence (δθ):** integrates a `+0.0001 rad` twin trajectory on the GPU and maps wrapped angular separation on a log scale, with labelled 1D key.
- [x] Distinctly marked previews: amber `PREVIEW` badge and dashed viewport border during coarse preview, partial tiling, and drag-panning preview; clears only once 100% of full-resolution pixels have received all `N` steps.
- [x] Pan (with live visual preview offset, resampling on release), cursor-centred wheel zoom, Zoom in / Zoom out / Reset view controls, and click-to-probe starting angles with **Replay point in single view**.
- [x] Curated bookmarks/candidate regions (including low-energy basin, flip boundary, high-angle filaments, fine-scale divergence, and `½× Δt, 2× T` refinement check) plus browser-scoped user bookmarks (`localStorage` key `double-pendulum:bookmarks:v1`, graceful in-memory fallback) and shareable URL hash state (`src/maps/state.js`).
- [x] Automated Node tests (`test/map.test.js`, `test/ui-restart.test.js`) verifying tile-order independence, zoom-history independence, stale job cancellation, all-N-step delivery, candidate regular region refinement at `Δt = 1/960 s` and `N = 4000`, GPU metric pipeline/uniform dispatch via stub, shareable hash validation, bookmark persistence/fallback, and full UI flow.
- [x] Extended `/checks/gpu.html` (`checks/gpu-browser.js`) to verify real-GPU tile-order match, `first-flip` and `sensitivity` shader compilation/execution, and a `1/960 s` low-energy candidate regular check.
- [ ] Actual WebGPU hardware execution at `/checks/gpu.html` and interactive visual/layout review in a WebGPU browser (desktop and 360px phone).

Verification: all 42 Node tests pass (`npm test`, using directory discovery so Windows and POSIX run identically); `npm run check`, JS syntax checks, packaging (`packageBuild`), and `git diff --check` pass. No production deployment performed.

## Guided single-to-grid story

### Continuous expansion revision — 2026-11-25

- [x] Existing cells keep full opacity, poses and camera geometry across expansion boundaries; only new rows/columns fade in.
- [x] Reset poses ease visibly over two seconds along the shortest angular path; no whole-scene fade or blank frame.
- [x] Four-second new-cell reveal, then reset, then one direct eased pullback to the final framing. Removed wide framing and reverse zoom.
- [x] Resets at 9/51/95/132 s; pullbacks at 12–20/54–64/98–108/135–147 s. Runs still begin at 25/74/112/151 s; total story remains 165 s.
- [x] Colour field opacity and reset colours follow the same retained/new-cell rules as rods. FPS harness reflects retained poses and reset interpolation.
- [x] Regression checks cover boundary geometry, opacity, monotonic camera scale, shortest-path resets and retained GPU poses/velocities.
- [ ] Actual browser smoothness/visual acceptance remains outstanding.

Verification: all 28 Node tests pass, including packaging and staged GPU/UI orchestration with stubs; TypeScript, source syntax and whitespace checks pass. No server or deployment was started for this revision. Browser visual review remains pending.

The previous flows below are historical and superseded by the continuous expansion revision above.

### Revised flow — 2026-11-25

- [x] Only the active bounded ensemble exists: 4 → 100 → 1,600 → 25,600 GPU states. Renderer and colour image use that size, without out-of-stage neighbours.
- [x] 2×2 reveal, physics hold, closer framing, zero-velocity reset to four nearby starts (0.01° neighbour spacing), then a 20-second run.
- [x] 10×10 reveal/hold/closer framing; reset at 64 s to endpoint-inclusive −180°…+180° on both axes; colour reveal at 66–72 s; run at 74 s.
- [x] 40×40 and 160×160 repeat the reveal/hold/closer-frame/reset/run sequence, resetting at 108/147 s and running at 112/151 s.
- [x] 165-second pacing, sensitivity captions and full-domain axis explanations. No promise of chaos for all initial conditions.
- [x] Replay restores the four-cell opening; manual exploration retains the active stage's size and history.
- [x] Tests cover bounded stage counts, fresh resets, endpoint sampling, held colour reveal, resumed GPU work and replay/exit. FPS harness follows the new stage sizes/resets.
- [ ] Actual browser visual/pacing review and GPU acceptance for the revised flow.

Verification: 22 Node tests pass, including packaging, bounded rendering and the full staged UI flow; TypeScript, syntax and whitespace checks pass. Local HTTP smoke checks return 200 for the app, revised story modules and FPS harness on claimed port 7101; the preview server is stopped before handoff. Default reference physics separates the four nearby starts during the 20-second run. No browser/GPU visual pass or deployment is claimed.

### Previous flow (superseded)

- [x] Default Grid action starts a paced 100-second guided transition; instant switch remains a session setting.
- [x] Continuous eased camera: single → 2×2 → 10×10 → 40×40 → 160×160, with reading holds.
- [x] Preserve the original cell's current state, angular velocities and starting angles at top-left; share source geometry for the first frame.
- [x] Nested 160×160 field at 2.25° initial-angle spacing; no resampling or hidden-cell restarts during camera moves.
- [x] Fade through the reset at 36 s, reveal initial-angle colours over 38–44 s, restart every cell together at 48 s.
- [x] Fading chapter headings/captions, pause, captured-state replay, manual exploration and Home cancellation.
- [x] GPU workgroups of 64 and 25,600-state buffers; screen-space culling and gradual rod fade at dense scales.
- [x] Camera animation uses cached completed GPU states independently of asynchronous readback. Hidden-tab playback pauses; long stalls slow chapter time rather than skipping beats.
- [x] Reduced-motion camera cuts and paused start. Documented setting scope/default/reset and the nested-domain convention.
- [x] Timeline continuity/reset/colour tests, dense buffer-dispatch checks and full story pause/reset/restart/replay/exit UI test with stubs.
- [x] Browser acceptance page adds dense GPU corner checks and a clearly scoped compute/readback timing.
- [ ] Actual WebGPU execution, smoothness and visual review at landscape/portrait recording sizes. Browser launch was previously policy-blocked; no new hardware/visual pass is claimed.

Verification: all 19 Node tests pass, including source packaging; TypeScript and syntax checks pass. Use Grid from the single view to watch the sequence, and `/checks/gpu.html` to run hardware acceptance. Milestones 3 and 5 remain partial, not complete. No deployment performed.
