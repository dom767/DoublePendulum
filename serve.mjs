// Minimal static file server for development. No dependencies, no network.
// Usage: node serve.mjs [port] [root]   (default: $PORT, then scripts/local-port.mjs DEFAULT_PORT)

import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { localServerStatus, resolvePort } from "./scripts/local-port.mjs";

const root = resolve(process.argv[3] || fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.argv[2]) || resolvePort();
const host = "127.0.0.1";
const url = `http://${host}:${port}/`;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".wgsl": "text/plain; charset=utf-8",
};

function send(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

const server = createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch {
    return send(res, 400, "Bad request");
  }
  let file = normalize(join(root, path));
  if (file !== root && !file.startsWith(root + sep)) return send(res, 403, "Forbidden");
  // Never serve dotfiles or dot-folders (.git, .env…).
  if (file.slice(root.length).split(sep).some((part) => part.startsWith("."))) return send(res, 404, "Not found");
  let stat;
  try {
    stat = statSync(file);
    if (stat.isDirectory()) {
      file = join(file, "index.html");
      stat = statSync(file);
    }
  } catch {
    return send(res, 404, "Not found");
  }
  res.writeHead(200, {
    "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": "no-store",
  });
  if (req.method === "HEAD") return res.end();
  createReadStream(file).pipe(res);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Close whatever is using it, or set PORT to another port.`);
  } else {
    console.error(err.message);
  }
  process.exit(1);
});

const status = await localServerStatus(port);
if (status === "ours") {
  // Exit 2: StartServer.cmd treats this as "already up" (pause for humans, success for tools).
  console.log(`Already serving this app at ${url}`);
  console.log("Close that server window to stop it.");
  process.exit(2);
}
if (status === "other") {
  console.error(`Port ${port} is already in use by something else. Close that process, or set PORT to another port.`);
  process.exit(1);
}

server.listen(port, host, () => {
  console.log(`Serving ${root} on ${url}`);
  console.log("Close this window or press Ctrl+C to stop.");
});
