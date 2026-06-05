import { normalizeSelectionText } from "./capture";
import { buildScreenshotFilename } from "./screenshot";
import type { PendingBookmarkDraft } from "./storage";

export const CONTEXT_MENU_IDS = {
  page: "bookmark-save-page",
  selection: "bookmark-save-selection",
  image: "bookmark-save-image",
  link: "bookmark-save-link",
  screenshot: "bookmark-save-screenshot"
} as const;

type ContextMenuId = (typeof CONTEXT_MENU_IDS)[keyof typeof CONTEXT_MENU_IDS];

type ContextMenuClickInfo = {
  pageUrl?: string;
  selectionText?: string;
  srcUrl?: string;
  linkUrl?: string;
};

type TabLike = {
  title?: string;
  url?: string;
};

type BuildDraftOptions = {
  defaultFolderId?: string;
  defaultTagIds?: string[];
  screenshotDataUrl?: string;
};

function getDefaultUrl(info: ContextMenuClickInfo, tab: TabLike) {
  return info.pageUrl || tab.url || "";
}

function getDefaultTitle(tab: TabLike, fallbackUrl: string) {
  return (tab.title ?? "").trim() || fallbackUrl;
}

function getFilenameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
    return pathname || "bookmark-image.png";
  } catch {
    return "bookmark-image.png";
  }
}

export function getContextMenuDefinitions() {
  return [
    { id: CONTEXT_MENU_IDS.page, title: "페이지 저장", contexts: ["page"] },
    { id: CONTEXT_MENU_IDS.selection, title: "선택 텍스트 저장", contexts: ["selection"] },
    { id: CONTEXT_MENU_IDS.image, title: "이미지 저장", contexts: ["image"] },
    { id: CONTEXT_MENU_IDS.link, title: "링크 저장", contexts: ["link"] },
    {
      id: CONTEXT_MENU_IDS.screenshot,
      title: "스크린샷 저장",
      contexts: ["page", "selection", "image", "link"]
    }
  ];
}

export function buildPendingBookmarkDraft(
  menuId: ContextMenuId,
  info: ContextMenuClickInfo,
  tab: TabLike,
  options: BuildDraftOptions = {}
): PendingBookmarkDraft {
  const url =
    menuId === CONTEXT_MENU_IDS.link
      ? info.linkUrl || getDefaultUrl(info, tab)
      : menuId === CONTEXT_MENU_IDS.image
        ? getDefaultUrl(info, tab) || info.srcUrl || ""
        : getDefaultUrl(info, tab);

  const baseDraft: PendingBookmarkDraft = {
    source: "page",
    title: getDefaultTitle(tab, url),
    url,
    userContent: "",
    folderId: (options.defaultFolderId ?? "").trim(),
    tagIds: Array.from(new Set((options.defaultTagIds ?? []).map((tagId) => tagId.trim()).filter(Boolean))),
    assets: []
  };

  if (menuId === CONTEXT_MENU_IDS.selection) {
    return {
      ...baseDraft,
      source: "selection",
      userContent: normalizeSelectionText(info.selectionText ?? "")
    };
  }

  if (menuId === CONTEXT_MENU_IDS.image) {
    return {
      ...baseDraft,
      source: "image",
      assets: info.srcUrl
        ? [{ kind: "remote-url", source: info.srcUrl, filename: getFilenameFromUrl(info.srcUrl) }]
        : []
    };
  }

  if (menuId === CONTEXT_MENU_IDS.link) {
    return {
      ...baseDraft,
      source: "link",
      url: info.linkUrl || baseDraft.url
    };
  }

  if (menuId === CONTEXT_MENU_IDS.screenshot) {
    return {
      ...baseDraft,
      source: "screenshot",
      assets: options.screenshotDataUrl
        ? [
            {
              kind: "data-url",
              source: options.screenshotDataUrl,
              filename: buildScreenshotFilename(baseDraft.title)
            }
          ]
        : []
    };
  }

  return baseDraft;
}
