import { normalizeBookmarkUrl } from "../repositories/bookmarks";

export type BookmarkExtractPreviewRecord = {
  url: string;
  normalizedUrl: string;
  sourceTitle: string | null;
  sourceContent: string | null;
  sourceSummary: string | null;
  sourceImageUrl?: string | null;
};

export type BookmarkExtractor = {
  extract(url: string): Promise<BookmarkExtractPreviewRecord>;
};

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

function stripHtml(html: string) {
  const blockStrippedHtml = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const decodedHtml = decodeHtmlEntities(blockStrippedHtml);

  const strippedHtml = decodeHtmlEntities(
    decodedHtml
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
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
  const sourceContent = toNullableText(stripHtml(extractPrimaryHtml(html)));
  const sourceSummary = truncateText(metaDescription ?? sourceContent, 280);

  return {
    url,
    normalizedUrl,
    sourceTitle,
    sourceContent,
    sourceSummary,
    sourceImageUrl
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
