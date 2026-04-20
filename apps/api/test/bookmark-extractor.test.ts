import { describe, expect, it } from "vitest";

import { extractBookmarkPreviewFromHtml } from "../src/lib/extract/bookmark-extractor";

describe("bookmark extractor", () => {
  it("keeps full extracted article text instead of replacing the tail with an ellipsis", () => {
    const paragraphs = Array.from({ length: 90 }, (_, index) => {
      return `<p>Paragraph ${index + 1} includes enough text to represent a saved article section.</p>`;
    }).join("");
    const preview = extractBookmarkPreviewFromHtml(
      "https://example.com/long-article",
      `<html><head><title>Long article</title></head><body><article>${paragraphs}</article></body></html>`
    );

    expect(preview.sourceContent).toContain("Paragraph 90");
    expect(preview.sourceContent).not.toMatch(/\.\.\.$/);
  });

  it("removes encoded tracking attributes from extracted article content", () => {
    const preview = extractBookmarkPreviewFromHtml(
      "https://brunch.co.kr/@pletalk/95",
      `
        <html>
          <head>
            <meta property="og:title" content="raindrop.io : 올인원 북마크 서비스">
            <meta property="og:image" content="http://t1.daumcdn.net/brunch/service/user/2uV/image/cover.png">
          </head>
          <body>
            <article>
              &lt;div t-section="article" t-page="articleview" t-action-kind="ViewContent"
                data-tiara-id="95" data-tiara-type="publish"
                data-tiara-name="raindrop.io : 올인원 북마크 서비스"
                data-tiara-category="onlino" data-tiara-author_id="@@2uV"&gt;
              <p>최근에 여러 산업과 비즈니스에 대해서 자료를 리서치를 진행할 일이 늘어나면서</p>
              <p>raindrop.io 서비스를 사용하게 되었는데요.</p>
            </article>
          </body>
        </html>
      `
    );

    expect(preview.sourceContent).toContain("최근에 여러 산업과 비즈니스");
    expect(preview.sourceContent).toContain("raindrop.io 서비스를 사용하게 되었는데요.");
    expect(preview.sourceContent).not.toContain("t-section");
    expect(preview.sourceContent).not.toContain("data-tiara");
    expect(preview.sourceContent).not.toContain("articleview");
    expect(preview.sourceImageUrl).toBe(
      "http://t1.daumcdn.net/brunch/service/user/2uV/image/cover.png"
    );
  });
});
