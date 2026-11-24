# Implementation progress

## Milestone status

- [ ] **1 — Single pendulum and GPU physics:** implemented; real-browser/GPU acceptance remains outstanding.
- [ ] **2 — Visible grid and periodic colour map:** implemented; real-browser/GPU acceptance remains outstanding.
- [ ] **3 — Pixel field and density transition:** partial: nested 160×160 field and guided camera reveal implemented; pixel-resolution sampling, domain zoom and recording-performance acceptance remain outstanding.
- [ ] **4 — Fixed-duration maps and exploration:** unbuilt.
- [ ] **5 — Two-minute guided presentation:** partial: 100-second single-to-grid story implemented; full 120-second presentation with maps remains outstanding.

## Milestone 1 implementation

- [x] Plain HTML/CSS/ES modules, no development build step, Node static server and Windows launcher.
- [x] WebGPU-only live physics, float32 RK4, explicit zero-length simple-pendulum branch.
- [x] Eight-second growing-arm opening, documented as a changing-length illustration with a 5 cm regularisation.
- [x] Pause, restart, single-step, speed, trails, initial angles, nearby trajectory and unequal mass/length controls.
- [x] Fixed integration timestep and accumulated pending work; tab visibility suspends playback.
- [x] Desktop floating settings, phone sheet, keyboard focus, fullscreen control and reduced-motion paused start.
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
