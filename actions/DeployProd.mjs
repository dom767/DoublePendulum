#!/usr/bin/env node
// @ts-check
/**
 * Deploy Prod — claim N on GitHub, package a fresh build into Export/VersionN stamped 0.N.C,
 * upload it (assets first, HTML last) and verify the live asset version equals 0.N.C.
 * Humans only (dashboard confirms). Agents must never run this.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  compareToLocal,
  describe,
  exportRoot,
  highestRelease,
  packageBuild,
  prepareDir,
  requireClean,
  root,
  writeManifest,
} from "./lib/build.mjs";
import {
  assertHeadOnUpstream,
  claimVersion,
  commitCount,
  formatVersion,
  sourceOf,
} from "../scripts/release-version.mjs";

const ASSET_VERSION_GLOBAL = "__DOUBLE_PENDULUM_ASSET_VERSION__";
const bucket = process.env.PENDULUM_S3_BUCKET ?? "baffledcat.com";
let prefix = process.env.PENDULUM_S3_PREFIX ?? "pendulum/";
if (!prefix.endsWith("/")) prefix += "/";

/**
 * @param {string} command
 * @param {string[]} args
 */
function run(command, args) {
  console.log([command, ...args].join(" "));
  const r = spawnSync(command, args, {
    stdio: "inherit",
    cwd: root,
    env: process.env,
  });
  if (r.error) {
    console.error(r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
  return r;
}

/** @returns {string} */
function awsBin() {
  return process.platform === "win32" ? "aws.cmd" : "aws";
}

/** @returns {boolean} */
function awsIdentityOk() {
  const r = spawnSync(awsBin(), ["sts", "get-caller-identity"], {
    stdio: "ignore",
    cwd: root,
    shell: false,
    env: process.env,
  });
  return r.status === 0;
}

function ensureAwsAuth() {
  if (awsIdentityOk()) return;
  console.log("AWS credentials not found. Running aws login…");
  run(awsBin(), ["login"]);
  if (!awsIdentityOk()) {
    console.error("AWS authentication still failed after aws login.");
    process.exit(1);
  }
}

/**
 * @param {string} publicUrl
 * @param {string} expectedVersion
 */
async function verifyRemoteVersion(publicUrl, expectedVersion) {
  const needle = `self.${ASSET_VERSION_GLOBAL} = "${expectedVersion}"`;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(`${publicUrl}?verify=${Date.now()}`, { cache: "no-store" });
      const html = await res.text();
      if (res.ok && html.includes(needle)) return;
      const seen = new RegExp(`${ASSET_VERSION_GLOBAL}\\s*=\\s*"([^"]*)"`).exec(html)?.[1] ?? "none";
      console.log(
        `Live asset version is ${seen} (HTTP ${res.status}), want ${expectedVersion}; checking again in 15s (${attempt}/6).`,
      );
    } catch (err) {
      console.log(
        `Couldn't fetch ${publicUrl}: ${err instanceof Error ? err.message : err} (${attempt}/6).`,
      );
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
  throw new Error(
    `Remote index.html does not contain expected version stamp: ${needle}. Check the prefix, or purge Cloudflare for index.html.`,
  );
}

try {
  const source = sourceOf(root);
  requireClean(source);
  assertHeadOnUpstream(root);
  const c = commitCount(root);
  const n = claimVersion(root, { floor: highestRelease() });
  const version = formatVersion(n, c);
  console.log(`Deploy Prod: ${describe(version, source)}`);
  const dir = prepareDir(path.join(exportRoot, `Version${n}`));
  await packageBuild({ dir, version });
  const manifest = writeManifest(dir, { version, n, c, source });
  compareToLocal(manifest);
  const s3Base = `s3://${bucket}/${prefix}`;

  console.log(`\nPackaged ${version} into ${path.relative(root, dir).split(path.sep).join("/")}`);
  ensureAwsAuth();
  console.log(`\nUploading to ${s3Base}`);

  run(awsBin(), [
    "s3",
    "sync",
    dir,
    s3Base,
    "--delete",
    "--exclude",
    "index.html",
    "--exclude",
    "*.json.gz",
    "--cache-control",
    "public, max-age=31536000, immutable",
  ]);

  run(awsBin(), [
    "s3",
    "sync",
    dir,
    s3Base,
    "--exclude",
    "*",
    "--include",
    "*.json.gz",
    "--content-type",
    "application/gzip",
    "--cache-control",
    "public, max-age=31536000, immutable",
  ]);

  run(awsBin(), [
    "s3",
    "cp",
    path.join(dir, "index.html"),
    `${s3Base}index.html`,
    "--cache-control",
    "public, max-age=60",
    "--content-type",
    "text/html; charset=utf-8",
  ]);

  const publicUrl = bucket.includes(".")
    ? `https://${bucket}/${prefix}index.html`
    : `https://${bucket}.s3.amazonaws.com/${prefix}index.html`;

  console.log(`Verifying remote version at ${publicUrl}`);
  await verifyRemoteVersion(publicUrl, version);
  console.log(`\nUpload complete. Version ${version} verified.`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
