import { describe, expect, it } from "vitest";

import { extractBookmarkPreviewFromHtml } from "../src/lib/extract/bookmark-extractor";

describe("bookmark extractor", () => {
  it("marks SPA fallback pages as js-required and removes noscript fallback text", () => {
    const preview = extractBookmarkPreviewFromHtml(
      "https://spa.example/app",
      `
        <html>
          <head>
            <title>SPA Article</title>
            <meta name="description" content="SPA description">
            <meta property="og:image" content="/cover.png">
          </head>
          <body>
            <noscript>You need to enable JavaScript to run this app.</noscript>
            <div id="root"></div>
          </body>
        </html>
      `
    );

    expect(preview.sourceImageUrl).toBe("https://spa.example/cover.png");
    expect(preview.sourceSummary).toBe("SPA description");
    expect(preview.sourceContent).toBeNull();
    expect(preview.sourceBlocks).toEqual([]);
    expect(preview.renderStatus).toBe("js_required");
    expect(preview.renderSource).toBe("worker");
    expect(preview.renderReason).toBe("spa_fallback");
  });

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

  it("preserves article paragraphs while removing Brunch navigation text", () => {
    const preview = extractBookmarkPreviewFromHtml(
      "https://brunch.co.kr/@pletalk/95",
      `
        <html>
          <body>
            <article>
              페이지뷰" &gt; .wrap_related_article" &gt;
              <h1>raindrop.io : 올인원 북마크 서비스</h1>
              정보와 자료의 수집, 저장, 검색, 분류 그리고 관리를 한방에 by 커버 &gt; 작가명 클릭" &gt;onlino Jan 25. 2022
              <p>최근에 여러 산업과 비즈니스에 대해서 자료를 리서치를 진행할 일들이 늘어나면서 기존에 사용하던 Evernote보다 편리하고 여러 기기 환경에서도 지원이 가능한 북마크 및 자료 관리 프로그램을 찾다가 생산성 관련 사이트를 통해 알게 된 raindrop.io 서비스를 사용하게 되었는데요.</p>
              <p>실제 북마크를 위해 사용하고 있는 웹 브라우저의 확장 프로그램(Extension, Add-On)을 설치해야 합니다. 현재 널리 사용하고 있는 모든 브라우저들을 지원하고 있어서 편리하게 사용이 가능합니다.</p>
              <p>raindrop의 가진 몇 가지 특징들을 살펴보면 다음과 같습니다.</p>
              <p>풍부한 정렬 기능 - 저장된 날짜 순서 이외에 이름이나 사이트의 이름순으로 정렬이 가능합니다.</p>
              <p>다양한 레이아웃 지원 - 본문에 들어있는 이미지를 좀 더 큼직하게 볼 수 있다면, 스크랩한 내용을 다시 들어가서 확인하지 않아도 될 텐데 말이죠.</p>
              keyword 본문 하단 &gt; 키워드 클릭" &gt; 북마크 본문 하단 &gt; 키워드 클릭" &gt; 스크랩 본문 하단 &gt; 키워드 클릭" &gt; 생각정리 하단 고정 영역 &gt; 매거진 다른글 클릭" &gt; 매거진의 이전글 Tweek Calendar : 미니멀 주간 캘린더 Printfriendly : PDF로 웹사이트 출력하기 매거진의 다음글
            </article>
          </body>
        </html>
      `
    );

    expect(preview.sourceContent).toContain(
      "최근에 여러 산업과 비즈니스에 대해서 자료를 리서치를 진행할 일들이 늘어나면서 기존에 사용하던 Evernote보다 편리하고 여러 기기 환경에서도 지원이 가능한 북마크 및 자료 관리 프로그램을 찾다가 생산성 관련 사이트를 통해 알게 된 raindrop.io 서비스를 사용하게 되었는데요.\n\n실제 북마크를 위해 사용하고 있는 웹 브라우저의 확장 프로그램"
    );
    expect(preview.sourceContent).toContain(
      "raindrop의 가진 몇 가지 특징들을 살펴보면 다음과 같습니다.\n\n풍부한 정렬 기능 - 저장된 날짜 순서"
    );
    expect(preview.sourceContent).not.toContain("페이지뷰");
    expect(preview.sourceContent).not.toContain(".wrap_related_article");
    expect(preview.sourceContent).not.toContain("작가명 클릭");
    expect(preview.sourceContent).not.toContain("본문 하단");
    expect(preview.sourceContent).not.toContain("키워드 클릭");
    expect(preview.sourceContent).not.toContain("하단 고정 영역");
    expect(preview.sourceContent).not.toContain("매거진의 이전글");
    expect(preview.sourceContent).not.toContain("매거진의 다음글");
    expect(preview.sourceContent).not.toContain(">");
  });

  it("extracts article preview blocks with images in their original reading order", () => {
    const preview = extractBookmarkPreviewFromHtml(
      "https://brunch.co.kr/@pletalk/95",
      `
        <html>
          <head>
            <meta property="og:image" content="https://img.example.com/cover.png">
          </head>
          <body>
            <article>
              <h1>raindrop.io : 올인원 북마크 서비스</h1>
              <p>첫 번째 본문 문단입니다.</p>
              <figure>
                <img src="/images/article-screen.png" alt="raindrop 화면">
              </figure>
              <p>이미지 뒤에 이어지는 두 번째 본문 문단입니다.</p>
            </article>
          </body>
        </html>
      `
    );

    expect(preview.sourceBlocks).toEqual([
      { type: "heading", text: "raindrop.io : 올인원 북마크 서비스" },
      { type: "paragraph", text: "첫 번째 본문 문단입니다." },
      {
        type: "image",
        url: "https://brunch.co.kr/images/article-screen.png",
        alt: "raindrop 화면"
      },
      { type: "paragraph", text: "이미지 뒤에 이어지는 두 번째 본문 문단입니다." }
    ]);
    expect(preview.sourceContent).toContain(
      "첫 번째 본문 문단입니다.\n\n이미지 뒤에 이어지는 두 번째 본문 문단입니다."
    );
  });
});
