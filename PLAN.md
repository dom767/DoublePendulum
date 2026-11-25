# Approved implementation plan

## Decisions carried into Build

- Start with a double pendulum whose second arm has zero length; gradually extend it to the first arm's length by default.
- Always run live simulation on WebGPU, from the first single-view experiment through pixel fields. No CPU/GPU transition or CPU fallback. A CPU reference is permitted for verification only.
- Fixed-duration maps use configurable N, default 1000, and show Δt and T = NΔt.
- Create a guided browser presentation for screen recording, with both landscape and portrait framing. Direct video export is outside the initial scope.
- Frictionless, equal-length, equal-mass defaults; allow unequal lengths and masses in settings.
- Final-angle colouring comes first. Sensitivity/first-flip metrics are possible later additions, requiring explicit definitions.

Milestones 1 and 2 are implemented; outstanding browser acceptance is tracked in PROGRESS.md. Later milestones remain separate phases. The user's WebGPU decision supersedes the earlier CPU-first/fallback proposal.

Follow-up build, revised flow: a 165-second guided story preserves the original at the top-left of only four pendulums, pauses and frames them closer, resets them to nearly identical angles, then runs to demonstrate sensitivity. Separate bounded 10×10, 40×40 and 160×160 stages each reveal, pause, frame closer, reset across −180° to +180° on both axes, and run again. Angle colours fade in after the 10×10 reset. This supersedes the earlier continuously nested 100-second reveal. It brings forward parts of milestones 3 and 5 without completing pixel-resolution sampling, maps or the eventual two-minute edit. Pacing and controls are documented in README.md.

## 1. Physics and single-pendulum view

Create README, roadmap, progress tracker, HTML/CSS/ES-module shell, WebGPU compute backend and RK4 shader, independent numerical reference, canvas single view and controls. Provide pause, restart, single step, speed, initial angles, trails, nearby comparison, and configurable lengths/masses. Use seconds, metres, kilograms and angles from downward vertical. Keep fixed-step simulation independent of display cadence.

Opening: animate the second arm from zero to the target length. Label the changing-length approximation and its singular-length regularisation; do not use its energy changes to validate conservative physics.

Acceptance: reproducible restarts; equilibrium, symmetry, and zero-length checks; bounded energy error over 120 seconds at fixed lengths; short-time timestep convergence; actual shader compilation and short-time GPU/reference comparison. No unsupported claims about universal chaos.

## 2. Visible grid and angle colour map

Add ensemble orchestration, grid rendering, shared periodic angle-to-colour mapping and 2D legend, angle-domain controls, full-domain/neighbourhood/nearly-identical presets, and selected-cell inspection. Horizontal axis samples initial primary angle; vertical axis samples initial secondary angle. Cells retain initial conditions while colours encode current angles. Optional initial-colour comparison.

Acceptance: selected cells match the single view; sampling and axis orientation are correct; colour wrapping introduces no artificial discontinuity; every cell gets the same steps. Extend the existing GPU backend throughout.

## 3. Pendulum grid to one simulation per pixel

Add pixel-field rendering, viewport/resolution management, GPU ensemble buffers and shaders. Distinguish display density (smaller drawn pendulums) from angle-domain zoom (new initial-condition sampling). Show actual simulation resolution if the field is scaled. Transition continuously to colours, with pause/reset/resolution/performance controls.

Acceptance: short-time GPU/reference agreement; no dropped integration steps to meet frame rate; measured performance at recording resolution; clear unsupported-WebGPU handling. Long-time floating-point divergence alone is not a defect.

## 4. Fixed-duration maps and candidate regular regions

Add cancellable progressive map runner, stability-map view, defined metrics, presets, and map controls. Each pixel starts from its sampled initial angles and receives exactly N steps at Δt. Show N, Δt and physical T. Zoom must resample and recompute, not magnify a bitmap. Start with final-angle colouring; separately label any later sensitivity or first-flip metric.

Add pan, cursor-centred zoom, reset view, bookmarks, shareable state, and distinctly marked previews. Acceptance: tile order and zoom history do not affect results; stale jobs cannot overwrite new views; completed pixels receive all requested steps. Check candidate regions at smaller Δt and longer durations. Call them finite-time patterns or candidate regular regions until stronger evidence supports stability claims.

## 5. Two-minute guided presentation

Add timeline, scenes, captions, presentation controls and `docs/video-script.md`. Deterministic parameters, camera moves, captions and replay. Support landscape and portrait screen recording.

| Seconds | Scene | Teaching purpose |
|---|---|---|
| 0–20 | Zero second arm grows into double pendulum | Simple rules, richer motion |
| 20–40 | Nearby initial conditions | Sensitivity |
| 40–65 | Visible grid | Organise experiments by starting angles |
| 65–90 | Dense pixel field | Collective structure through colour |
| 90–115 | Fixed-duration map and zoom | Structure across scales and observation times |
| 115–120 | Closing frame | Determinism, prediction, numerical limits |

Acceptance: 120 seconds, consistent replay, readable captions in both formats, narration matches measured quantities, measured capture performance, documented recording instructions.

## Build order and evidence

Complete milestones sequentially. Validate GPU physics before scaling to ensembles, and maps before definitive narration. Read relevant repository/controller guidelines before UI, settings, dependencies, tests, servers, images or publishing work. Use assigned claimed ports for previews. Update PROGRESS at each milestone with actual evidence and outstanding checks. Never equate creating files with passing acceptance checks.
