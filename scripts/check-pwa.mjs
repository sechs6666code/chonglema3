#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const outputRoot = path.resolve(process.argv[2] ?? "dist/client");
const expectedBase = process.argv[3] ?? "/";

async function exists(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

function pngDimensions(buffer) {
  assert.equal(buffer.toString("ascii", 1, 4), "PNG", "Expected a PNG file");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function collectJavaScript(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJavaScript(entryPath)));
    } else if (entry.name.endsWith(".js")) {
      files.push(entryPath);
    }
  }
  return files;
}

const indexPath = path.join(outputRoot, "index.html");
const manifestPath = path.join(outputRoot, "manifest.webmanifest");
const workerPath = path.join(outputRoot, "pwa-sw.js");

for (const file of [indexPath, manifestPath, workerPath]) {
  assert.equal(await exists(file), true, `Missing PWA output: ${file}`);
}

const index = await readFile(indexPath, "utf8");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const worker = await readFile(workerPath, "utf8");

assert.match(index, /rel="manifest"/);
assert.match(index, /apple-mobile-web-app-capable/);
assert.match(index, /apple-touch-icon/);
assert.ok(
  index.includes(`${expectedBase}manifest.webmanifest`),
  `Manifest does not use expected base path ${expectedBase}`,
);

assert.equal(manifest.name, "冲了吗");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
assert.equal(manifest.orientation, "portrait");
assert.equal(manifest.theme_color, "#1b292a");

const requiredIcons = new Map([
  ["icons/apple-touch-icon.png", [180, 180]],
  ["icons/pwa-192.png", [192, 192]],
  ["icons/pwa-512.png", [512, 512]],
  ["icons/pwa-maskable-512.png", [512, 512]],
]);

for (const [relativePath, [expectedWidth, expectedHeight]] of requiredIcons) {
  const iconPath = path.join(outputRoot, relativePath);
  assert.equal(await exists(iconPath), true, `Missing PWA icon: ${relativePath}`);
  const dimensions = pngDimensions(await readFile(iconPath));
  assert.deepEqual(
    [dimensions.width, dimensions.height],
    [expectedWidth, expectedHeight],
    `Unexpected dimensions for ${relativePath}`,
  );
}

assert.match(worker, /SKIP_WAITING/);
assert.match(worker, /stone-shell-/);

const bundles = await collectJavaScript(path.join(outputRoot, "assets"));
const bundleSource = (
  await Promise.all(bundles.map((file) => readFile(file, "utf8")))
).join("\n");
assert.match(bundleSource, /pwa-sw\.js/);
assert.match(bundleSource, /stone-pwa-install/);

console.log(
  `PWA validation passed for ${manifest.name} at base ${expectedBase}.`,
);
