import { normalizeBookmarkUrl } from "../repositories/bookmarks";

export type BookmarkExtractPreviewRecord = {
  url: string;
  normalizedUrl: string;
  sourceTitle: string | null;
  sourceContent: string | null;
  sourceSummary: string | null;
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

function stripHtml(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
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
  const sourceContent = truncateText(stripHtml(extractPrimaryHtml(html)), 1600);
  const sourceSummary = truncateText(metaDescription ?? sourceContent, 280);

  return {
    url,
    normalizedUrl,
    sourceTitle,
    sourceContent,
    sourceSummary
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
