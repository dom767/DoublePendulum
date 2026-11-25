# Implementation progress

## Milestone status

- [ ] **1 — Single pendulum and GPU physics:** implemented; real-browser/GPU acceptance remains outstanding.
- [ ] **2 — Visible grid and periodic colour map:** implemented; real-browser/GPU acceptance remains outstanding.
- [ ] **3 — Pixel field and density transition:** partial: staged grids up to 160×160 and guided camera reveals implemented; pixel-resolution sampling, domain zoom and recording-performance acceptance remain outstanding.
- [ ] **4 — Fixed-duration maps and exploration:** unbuilt.
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

- Confirm the browser/GPU and recording resolution before performance targets for milestone 3.
- Decide whether milestone 4 needs additional metrics after final-angle maps work.
- Growth is an explicitly labelled pedagogical approximation, not a telescoping-rod dynamics model.
- Session settings deliberately do not persist; shareable state/bookmarks arrive in milestone 4.
- No per-display-pixel sampling, fixed-duration map or direct video export yet. A partial guided timeline now covers the single-to-dense-grid transition.
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
