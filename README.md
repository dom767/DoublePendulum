# Double pendulum

A browser experiment about deterministic motion and chaos, progressing from a single arm to ensembles and finite-time maps. Plain HTML, CSS and JavaScript; no development build step.

## Run

Install Node.js 20 or later, double-click `StartServer.cmd`, and open the printed localhost URL. The default is http://127.0.0.1:7100; `PORT` overrides it. Close the server window or press Ctrl+C to stop. Alternatively, `npm start` serves the same source files. Internet access is optional for fonts.

Use a recent desktop Chrome or Edge with WebGPU and hardware acceleration enabled, on localhost or HTTPS. An unavailable GPU produces an explanation; there is no CPU simulation fallback. Phone layouts are supported, but WebGPU support depends on the browser and device. This first milestone is not a measured recording-performance release.

## The experiment

Angles are absolute, measured from the downward vertical, positive toward the right. The primary pivot is fixed. Lengths are metres, masses kilograms, time seconds, angular velocities radians/second. Gravity is 9.81 m/s²; rods are massless, bobs are point masses, friction is zero, and initial angular velocities are zero. Default lengths and masses are equal, with initial angles 110° and 100°.

The live simulator always integrates on WebGPU using float32 RK4 at Δt = 1/480 s. Canvas 2D draws the two GPU states. The independent JavaScript double-precision reference runs only in numerical verification. Simulation time counts integration steps, independently of frame rate. Work is bounded per frame, but pending steps are retained and reported as catching up; hidden tabs suspend playback. Trails are display samples, not a full numerical history.

The default opening grows the second arm from zero to the configured length in eight simulation seconds. At exactly zero, an explicit simple-pendulum equation avoids division by zero. During growth, the fixed-length equations use the instantaneous length with a 5 cm numerical floor. **This is an illustrative changing system, not the dynamics of a physical telescoping rod.** Energy conservation applies only to fixed-length runs. Choose “Fixed lengths” for physical experiments; a second length of zero gives the simple-pendulum branch. Growth is deterministic per integration step.

Settings apply to this tab only and are not persisted. Angles, lengths, masses and opening mode apply with **Apply and restart**. Speed, trails and comparison apply immediately. Home restarts with the currently entered valid parameters. Restore defaults resets all settings; reloading also restores defaults. Reduced-motion users start paused. The nearby trajectory changes only the primary initial angle by +0.0001 rad; sensitivity is not a claim that every trajectory is chaotic.

## Verification

`npm ci` installs development-only type declarations and TypeScript. Run `npm test` and `npm run check`. Tests use Node's built-in runner; its VM-modules flag boots the full UI module graph against a small DOM stub. No third-party browser framework is included.

With the server running, open `/checks/gpu.html` in a WebGPU browser for real shader compilation, 1-second CPU/GPU agreement (maximum state error <0.002 rad or rad/s), exact replay, equilibrium, zero length, growth finiteness, and 120-second energy drift (<0.02 J). The page reports PASS or FAIL. Growth checks can take several seconds because they read back every step. Long-time CPU/GPU trajectories may differ because of chaos and floating-point precision; short-time agreement and energy checks are the useful comparisons.

See [PLAN.md](PLAN.md) for all five milestones and [PROGRESS.md](PROGRESS.md) for evidence and remaining work.
