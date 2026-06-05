// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";

import { extractRenderedPreviewFromDocument } from "./rendered-preview";

describe("rendered preview extraction", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("prefers article content and preserves heading, paragraph, list, and image order", () => {
    document.title = "문서 제목";
    document.body.innerHTML = `
      <main>
        <h1>메인 제목</h1>
        <p>메인 본문</p>
      </main>
      <article>
        <h1>아티클 제목</h1>
        <p>첫 번째 문단</p>
        <ul>
          <li>첫 번째 항목</li>
          <li>두 번째 항목</li>
        </ul>
        <img src="/images/cover.png" alt="대표 이미지" />
      </article>
      <p>바디 바깥 본문</p>
    `;

    const preview = extractRenderedPreviewFromDocument(
      document,
      "https://example.com/articles/rendered"
    );

    expect(preview.sourceTitle).toBe("문서 제목");
    expect(preview.normalizedUrl).toBe("https://example.com/articles/rendered");
    expect(preview.sourceBlocks).toEqual([
      { type: "heading", text: "아티클 제목" },
      { type: "paragraph", text: "첫 번째 문단" },
      { type: "list-item", text: "첫 번째 항목" },
      { type: "list-item", text: "두 번째 항목" },
      {
        type: "image",
        url: "https://example.com/images/cover.png",
        alt: "대표 이미지"
      }
    ]);
    expect(preview.sourceContent).toContain("아티클 제목");
    expect(preview.sourceContent).not.toContain("메인 제목");
    expect(preview.sourceImageUrl).toBe("https://example.com/images/cover.png");
    expect(preview.renderSource).toBe("extension");
    expect(preview.renderStatus).toBe("ready");
  });

  it("ignores javascript fallback text and skipped tags when building rendered content", () => {
    document.title = "SPA 문서";
    document.head.innerHTML = `
      <meta name="description" content="렌더링된 설명" />
      <meta property="og:image" content="/images/meta-cover.png" />
    `;
    document.body.innerHTML = `
      <div>
        You need to enable JavaScript to run this app.
        <style>.hidden { display: none; }</style>
        <script>window.shouldNotAppear = true;</script>
        <noscript>You need to enable JavaScript to run this app.</noscript>
        <h2>실제 제목</h2>
        <p>실제 본문</p>
      </div>
    `;

    const preview = extractRenderedPreviewFromDocument(document, "https://example.com/spa");

    expect(preview.sourceBlocks).toEqual([
      { type: "heading", text: "실제 제목" },
      { type: "paragraph", text: "실제 본문" }
    ]);
    expect(preview.sourceContent).toBe("실제 제목\n\n실제 본문");
    expect(preview.sourceSummary).toBe("렌더링된 설명");
    expect(preview.sourceImageUrl).toBe("https://example.com/images/meta-cover.png");
    expect(preview.sourceContent).not.toContain("enable JavaScript");
  });
});
