import { describe, expect, it } from "vitest";

import { getInitialPageContent, getPageContentHelperText } from "./page-content";

describe("page-content helpers", () => {
  it("prefers pending user content over selected text", () => {
    expect(getInitialPageContent("직접 입력한 내용", "자동 선택 텍스트")).toBe("직접 입력한 내용");
  });

  it("falls back to selected text when pending content is empty", () => {
    expect(getInitialPageContent("", "자동 선택 텍스트")).toBe("자동 선택 텍스트");
  });

  it("returns empty string when neither pending content nor selected text exists", () => {
    expect(getInitialPageContent(null, undefined)).toBe("");
  });

  it("returns editable helper text when selected text exists", () => {
    expect(getPageContentHelperText("선택한 문장")).toContain("수정");
  });

  it("returns manual input helper text when selected text is missing", () => {
    expect(getPageContentHelperText("")).toContain("직접 페이지 내용을 입력");
  });
});
