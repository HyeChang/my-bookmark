import type { BookmarkExtractPreview, BookmarkExtractPreviewBlock } from "@bookmark/shared";

export type BookmarkPreviewFieldRow = {
  label: string;
  value: string;
};

export function hasTextContent(value: string | null | undefined) {
  return Boolean(value && sanitizeExtractedDisplayText(value).length > 0);
}

function decodeHtmlEntitiesForDisplay(value: string) {
  if (!/[&]/.test(value)) {
    return value;
  }

  const ownerDocument = globalThis.document;
  if (ownerDocument) {
    const textarea = ownerDocument.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&");
}

function normalizeDisplayWhitespace(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeExtractedDisplayText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const decodedValue = decodeHtmlEntitiesForDisplay(value);
  return normalizeDisplayWhitespace(
    decodeHtmlEntitiesForDisplay(
      decodedValue
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
        .replace(/\b[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, " ")
    )
  );
}

export function getBookmarkPreviewArticleBlocks(preview: BookmarkExtractPreview | null) {
  return (preview?.sourceBlocks ?? [])
    .map((block) => {
      if (block.type === "image") {
        return {
          ...block,
          alt: sanitizeExtractedDisplayText(block.alt) || null
        };
      }

      return {
        ...block,
        text: sanitizeExtractedDisplayText(block.text)
      };
    })
    .filter((block) => {
      if (block.type === "image") {
        return hasTextContent(block.url);
      }

      return hasTextContent(block.text);
    });
}

export function getBookmarkPreviewFieldRows(
  preview: BookmarkExtractPreview | null
): BookmarkPreviewFieldRow[] {
  if (!preview) {
    return [];
  }

  if (getBookmarkPreviewArticleBlocks(preview).length > 0) {
    return [];
  }

  return [
    { label: "제목", value: preview.sourceTitle },
    { label: "내용", value: preview.sourceContent },
    { label: "요약", value: preview.sourceSummary }
  ]
    .map((row) => ({
      ...row,
      value: sanitizeExtractedDisplayText(row.value)
    }))
    .filter((row): row is BookmarkPreviewFieldRow => hasTextContent(row.value));
}

export function getBookmarkPreviewImageAlt(preview: BookmarkExtractPreview) {
  return `${sanitizeExtractedDisplayText(preview.sourceTitle) || preview.normalizedUrl || preview.url} 미리보기 이미지`;
}

function getBookmarkPreviewArticleImageAlt(
  preview: BookmarkExtractPreview,
  block: Extract<BookmarkExtractPreviewBlock, { type: "image" }>,
  index: number
) {
  return (
    block.alt ??
    `${sanitizeExtractedDisplayText(preview.sourceTitle) || preview.normalizedUrl || preview.url} 본문 이미지 ${index + 1}`
  );
}

export function getBookmarkPreviewStoredSourceFields(
  preview: BookmarkExtractPreview | null
) {
  return {
    sourceTitle: sanitizeExtractedDisplayText(preview?.sourceTitle) || null,
    sourceContent: sanitizeExtractedDisplayText(preview?.sourceContent) || null,
    sourceSummary: sanitizeExtractedDisplayText(preview?.sourceSummary) || null
  };
}

export function isJsRequiredBookmarkPreview(
  preview: BookmarkExtractPreview | null | undefined
) {
  return preview?.renderStatus === "js_required";
}

export function getBookmarkPreviewWorkerFallbackMessage(status: "missing" | "failed") {
  if (status === "missing") {
    return "브라우저 렌더링이 필요해 worker 메타데이터만 표시합니다.";
  }

  return "확장 렌더링에 실패해 worker 메타데이터만 표시합니다.";
}

export function hasBookmarkPreviewCoverImage(preview: BookmarkExtractPreview | null) {
  if (!preview?.sourceImageUrl) {
    return false;
  }

  return !getBookmarkPreviewArticleBlocks(preview).some(
    (block) => block.type === "image" && block.url === preview.sourceImageUrl
  );
}

export function renderBookmarkPreviewArticle(preview: BookmarkExtractPreview) {
  const blocks = getBookmarkPreviewArticleBlocks(preview);
  if (blocks.length === 0) {
    return null;
  }

  let imageIndex = 0;
  return (
    <section className="bookmark-preview-article" aria-label="미리보기 본문">
      {blocks.map((block, index) => {
        const key =
          block.type === "image"
            ? `${block.type}-${block.url}-${index}`
            : `${block.type}-${block.text.slice(0, 32)}-${index}`;

        if (block.type === "image") {
          const currentImageIndex = imageIndex;
          imageIndex += 1;
          return (
            <figure key={key} className="bookmark-preview-article-figure">
              <img
                className="bookmark-preview-article-image"
                src={block.url}
                alt={getBookmarkPreviewArticleImageAlt(preview, block, currentImageIndex)}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
              />
              {block.alt ? <figcaption>{block.alt}</figcaption> : null}
            </figure>
          );
        }

        if (block.type === "heading") {
          return (
            <h4 key={key} className="bookmark-preview-article-heading">
              {block.text}
            </h4>
          );
        }

        if (block.type === "list-item") {
          return (
            <p key={key} className="bookmark-preview-article-list-item">
              <span aria-hidden="true">•</span>
              <span>{block.text}</span>
            </p>
          );
        }

        return (
          <p key={key} className="bookmark-preview-article-paragraph">
            {block.text}
          </p>
        );
      })}
    </section>
  );
}

export function renderHiddenBookmarkIndicator(isHidden: boolean) {
  if (!isHidden) {
    return null;
  }

  return (
    <span className="folder-hidden-indicator bookmark-hidden-indicator" aria-hidden="true">
      🔒
    </span>
  );
}
