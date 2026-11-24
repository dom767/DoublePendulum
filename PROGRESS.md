# Implementation progress

## Milestone status

- [ ] **1 — Single pendulum and GPU physics:** implemented; real-browser/GPU acceptance remains outstanding.
- [ ] **2 — Visible grid and periodic colour map:** unbuilt.
- [ ] **3 — Pixel field and density transition:** unbuilt.
- [ ] **4 — Fixed-duration maps and exploration:** unbuilt.
- [ ] **5 — Two-minute guided presentation:** unbuilt.

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
- No grid, pixel field, map, video timeline or direct video export yet.
- Deployment scripts (Run Local / Deploy Local / Deploy Prod) package to `Export/` and target `https://baffledcat.com/pendulum/`; first production upload is still a human Deploy Prod step. Packaged HTML loads `/consent.js`; a Cookie settings footer link is not in the UI yet. Packaging smoke: `packageBuild` + `npm test` (8 pass) + served `Export/Local` on 7101 with versioned bundles.
