import type { BookmarkExtractPreviewBlock } from "@bookmark/shared";

import { normalizeBookmarkUrl } from "../repositories/bookmarks";

export type BookmarkExtractPreviewRecord = {
  url: string;
  normalizedUrl: string;
  sourceTitle: string | null;
  sourceContent: string | null;
  sourceSummary: string | null;
  sourceImageUrl?: string | null;
  sourceBlocks?: BookmarkExtractPreviewBlock[];
  renderStatus?: "ready" | "js_required";
  renderSource?: "worker" | "extension";
  renderReason?: "spa_fallback" | "thin_content" | "missing_article";
};

export type BookmarkExtractor = {
  extract(url: string): Promise<BookmarkExtractPreviewRecord>;
};

const SPA_FALLBACK_PATTERNS = [
  /you need to enable javascript to run this app\.?/gi,
  /please enable javascript(?: to continue)?\.?/gi,
  /javascript is required(?: to run this app)?\.?/gi,
  /this app works best with javascript enabled\.?/gi
];

function readAttribute(tag: string, attribute: string) {
  const match = tag.match(new RegExp(`${attribute}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match?.[1]?.trim() ?? null;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
    .trim();
}

function extractMetaContent(html: string, keys: string[]) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const metaTag of metaTags) {
    const property = readAttribute(metaTag, "property")?.toLowerCase();
    const name = readAttribute(metaTag, "name")?.toLowerCase();
    if (!keys.includes(property ?? "") && !keys.includes(name ?? "")) {
      continue;
    }

    const content = readAttribute(metaTag, "content");
    if (content) {
      return decodeHtmlEntities(content);
    }
  }

  return null;
}

function extractLinkHref(html: string, relValues: string[]) {
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];

  for (const linkTag of linkTags) {
    const rel = readAttribute(linkTag, "rel")?.toLowerCase();
    if (!rel || !relValues.some((relValue) => rel.split(/\s+/).includes(relValue))) {
      continue;
    }

    const href = readAttribute(linkTag, "href");
    if (href) {
      return decodeHtmlEntities(href);
    }
  }

  return null;
}

function extractTagContent(html: string, tagName: string) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"));
  return match?.[1] ? decodeHtmlEntities(match[1].replace(/\s+/g, " ").trim()) : null;
}

function extractPrimaryHtml(html: string) {
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch?.[1]) {
    return articleMatch[1];
  }

  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch?.[1]) {
    return mainMatch[1];
  }

  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch?.[1] ?? html;
}

function resolveExtractedUrl(baseUrl: string, value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function readImageSource(tag: string) {
  const src =
    readAttribute(tag, "src") ??
    readAttribute(tag, "data-src") ??
    readAttribute(tag, "data-original-src") ??
    readAttribute(tag, "data-origin-src");
  if (src) {
    return src;
  }

  const srcset = readAttribute(tag, "srcset") ?? readAttribute(tag, "data-srcset");
  return srcset?.split(",")[0]?.trim().split(/\s+/)[0] ?? null;
}

function removeExtractionNoise(value: string) {
  return value
    .replace(/페이지뷰"?\s*>\s*/g, "")
    .replace(/\.[a-z][\w-]+"?\s*>\s*/gi, "")
    .replace(/작가명\s*클릭"?\s*>\s*/g, " ")
    .replace(/(?:북마크|스크랩|생각정리)?\s*본문 하단\s*>\s*키워드 클릭"?\s*>\s*/g, " ")
    .replace(/keyword\s+본문 하단[\s\S]*$/i, "")
    .replace(/하단 고정 영역\s*>\s*매거진 다른글 클릭"?\s*>[\s\S]*$/g, "")
    .replace(/매거진의\s*(?:이전글|다음글)[\s\S]*$/g, "")
    .replace(/\s*>\s*/g, " ");
}

function hasTrailingExtractionNoise(value: string) {
  return (
    /keyword\s+본문 하단/i.test(value) ||
    /하단 고정 영역\s*>/i.test(value) ||
    /매거진의\s*(?:이전글|다음글)/i.test(value)
  );
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n")
    )
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function stripSpaFallbackText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const cleanedValue = SPA_FALLBACK_PATTERNS.reduce((currentValue, pattern) => {
    pattern.lastIndex = 0;
    return currentValue.replace(pattern, " ");
  }, value);

  return toNullableText(normalizeExtractedText(cleanedValue));
}

function containsSpaFallbackText(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return SPA_FALLBACK_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

function stripHtml(html: string) {
  const blockStrippedHtml = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const decodedHtml = decodeHtmlEntities(blockStrippedHtml);

  const strippedHtml = decodeHtmlEntities(
    decodedHtml
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<\/li>/gi, "\n")
      .replace(
        /<\/?(?:address|article|aside|blockquote|dd|details|div|dl|dt|figcaption|figure|footer|form|h[1-6]|header|hr|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi,
        "\n\n"
      )
      .replace(/<[^>]+>/g, " ")
      .replace(/\b[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*')/gi, " ")
      .replace(/\s\.[a-z][\w-]+(?=\s|$)/gi, " ")
      .trim()
  );

  return normalizeExtractedText(removeExtractionNoise(strippedHtml));
}

function preparePrimaryHtmlForExtraction(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
  );
}

function extractPreviewBlocks(
  html: string,
  baseUrl: string
): BookmarkExtractPreviewBlock[] {
  const preparedHtml = preparePrimaryHtmlForExtraction(html);
  const tokens = preparedHtml.match(/<[^>]+>|[^<]+/g) ?? [];
  const blocks: BookmarkExtractPreviewBlock[] = [];
  let pendingText = "";
  let pendingType: "heading" | "paragraph" | "list-item" = "paragraph";
  let shouldStop = false;

  function appendText(value: string) {
    const text = removeExtractionNoise(value);
    if (!text.trim()) {
      return;
    }

    pendingText = pendingText ? `${pendingText} ${text}` : text;
  }

  function flushText() {
    const text = normalizeExtractedText(pendingText);
    pendingText = "";
    if (!text) {
      return;
    }

    blocks.push({ type: pendingType, text });
  }

  for (const token of tokens) {
    if (shouldStop) {
      break;
    }

    if (!token.startsWith("<")) {
      if (hasTrailingExtractionNoise(token)) {
        appendText(token);
        flushText();
        shouldStop = true;
      } else {
        appendText(token);
      }
      continue;
    }

    const tagName = token.match(/^<\/?\s*([a-z0-9-]+)/i)?.[1]?.toLowerCase();
    if (!tagName) {
      continue;
    }

    if (/^<\s*img\b/i.test(token)) {
      flushText();
      const imageUrl = resolveExtractedUrl(baseUrl, readImageSource(token));
      if (imageUrl) {
        const alt = toNullableText(stripHtml(readAttribute(token, "alt") ?? "")) ?? null;
        if (!blocks.some((block) => block.type === "image" && block.url === imageUrl)) {
          blocks.push({ type: "image", url: imageUrl, alt });
        }
      }
      continue;
    }

    if (/^<\s*br\b/i.test(token)) {
      pendingText = pendingText ? `${pendingText}\n` : pendingText;
      continue;
    }

    if (/^<\s*\//.test(token)) {
      if (
        /^(address|article|aside|blockquote|dd|div|figcaption|figure|footer|h[1-6]|header|li|main|nav|p|section|td|th)$/.test(
          tagName
        )
      ) {
        flushText();
        pendingType = "paragraph";
      }
      continue;
    }

    if (/^h[1-6]$/.test(tagName)) {
      flushText();
      pendingType = "heading";
      continue;
    }

    if (tagName === "li") {
      flushText();
      pendingType = "list-item";
      continue;
    }

    if (
      /^(address|article|aside|blockquote|dd|details|div|figcaption|figure|footer|header|main|nav|ol|p|section|table|tbody|td|tfoot|th|thead|tr|ul)$/.test(
        tagName
      )
    ) {
      flushText();
      pendingType = "paragraph";
    }
  }

  flushText();
  return blocks.filter((block) => block.type === "image" || block.text.length > 0);
}

function truncateText(value: string | null, maxLength: number) {
  if (!value) {
    return null;
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}...`;
}

function toNullableText(value: string) {
  return value.trim().length > 0 ? value : null;
}

export function extractBookmarkPreviewFromHtml(
  url: string,
  html: string
): BookmarkExtractPreviewRecord {
  const normalizedUrl = normalizeBookmarkUrl(url);
  const sourceTitle =
    extractMetaContent(html, ["og:title", "twitter:title"]) ??
    extractTagContent(html, "title");
  const metaDescription = extractMetaContent(html, [
    "description",
    "og:description",
    "twitter:description"
  ]);
  const sourceImageUrl = resolveExtractedUrl(
    normalizedUrl,
    extractMetaContent(html, ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]) ??
      extractLinkHref(html, ["image_src"])
  );
  const primaryHtml = extractPrimaryHtml(html);
  const rawSourceContent = toNullableText(stripHtml(primaryHtml));
  const sourceContent = stripSpaFallbackText(rawSourceContent);
  const sourceSummary = truncateText(stripSpaFallbackText(metaDescription ?? sourceContent), 280);
  const sourceBlocks = extractPreviewBlocks(primaryHtml, normalizedUrl).flatMap((block) => {
    if (block.type === "image") {
      return [block];
    }

    const cleanedText = stripSpaFallbackText(block.text);
    return cleanedText ? [{ ...block, text: cleanedText }] : [];
  });
  const hasSpaFallback = [
    html,
    rawSourceContent,
    metaDescription,
    ...sourceBlocks
      .filter((block): block is Extract<BookmarkExtractPreviewBlock, { text: string }> => "text" in block)
      .map((block) => block.text)
  ].some((value) => containsSpaFallbackText(value));
  const hasMeaningfulText = Boolean(sourceContent) || sourceBlocks.some((block) => block.type !== "image");
  const renderStatus: BookmarkExtractPreviewRecord["renderStatus"] =
    hasSpaFallback || !hasMeaningfulText ? "js_required" : "ready";
  const renderReason: BookmarkExtractPreviewRecord["renderReason"] =
    hasSpaFallback ? "spa_fallback" : !hasMeaningfulText ? "thin_content" : undefined;

  return {
    url,
    normalizedUrl,
    sourceTitle,
    sourceContent,
    sourceSummary,
    sourceImageUrl,
    sourceBlocks,
    renderStatus,
    renderSource: "worker",
    renderReason
  };
}

export function createBookmarkExtractor(
  fetchImplementation: typeof fetch = globalThis.fetch
): BookmarkExtractor {
  return {
    async extract(url) {
      const normalizedUrl = normalizeBookmarkUrl(url);
      const response = await fetchImplementation(normalizedUrl, {
        redirect: "follow",
        headers: {
          Accept: "text/html,application/xhtml+xml"
        }
      });

      if (!response.ok) {
        throw new Error("bookmark_extract_failed");
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("text/html")) {
        throw new Error("bookmark_extract_unsupported_content_type");
      }

      return extractBookmarkPreviewFromHtml(normalizedUrl, await response.text());
    }
  };
}
