#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryName = process.argv[2];
const outputRoot = path.resolve("dist/client");
const textExtensions = new Set([".css", ".html", ".js"]);

if (!repositoryName || !/^[A-Za-z0-9._-]+$/.test(repositoryName)) {
  throw new Error("Pass a valid GitHub repository name.");
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else if (textExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

const files = await collectFiles(outputRoot);
const changedFiles = [];
let replacements = 0;

for (const file of files) {
  const source = await readFile(file, "utf8");
  const patched = source
    .replace(/(["'`])\/assets\//g, (_match, quote) => {
      replacements += 1;
      return `${quote}/${repositoryName}/assets/`;
    })
    .replace(/url\((["']?)\/assets\//g, (_match, quote) => {
      replacements += 1;
      return `url(${quote}/${repositoryName}/assets/`;
    });

  if (patched !== source) {
    await writeFile(file, patched);
    changedFiles.push(file);
  }
}

if (replacements === 0) {
  throw new Error("No root-relative runtime asset paths were found to patch.");
}

const renamedAssets = new Map();

for (const file of changedFiles) {
  const extension = path.extname(file);
  if (extension !== ".css" && extension !== ".js") continue;

  const content = await readFile(file);
  const digest = createHash("sha256").update(content).digest("hex").slice(0, 10);
  const originalName = path.basename(file);
  const nextName = `${path.basename(file, extension)}.pages-${digest}${extension}`;
  const nextPath = path.join(path.dirname(file), nextName);

  await rename(file, nextPath);
  renamedAssets.set(originalName, nextName);
}

if (renamedAssets.size > 0) {
  for (const file of await collectFiles(outputRoot)) {
    const source = await readFile(file, "utf8");
    let patched = source;

    for (const [originalName, nextName] of renamedAssets) {
      patched = patched.replaceAll(originalName, nextName);
    }

    if (patched !== source) await writeFile(file, patched);
  }
}

console.log(
  `Patched ${replacements} GitHub Pages asset path${
    replacements === 1 ? "" : "s"
  } and refreshed ${renamedAssets.size} bundle filename${
    renamedAssets.size === 1 ? "" : "s"
  }.`,
);
