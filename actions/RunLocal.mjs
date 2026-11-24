#!/usr/bin/env node
// @ts-check
/**
 * Run Local — serve the working tree (mainline source, no packaging) on this machine.
 * Opens StartServer.cmd in its own window and returns, so the dashboard isn't left waiting;
 * closing that window stops the server (see guidelines/repository-commands.md).
 * Agents use StartServer.cmd directly with their assigned PORT instead of this action.
 *
 * If this app is already serving on the port, report that and open the URL instead of
 * starting a second server.
 */
import fs from "node:fs";
import path from "node:path";
import { openWindow, root } from "./lib/build.mjs";
import { localServerStatus, openInBrowser, resolvePort } from "../scripts/local-port.mjs";

const port = resolvePort();
const url = `http://127.0.0.1:${port}/`;

if (!fs.existsSync(path.join(root, "StartServer.cmd"))) {
  console.error("Run Local: no StartServer.cmd at the repo root (see guidelines/start-scripts.md).");
  process.exit(1);
}

const status = await localServerStatus(port);
if (status === "ours") {
  console.log(`Run Local: this app is already running at ${url}`);
  console.log("Close that server window to stop it, or use the browser tab that just opened.");
  openInBrowser(url);
  process.exit(0);
}
if (status === "other") {
  console.error(
    `Run Local: port ${port} is in use by something else. Close that process, or set PORT to a free port.`,
  );
  process.exit(1);
}

openWindow(`${path.basename(root)} local server`, ".\\StartServer.cmd");
console.log(`Run Local: started StartServer.cmd in a new window (${root}).`);
console.log(`Serving on ${url} — close that window to stop it.`);
