import { describe, expect, it } from "vitest";
import {
  VARIANT_FORMATS,
  VARIANT_WIDTHS,
  basePathFor,
  buildManifest,
  compareWithDisk,
  photosNamedIn,
  planOutputs,
  settingsFingerprint,
  variantPathFor,
  variantWidthsFor,
} from "../scripts/image-plan.mjs";

const PHOTO = "/assets/projects/Amherst/amherst-05.jpg";
const SOURCE = { path: PHOTO, width: 1600, sha256: "abc" };

describe("photosNamedIn", () => {
  it("finds each photo once, quoted or not, and keeps spaces and capitals", () => {
    // Arrange
    const text = [
      "images:",
      "  - /assets/projects/Amherst/amherst-05.jpg",
      "  - /assets/projects/golf-links/Condor Golf Links18 _ Photo by Intelier1.jpg",
      '  - "/assets/craft/edgebanding.jpg"',
      "  - /assets/projects/sonate/DSC00734.JPG",
      "  - /assets/projects/Poppy_16/poppy16-18.jpeg",
      "  - /assets/projects/Amherst/amherst-05.jpg",
    ].join("\n");

    // Act
    const photos = photosNamedIn(text);

    // Assert
    expect(photos).toEqual([
      "/assets/projects/Amherst/amherst-05.jpg",
      "/assets/projects/golf-links/Condor Golf Links18 _ Photo by Intelier1.jpg",
      "/assets/craft/edgebanding.jpg",
      "/assets/projects/sonate/DSC00734.JPG",
      "/assets/projects/Poppy_16/poppy16-18.jpeg",
    ]);
  });

  it("finds nothing in a text with no photos", () => {
    expect(photosNamedIn("title: Amherst Ct")).toEqual([]);
  });
});

describe("variantWidthsFor", () => {
  it.each([
    [1600, [480, 800, 1200, 1600]],
    [2400, [480, 800, 1200, 1600]],
    [1200, [480, 800, 1200]],
    [1000, [480, 800]],
    [480, [480]],
  ])("offers a %d px photo at %j", (width, expected) => {
    expect(variantWidthsFor(width)).toEqual(expected);
  });

  it("offers a photo narrower than every standard width at its own width, so nothing is enlarged", () => {
    expect(variantWidthsFor(300)).toEqual([300]);
  });

  it.each([0, -1, 1.5, Number.NaN])("refuses a width of %d", (width) => {
    expect(() => variantWidthsFor(width)).toThrow(/whole number/);
  });
});

describe("the names of the copies", () => {
  it("puts the width and format after the photo's name, next to it", () => {
    expect(variantPathFor(PHOTO, 800, "avif")).toBe("/assets/projects/Amherst/amherst-05-800.avif");
  });

  it.each([
    ["/a/b.jpg", "/a/b"],
    ["/a/b.jpeg", "/a/b"],
    ["/a/b.JPG", "/a/b"],
  ])("drops the extension of %s", (source, base) => {
    expect(basePathFor(source)).toBe(base);
  });

  it("refuses anything that is not a JPEG", () => {
    expect(() => basePathFor("/a/b.png")).toThrow(/must be a \.jpg or \.jpeg photo/);
  });
});

describe("planOutputs", () => {
  it("plans every format at every width that fits", () => {
    // Act
    const planned = planOutputs([SOURCE]);

    // Assert
    expect(planned).toHaveLength(VARIANT_WIDTHS.length * VARIANT_FORMATS.length);
    expect(planned[0]).toEqual({ output: "/assets/projects/Amherst/amherst-05-480.avif", source: PHOTO, width: 480, format: "avif" });
  });

  it("gives the same plan whatever order the photos come in", () => {
    // Arrange
    const other = { path: "/assets/craft/edgebanding.jpg", width: 480, sha256: "def" };

    // Act / Assert
    expect(planOutputs([SOURCE, other])).toEqual(planOutputs([other, SOURCE]));
  });
});

describe("buildManifest", () => {
  it("records what each photo produced, for the page templates", () => {
    expect(buildManifest([SOURCE])).toEqual({
      settings: settingsFingerprint(),
      photos: { [PHOTO]: { base: "/assets/projects/Amherst/amherst-05", width: 1600, widths: [480, 800, 1200, 1600], sha256: "abc" } },
    });
  });
});

describe("compareWithDisk", () => {
  const planned = planOutputs([SOURCE]);
  const allFiles = planned.map((entry) => entry.output);
  const recorded = buildManifest([SOURCE]);

  it("finds nothing wrong when everything is there and matches", () => {
    expect(compareWithDisk({ planned, current: [SOURCE], recorded, existing: allFiles })).toEqual({ missing: [], stale: [], orphaned: [] });
  });

  it("reports a planned file that is not there", () => {
    expect(compareWithDisk({ planned, current: [SOURCE], recorded, existing: allFiles.slice(1) }).missing).toEqual([allFiles[0]]);
  });

  it("reports every copy of a photo whose bytes changed", () => {
    // Act
    const { stale } = compareWithDisk({ planned, current: [{ ...SOURCE, sha256: "changed" }], recorded, existing: allFiles });

    // Assert
    expect(stale).toEqual(allFiles);
  });

  it("reports everything as out of date when the settings changed", () => {
    // Act
    const { stale } = compareWithDisk({ planned, current: [SOURCE], recorded: { ...recorded, settings: "old" }, existing: allFiles });

    // Assert
    expect(stale).toEqual(allFiles);
  });

  it("reports everything as out of date with no record at all", () => {
    expect(compareWithDisk({ planned, current: [SOURCE], recorded: null, existing: allFiles }).stale).toEqual(allFiles);
  });

  it("reports a copy nothing asks for any more", () => {
    // Arrange
    const leftOver = "/assets/projects/Amherst/old-480.avif";

    // Act / Assert
    expect(compareWithDisk({ planned, current: [SOURCE], recorded, existing: [...allFiles, leftOver] }).orphaned).toEqual([leftOver]);
  });
});
