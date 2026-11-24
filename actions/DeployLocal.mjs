#!/usr/bin/env node
// @ts-check
/**
 * Deploy Local — package a fresh build into Export/Local stamped 0.0.C, serve it on this machine
 * in its own window, and return. Never claims a release number. See guidelines/export.md.
 *
 * packageBuild in actions/lib/build.mjs must be filled in by the app.
 */
import path from "node:path";
import {
  describe,
  exportRoot,
  openWindow,
  packageBuild,
  prepareDir,
  requireClean,
  root,
  writeManifest,
} from "./lib/build.mjs";
import { commitCount, formatVersion, sourceOf } from "../scripts/release-version.mjs";
import { localServerStatus, resolvePort } from "../scripts/local-port.mjs";

// Same default as StartServer.cmd / scripts/local-port.mjs; agents supply their assigned PORT.
const port = resolvePort();
const url = `http://127.0.0.1:${port}/`;

try {
  const source = sourceOf(root);
  requireClean(source);
  const c = commitCount(root);
  const version = formatVersion(0, c);
  console.log(`Deploy Local: ${describe(version, source)}`);

  const status = await localServerStatus(port);
  if (status !== "free") {
    const why =
      status === "ours"
        ? `this app's server is already running at ${url}`
        : `port ${port} is in use by something else`;
    throw new Error(`${why}. Close that window first (Run Local and Deploy Local share the port).`);
  }

  const dir = prepareDir(path.join(exportRoot, "Local"), { replace: true });
  await packageBuild({ dir, version });
  writeManifest(dir, { version, n: 0, c, source });

  openWindow(`Local ${version} on port ${port}`, `node serve.mjs ${port} "${dir}"`);
  console.log(`Serving ${dir} on ${url} in a new window. Close it to stop.`);
} catch (err) {
  console.error(`Deploy Local failed: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
}
