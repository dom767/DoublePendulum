// @ts-check
/**
 * Probe the app's local static server port (Run Local / StartServer / Deploy Local).
 * Change DEFAULT_PORT to the app's reserved default from standards/guidelines/ports.md.
 * Agents set PORT.
 */
import net from "node:net";
import { spawn } from "node:child_process";

/** Reserved default for this app (ports.md). Change when copying the template. */
export const DEFAULT_PORT = 7100;

/** @param {number} [port] */
export function resolvePort(port) {
  const n = Number(port ?? process.env.PORT) || DEFAULT_PORT;
  return n;
}

/**
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

/**
 * Identify this app's HTML (keep in sync with index.html <title>, or use another agreed marker).
 * @param {string} html
 */
export function isOurAppHtml(html) {
  return html.includes("<title>Double pendulum</title>");
}

/**
 * @param {number} [port]
 * @returns {Promise<"free" | "ours" | "other">}
 */
export async function localServerStatus(port = resolvePort()) {
  if (!(await canConnect(port))) return "free";
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(2000),
    });
    const html = await res.text();
    return isOurAppHtml(html) ? "ours" : "other";
  } catch {
    return "other";
  }
}

/** @param {string} url */
export function openInBrowser(url) {
  const child = spawn("cmd.exe", ["/c", "start", "", url], {
    detached: true,
    stdio: "ignore",
    windowsVerbatimArguments: true,
  });
  child.unref();
}

