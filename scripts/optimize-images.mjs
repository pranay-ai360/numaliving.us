#!/usr/bin/env node
/**
 * Makes the fast copies of the photos the pages show, with sharp. Run it after adding or changing a photo,
 * and commit what it writes: GitHub's Jekyll build cannot run it.
 *
 *   npm run images:build                        # make what is missing or out of date
 *   node scripts/optimize-images.mjs --check    # change nothing; exit 1 if anything is missing, out of date or left over
 *   node scripts/optimize-images.mjs --force    # make every file again
 *
 * It finds the photos named in `_projects/` and `_data/capabilities.yml`, and from each writes, next to it, an
 * AVIF and a WebP at 480, 800, 1200 and 1600 px wide (never wider than the photo) without any metadata. The
 * sources are never touched. `_data/photos.json` records what was made, for `_includes/photo.html` to read
 * and for the check. What is planned and how files are named: scripts/image-plan.mjs.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  ENCODER_SETTINGS,
  MANIFEST_PATH,
  PHOTO_FOLDERS,
  PHOTO_LISTS,
  buildManifest,
  compareWithDisk,
  photosNamedIn,
  planOutputs,
} from "./image-plan.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FAILURE_EXIT_CODE = 1;
const USAGE_ERROR_EXIT_CODE = 2;
const GENERATED_EXTENSIONS = new Set([".avif", ".webp"]);
/** EXIF orientations 5 to 8 turn the picture by a quarter, so its displayed width is the stored height. */
const FIRST_QUARTER_TURN_ORIENTATION = 5;
const FIX_COMMAND = "npm run images:build";

/** @typedef {import("./image-plan.mjs").SourcePhoto} SourcePhoto */
/** @typedef {import("./image-plan.mjs").PlannedOutput} PlannedOutput */
/** @typedef {import("./image-plan.mjs").Manifest} Manifest */

/** A site path as a path on disk. @param {string} sitePath */
function onDisk(sitePath) {
  return path.join(REPO_ROOT, sitePath);
}

/** @param {unknown} error */
function isMissingFile(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** The files below a folder, as paths relative to the repo with "/", in a fixed order. @param {string} relativeDir @returns {Promise<string[]>} */
async function listFiles(relativeDir) {
  const entries = await readdir(path.join(REPO_ROOT, relativeDir), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => (entry.isDirectory() ? listFiles(`${relativeDir}/${entry.name}`) : [`${relativeDir}/${entry.name}`])),
  );
  return nested.flat().sort();
}

/** Every photo the pages name. @returns {Promise<string[]>} */
async function findSourcePaths() {
  const files = (await Promise.all(PHOTO_LISTS.map(async (list) => (list.endsWith(".yml") ? [list] : listFiles(list))))).flat();
  const texts = await Promise.all(files.map((file) => readFile(path.join(REPO_ROOT, file), "utf8")));
  return [...new Set(texts.flatMap(photosNamedIn))];
}

/** @param {string} sitePath @param {typeof import("sharp").default} sharp @returns {Promise<SourcePhoto>} */
async function readSource(sitePath, sharp) {
  const bytes = await readFile(onDisk(sitePath));
  const { width, height, orientation } = await sharp(bytes).metadata();
  if (width === undefined || height === undefined) throw new Error(`${sitePath} is not a readable image: it has no size.`);
  const isTurned = orientation !== undefined && orientation >= FIRST_QUARTER_TURN_ORIENTATION;
  return { path: sitePath, width: isTurned ? height : width, sha256: createHash("sha256").update(bytes).digest("hex") };
}

/** The copies on disk, as site paths. @returns {Promise<string[]>} */
async function listGenerated() {
  const files = (await Promise.all(PHOTO_FOLDERS.map(listFiles))).flat();
  return files.filter((file) => GENERATED_EXTENSIONS.has(path.extname(file))).map((file) => `/${file}`);
}

