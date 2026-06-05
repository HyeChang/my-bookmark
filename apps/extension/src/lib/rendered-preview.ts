import type { BookmarkExtractPreview, BookmarkExtractPreviewBlock } from "@bookmark/shared";

const TEXT_BLOCK_SELECTOR = "h1, h2, h3, h4, h5, h6, p, li, img";
const SPA_FALLBACK_PATTERNS = [
  "You need to enable JavaScript to run this app.",
  "Please enable JavaScript to continue using this application."
];

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripSpaFallbackText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return normalizeWhitespace(
    SPA_FALLBACK_PATTERNS.reduce(
      (currentValue, pattern) => currentValue.replaceAll(pattern, " "),
      value
    )
  );
}

function resolveUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value.trim();
  }
}

function getNormalizedUrl(url: string) {
  return resolveUrl(url, url);
}

function getMetaTextContent(doc: Document, selector: string) {
  const value = doc.querySelector<HTMLMetaElement>(selector)?.content ?? "";
  return stripSpaFallbackText(value) || null;
}

function getMetaUrlContent(doc: Document, selector: string, baseUrl: string) {
  const value = doc.querySelector<HTMLMetaElement>(selector)?.content ?? "";
  const normalizedValue = stripSpaFallbackText(value);
  return normalizedValue ? resolveUrl(normalizedValue, baseUrl) : null;
}

function getPreviewRoot(doc: Document) {
  return doc.querySelector("article") ?? doc.querySelector("main") ?? doc.body;
}

function getImageBlock(
  element: HTMLImageElement,
  baseUrl: string
): BookmarkExtractPreviewBlock | null {
  const source = element.getAttribute("src") || element.currentSrc || "";
  if (!source.trim()) {
    return null;
  }

  return {
    type: "image",
    url: resolveUrl(source, baseUrl),
    alt: stripSpaFallbackText(element.alt) || null
  };
}

function getTextBlock(element: Element): BookmarkExtractPreviewBlock | null {
  const text = stripSpaFallbackText(element.textContent);
  if (!text) {
    return null;
  }

  if (element.tagName === "LI") {
    return {
      type: "list-item",
      text
    };
  }

  if (/^H[1-6]$/.test(element.tagName)) {
    return {
      type: "heading",
      text
    };
  }

  return {
    type: "paragraph",
    text
  };
}

function collectBlocks(root: Element, baseUrl: string) {
  return Array.from(root.querySelectorAll(TEXT_BLOCK_SELECTOR)).flatMap((element) => {
    if (element instanceof HTMLImageElement) {
      const block = getImageBlock(element, baseUrl);
      return block ? [block] : [];
    }

    const block = getTextBlock(element);
    return block ? [block] : [];
  });
}

export function extractRenderedPreviewFromDocument(
  doc: Document,
  url: string
): BookmarkExtractPreview {
  const normalizedUrl = getNormalizedUrl(url);
  const root = getPreviewRoot(doc);
  const sourceBlocks = root ? collectBlocks(root, normalizedUrl) : [];
  const textBlocks = sourceBlocks.filter(
    (
      block
    ): block is Exclude<BookmarkExtractPreviewBlock, { type: "image" }> => block.type !== "image"
  );
  const firstImageBlock = sourceBlocks.find(
    (block): block is Extract<BookmarkExtractPreviewBlock, { type: "image" }> => block.type === "image"
  );

  return {
    url: normalizedUrl,
    normalizedUrl,
    sourceTitle: stripSpaFallbackText(doc.title) || null,
    sourceSummary:
      getMetaTextContent(doc, 'meta[name="description"]') ??
      getMetaTextContent(doc, 'meta[property="og:description"]'),
    sourceContent:
      textBlocks.length > 0
        ? textBlocks.map((block) => block.text).join("\n\n")
        : null,
    sourceImageUrl:
      getMetaUrlContent(doc, 'meta[property="og:image"]', normalizedUrl) ??
      firstImageBlock?.url ??
      null,
    sourceBlocks,
    renderStatus: "ready",
    renderSource: "extension"
  };
}
