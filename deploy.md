# Deploy — double pendulum

Project-specific notes for packaging and hosting. Shared rules live in the AgentController / hub standards (`export.md`, `deploy.md`, `repository-commands.md`).

## App shape

| Item | Value |
|---|---|
| Entry HTML | `index.html` |
| JS entry | `src/main.js` → `app.bundle.min.js` |
| CSS | `css/vendor/tokens.css` + `styles.css` → `app.bundle.min.css` |
| Runtime fetch | none (WGSL shader is inlined in the JS module graph) |
| Asset-version global | `__DOUBLE_PENDULUM_ASSET_VERSION__` |
| External CDN | Google Fonts (kept as `<link>` in production HTML) |
| Consent | Packaged HTML loads `/consent.js?v=0.N.C` first in `<head>` |

No runtime JSON catalog. No ScreenGrabber SDK. No separate data refresh step before export.

## Default hosting

| Parameter | Default |
|---|---|
| S3 bucket | `baffledcat.com` |
| S3 prefix | `pendulum/` |
| Public URL | `https://baffledcat.com/pendulum/index.html` |

Override with `PENDULUM_S3_BUCKET` / `PENDULUM_S3_PREFIX`.

## Repository commands

Both deploys package independently through `packageBuild({ dir, version })` in
`actions/lib/build.mjs`. Install dev dependencies with `npm ci` first (esbuild is a
build-time `devDependency`).

| Action | What it does |
|---|---|
| **Run Local** (`RunLocal.cmd`) | Opens `StartServer.cmd` in its own window, serving the working tree. |
| **Deploy Local** (`DeployLocal.cmd`) | Packages `Export/Local` as `0.0.C`, replaces that local folder, and serves it in its own window. |
| **Deploy Prod** (`DeployProd.cmd`) | Claims N, packages `Export/VersionN` as `0.N.C`, uploads assets first and HTML last, then verifies the live asset-version global. Humans only. |

Both deploys refuse uncommitted changes before packaging or claiming a release.
Production fetches and requires HEAD to be on the upstream branch before claiming.
C is `git rev-list --count HEAD`, captured with the full source hash before the
VERSION claim commit. N is claimed through `scripts/release-version.mjs`, using
the highest existing release folder as a floor. Release folders never overwrite.

Versions are written directly into HTML asset URLs and
`self.__DOUBLE_PENDULUM_ASSET_VERSION__`; bundles contain no release version.
`build.json` records version, N, C, source identity, build time and SHA-256 hashes
of every non-HTML asset. Production compares those hashes with
`Export/Local/build.json` when source commits match. Differences warn per file
without blocking deployment.

```powershell
.\RunLocal.cmd
.\DeployLocal.cmd
# $env:PORT=7100; node actions\DeployLocal.mjs
# .\DeployProd.cmd   # humans / dashboard only
```

`npm run export` runs Deploy Local. `PORT` defaults to 7100, matching
`StartServer.cmd` / `scripts/local-port.mjs`. Stop an existing server before
deploying locally.

## Smoke-test checklist

Open `http://127.0.0.1:7100` (or `PORT`) after Deploy Local:

- [ ] HTML asset URLs and global contain `0.0.C`, matching `build.json`
- [ ] Packaged HTML references `/consent.js?v=0.0.C` (404 on localhost is expected)
- [ ] WebGPU initialises and the pendulum animates (localhost or HTTPS)
- [ ] Apply and restart, pause, step, trails and nearby comparison work
- [ ] Phone-width layout still opens the settings sheet

After a human runs Deploy Prod:

- [ ] Live asset-version global equals the full `0.N.C` version
- [ ] `Export/VersionN/build.json` identifies the intended source commit
- [ ] Hosted URL is HTTPS at `https://baffledcat.com/pendulum/`