/** The committed record, or null when there is none yet. @returns {Promise<Manifest | null>} */
async function readManifest() {
  try {
    return JSON.parse(await readFile(path.join(REPO_ROOT, MANIFEST_PATH), "utf8"));
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

/** Writes one copy. It goes through a temporary name, so a stopped run never leaves half a file. @param {PlannedOutput} entry @param {typeof import("sharp").default} sharp */
async function writeCopy(entry, sharp) {
  const target = onDisk(entry.output);
  const temporary = `${target}.tmp`;
  const settings = ENCODER_SETTINGS[/** @type {"avif" | "webp"} */ (entry.format)];
  const image = sharp(await readFile(onDisk(entry.source))).rotate().resize({ width: entry.width, withoutEnlargement: true });
  await mkdir(path.dirname(target), { recursive: true });
  await (entry.format === "avif" ? image.avif(settings) : image.webp(settings)).toFile(temporary);
  await rename(temporary, target);
}

/** Without the sources' sizes, which only sharp can read, the check uses the widths the record holds. @param {string[]} sourcePaths @param {Manifest | null} recorded @returns {Promise<SourcePhoto[]>} */
async function sourcesFromRecord(sourcePaths, recorded) {
  return Promise.all(
    sourcePaths.map(async (sitePath) => {
      const bytes = await readFile(onDisk(sitePath));
      return { path: sitePath, width: recorded?.photos[sitePath]?.width ?? 1, sha256: createHash("sha256").update(bytes).digest("hex") };
    }),
  );
}

/** Reports what is wrong. Needs no sharp, so CI can run it quickly. */
async function check() {
  const recorded = await readManifest();
  const sourcePaths = await findSourcePaths();
  const current = await sourcesFromRecord(sourcePaths, recorded);
  const unrecorded = sourcePaths.filter((sitePath) => recorded?.photos[sitePath] === undefined);
  const { missing, stale, orphaned } = compareWithDisk({ planned: planOutputs(current), current, recorded, existing: await listGenerated() });
  const problems = [
    ...unrecorded.map((file) => `no copies recorded for ${file}`),
    ...missing.map((file) => `missing: ${file}`),
    ...stale.map((file) => `out of date: ${file}`),
    ...orphaned.map((file) => `left over: ${file}`),
  ];
  if (problems.length > 0) {
    console.error(`check-images: ${problems.length} problems. Run ${FIX_COMMAND} and commit the result.\n  ${problems.slice(0, 20).join("\n  ")}`);
    process.exit(FAILURE_EXIT_CODE);
  }
  console.log(`check-images: the copies of ${sourcePaths.length} photos are up to date.`);
}

/** Makes what is missing or out of date, removes what nothing asks for, and writes the record. @param {boolean} isForced */
async function build(isForced) {
  const { default: sharp } = await import("sharp");
  const recorded = await readManifest();
  const sources = await Promise.all((await findSourcePaths()).map((sitePath) => readSource(sitePath, sharp)));
  const planned = planOutputs(sources);
  const { missing, stale, orphaned } = compareWithDisk({ planned, current: sources, recorded, existing: await listGenerated() });
  const toMake = new Set(isForced ? planned.map((entry) => entry.output) : [...missing, ...stale]);
  const queue = planned.filter((entry) => toMake.has(entry.output));

  // One at a time: sharp already uses every core for one AVIF, and a photo set this size takes minutes either way.
  let done = 0;
  for (const entry of queue) {
    await writeCopy(entry, sharp);
    done += 1;
    if (done % 40 === 0) console.log(`optimize-images: ${done} of ${queue.length}`);
  }
  await Promise.all(orphaned.map((file) => rm(onDisk(file))));
  await writeFile(path.join(REPO_ROOT, MANIFEST_PATH), `${JSON.stringify(buildManifest(sources), null, 2)}\n`);
  console.log(`optimize-images: ${sources.length} photos, ${queue.length} copies made, ${orphaned.length} removed.`);
}

function readMode() {
  try {
    const { values } = parseArgs({ options: { check: { type: "boolean", default: false }, force: { type: "boolean", default: false } }, strict: true });
    return values;
  } catch (error) {
    console.error(`optimize-images: ${error instanceof Error ? error.message : String(error)}`);
    return process.exit(USAGE_ERROR_EXIT_CODE);
  }
}

const mode = readMode();
if (mode.check) await check();
else await build(mode.force);
