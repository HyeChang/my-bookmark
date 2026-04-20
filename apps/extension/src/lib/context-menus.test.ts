import { describe, expect, it } from "vitest";

import {
  CONTEXT_MENU_IDS,
  buildPendingBookmarkDraft,
  getContextMenuDefinitions
} from "./context-menus";

describe("extension context menu helpers", () => {
  it("declares the supported context menu items", () => {
    expect(getContextMenuDefinitions()).toEqual([
      {
        id: CONTEXT_MENU_IDS.page,
        title: "페이지 저장",
        contexts: ["page"]
      },
      {
        id: CONTEXT_MENU_IDS.selection,
        title: "선택 텍스트 저장",
        contexts: ["selection"]
      },
      {
        id: CONTEXT_MENU_IDS.image,
        title: "이미지 저장",
        contexts: ["image"]
      },
      {
        id: CONTEXT_MENU_IDS.link,
        title: "링크 저장",
        contexts: ["link"]
      },
      {
        id: CONTEXT_MENU_IDS.screenshot,
        title: "스크린샷 저장",
        contexts: ["page", "selection", "image", "link"]
      }
    ]);
  });

  it("builds a selection draft from the clicked page", () => {
    expect(
      buildPendingBookmarkDraft(
        CONTEXT_MENU_IDS.selection,
        {
          pageUrl: "https://example.com/article",
          selectionText: "quoted text"
        },
        {
          title: "Example article",
          url: "https://example.com/article"
        },
        {
          defaultFolderId: "folder-1",
          defaultTagIds: ["tag-1", "tag-2"]
        }
      )
    ).toEqual({
      source: "selection",
      title: "Example article",
      url: "https://example.com/article",
      userContent: "quoted text",
      folderId: "folder-1",
      tagIds: ["tag-1", "tag-2"],
      assets: []
    });
  });

  it("builds an image draft with the clicked image as a queued asset", () => {
    expect(
      buildPendingBookmarkDraft(
        CONTEXT_MENU_IDS.image,
        {
          pageUrl: "https://example.com/gallery",
          srcUrl: "https://cdn.example.com/reference-image.png"
        },
        {
          title: "Gallery page",
          url: "https://example.com/gallery"
        }
      )
    ).toEqual({
      source: "image",
      title: "Gallery page",
      url: "https://example.com/gallery",
      userContent: "",
      folderId: "",
      tagIds: [],
      assets: [
        {
          kind: "remote-url",
          source: "https://cdn.example.com/reference-image.png",
          filename: "reference-image.png"
        }
      ]
    });
  });

  it("builds a screenshot draft with the captured image queued", () => {
    expect(
      buildPendingBookmarkDraft(
        CONTEXT_MENU_IDS.screenshot,
        {
          pageUrl: "https://example.com/dashboard"
        },
        {
          title: "Dashboard",
          url: "https://example.com/dashboard"
        },
        {
          screenshotDataUrl: "data:image/png;base64,QUJDRA=="
        }
      )
    ).toEqual({
      source: "screenshot",
      title: "Dashboard",
      url: "https://example.com/dashboard",
      userContent: "",
      folderId: "",
      tagIds: [],
      assets: [
        {
          kind: "data-url",
          source: "data:image/png;base64,QUJDRA==",
          filename: "bookmark-dashboard.png"
        }
      ]
    });
  });
});
