/**
 * The plan for the photo pipeline (scripts/optimize-images.mjs): which photos it works on, which files
 * each one produces, how they are named, and how to tell whether they are up to date. Pure functions with no
 * file access and no sharp, so tests/image-plan.test.ts can check them.
 *
 * Paths here are site paths, for example "/assets/projects/Amherst/amherst-05.jpg".
 */
import { createHash } from "node:crypto";

/** The files that name the photos pages show. A photo nothing names gets no copies. */
export const PHOTO_LISTS = ["_projects", "_data/capabilities.yml"];

/** The folders that hold source photos and their copies. */
export const PHOTO_FOLDERS = ["assets/projects", "assets/craft"];

/** The record of the copies, read by `_includes/photo.html` and committed so a check can tell when they are out of date. */
export const MANIFEST_PATH = "_data/photos.json";

/** Widths a photo is offered in. Nothing is ever enlarged. */
export const VARIANT_WIDTHS = Object.freeze([480, 800, 1200, 1600]);

export const VARIANT_FORMATS = Object.freeze(["avif", "webp"]);

/** Encoder settings. AVIF at 60 is visually the same as the JPEG at about a fifth of its size. */
export const ENCODER_SETTINGS = Object.freeze({
  avif: Object.freeze({ quality: 60, effort: 4 }),
  webp: Object.freeze({ quality: 78, effort: 4 }),
});

/** Bump when the way files are made changes in a way the settings above do not show, so every file is made again. */
const PIPELINE_VERSION = 1;

const JPEG_EXTENSION = /\.jpe?g$/i;
const PHOTO_PATH = /\/assets\/(?:projects|craft)\/[^"\n]+?\.jpe?g/gi;

/**
 * @typedef {{ path: string, width: number, sha256: string }} SourcePhoto
 *   A source photo: its site path, its width in pixels and the SHA-256 of its bytes.
 * @typedef {{ output: string, source: string, width: number, format: string }} PlannedOutput
 *   One file the pipeline makes, and the source photo it is made from.
 * @typedef {{ base: string, width: number, widths: number[], sha256: string }} ManifestPhoto
 * @typedef {{ settings: string, photos: Record<string, ManifestPhoto> }} Manifest
 *   What the copies were made from: a fingerprint of the settings, and what each photo produced.
 */

/**
 * Every photo path named in a text, each once, in the order they appear.
 * @param {string} text
 * @returns {string[]}
 */
export function photosNamedIn(text) {
  return [...new Set(text.match(PHOTO_PATH) ?? [])];
}

/**
 * The standard widths that fit a photo: all up to its own width, never above it. A photo narrower than
 * the smallest standard width is offered only at its own.
 * @param {number} photoWidth
 * @returns {number[]}
 */
export function variantWidthsFor(photoWidth) {
  if (!Number.isInteger(photoWidth) || photoWidth <= 0) {
    throw new Error(`A photo's width must be a whole number of pixels above 0, but it is ${photoWidth}.`);
  }
  const fitting = VARIANT_WIDTHS.filter((width) => width <= photoWidth);
  return fitting.length > 0 ? fitting : [photoWidth];
}

/**
 * A source photo's path without its extension, which its copies add their width and format to.
 * @param {string} sourcePath
 * @returns {string}
 */
export function basePathFor(sourcePath) {
  if (!JPEG_EXTENSION.test(sourcePath)) {
    throw new Error(`The photo ${JSON.stringify(sourcePath)} must be a .jpg or .jpeg photo.`);
  }
  return sourcePath.replace(JPEG_EXTENSION, "");
}

/**
 * Where a copy of a source photo is written: next to it, with the width and format after its name.
 * @param {string} sourcePath
 * @param {number} width
 * @param {string} format
 * @returns {string}
 */
export function variantPathFor(sourcePath, width, format) {
  return `${basePathFor(sourcePath)}-${width}.${format}`;
}

/**
 * Every copy the pipeline makes: an AVIF and a WebP at every width that fits each photo, in a fixed order.
 * @param {readonly SourcePhoto[]} sources
 * @returns {PlannedOutput[]}
 */
export function planOutputs(sources) {
  return [...sources]
    .sort((first, second) => (first.path < second.path ? -1 : 1))
    .flatMap((source) =>
      variantWidthsFor(source.width).flatMap((width) =>
        VARIANT_FORMATS.map((format) => ({ output: variantPathFor(source.path, width, format), source: source.path, width, format })),
      ),
    );
}

/**
 * A fingerprint of everything that decides how a file is made from its photo, so changing any of it makes
 * every file out of date.
 * @returns {string}
 */
export function settingsFingerprint() {
  const description = { version: PIPELINE_VERSION, widths: VARIANT_WIDTHS, formats: VARIANT_FORMATS, encoders: ENCODER_SETTINGS };
  return createHash("sha256").update(JSON.stringify(description)).digest("hex");
}

/**
 * The record that matches these photos and the current settings, with the photos in a fixed order.
 * @param {readonly SourcePhoto[]} sources
 * @returns {Manifest}
 */
export function buildManifest(sources) {
  const ordered = [...sources].sort((first, second) => (first.path < second.path ? -1 : 1));
  const photos = Object.fromEntries(
    ordered.map((source) => [source.path, { base: basePathFor(source.path), width: source.width, widths: variantWidthsFor(source.width), sha256: source.sha256 }]),
  );
  return { settings: settingsFingerprint(), photos };
}

/**
 * Sorts the files on disk against the plan: planned files that are missing, planned files whose photo or
 * settings changed since they were made, and generated files nothing asks for any more.
 * @param {{ planned: readonly PlannedOutput[], current: readonly SourcePhoto[], recorded: Manifest | null, existing: readonly string[] }} state
 * @returns {{ missing: string[], stale: string[], orphaned: string[] }}
 */
export function compareWithDisk({ planned, current, recorded, existing }) {
  const present = new Set(existing);
  const wanted = new Set(planned.map((entry) => entry.output));
  const hashes = new Map(current.map((source) => [source.path, source.sha256]));
  const isMadeFromCurrent = (/** @type {PlannedOutput} */ entry) =>
    recorded !== null && recorded.settings === settingsFingerprint() && recorded.photos[entry.source]?.sha256 === hashes.get(entry.source);
  return {
    missing: planned.filter((entry) => !present.has(entry.output)).map((entry) => entry.output),
    stale: planned.filter((entry) => present.has(entry.output) && !isMadeFromCurrent(entry)).map((entry) => entry.output),
    orphaned: existing.filter((file) => !wanted.has(file)),
  };
}
