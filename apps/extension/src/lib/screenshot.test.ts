import { describe, expect, it } from "vitest";

import { buildScreenshotFilename, dataUrlToFile } from "./screenshot";

describe("extension screenshot helpers", () => {
  it("creates a stable screenshot filename from the page title", () => {
    expect(buildScreenshotFilename("  Google AI Search  ")).toBe("bookmark-google-ai-search.png");
    expect(buildScreenshotFilename("")).toBe("bookmark-capture.png");
  });

  it("converts a data url into a File for upload", async () => {
    const file = await dataUrlToFile("data:image/png;base64,QUJDRA==", "capture.png");

    expect(file.name).toBe("capture.png");
    expect(file.type).toBe("image/png");
    expect(file.size).toBeGreaterThan(0);
  });
});
