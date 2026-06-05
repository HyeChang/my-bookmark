import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const userscriptPath = resolve(__dirname, "../../public/downloads/bookmark-saver.user.js");
const userscriptSource = readFileSync(userscriptPath, "utf8");

function setPageUrl(url: string) {
  (window as unknown as { happyDOM: { setURL: (nextUrl: string) => void } }).happyDOM.setURL(url);
}

type MenuCommand = {
  label: string;
  callback: () => void;
};

function installUserscript() {
  const menuCommands: MenuCommand[] = [];

  Object.assign(globalThis, {
    GM_getValue: vi.fn((_key: string, fallback: unknown) => fallback),
    GM_setValue: vi.fn(),
    GM_registerMenuCommand: vi.fn((label: string, callback: () => void) => {
      menuCommands.push({ label, callback });
    }),
    GM_xmlhttpRequest: vi.fn(),
    GM_notification: vi.fn(),
    GM_openInTab: vi.fn()
  });

  Function(userscriptSource)();

  return {
    menuCommands
  };
}

function getBookmarkContextMenu() {
  return document.getElementById("bookmark-saver-userscript-context-menu");
}

function getBookmarkPanel() {
  return document.getElementById("bookmark-saver-userscript-panel");
}

afterEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
  document.documentElement
    .querySelectorAll(
      "#bookmark-saver-userscript-context-menu, #bookmark-saver-userscript-panel, #bookmark-saver-userscript-button"
    )
    .forEach((element) => element.remove());
  vi.restoreAllMocks();
  delete (globalThis as { trustedTypes?: unknown }).trustedTypes;
});

describe("bookmark userscript", () => {
  it("opens the save panel from the Tampermonkey menu command", async () => {
    setPageUrl("https://example.com/article");
    const { menuCommands } = installUserscript();

    menuCommands.find((command) => command.label === "Bookmark Saver 저장 패널 열기")?.callback();

    await Promise.resolve();

    expect(getBookmarkPanel()).not.toBeNull();
  });

  it("opens the save panel on trusted-types pages that reject raw innerHTML", async () => {
    setPageUrl("https://example.com/article");
    const innerHtmlDescriptor = getShadowRootInnerHtmlDescriptor();
    expect(innerHtmlDescriptor?.set).toBeTypeOf("function");
    vi.spyOn(ShadowRoot.prototype, "innerHTML", "set").mockImplementation(function (
      this: ShadowRoot,
      value: unknown
    ) {
      if (!(value && typeof value === "object" && "__bookmarkTrustedHtml" in value)) {
        throw new TypeError("This document requires TrustedHTML assignment.");
      }

      innerHtmlDescriptor?.set?.call(this, String(value));
    });
    Object.assign(globalThis, {
      trustedTypes: {
        createPolicy: vi.fn((_name: string, rules: { createHTML: (value: string) => string }) => ({
          createHTML: (value: string) => ({
            __bookmarkTrustedHtml: true,
            toString: () => rules.createHTML(value)
          })
        }))
      }
    });
    const { menuCommands } = installUserscript();

    menuCommands.find((command) => command.label === "Bookmark Saver 저장 패널 열기")?.callback();

    await Promise.resolve();

    expect(getBookmarkPanel()).not.toBeNull();
  });

  it("opens its context menu when a general site dispatches Shift + contextmenu", () => {
    setPageUrl("https://example.com/article");
    installUserscript();

    document.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: 120,
        clientY: 80,
        shiftKey: true
      })
    );

    expect(getBookmarkContextMenu()).not.toBeNull();
  });

  it("opens its context menu when only Shift + right mousedown reaches the page", () => {
    setPageUrl("https://example.com/article");
    installUserscript();

    document.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: 120,
        clientY: 80,
        shiftKey: true
      })
    );

    expect(getBookmarkContextMenu()).not.toBeNull();
  });
});

function getShadowRootInnerHtmlDescriptor() {
  let prototype: unknown = ShadowRoot.prototype;
  while (prototype && typeof prototype === "object") {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "innerHTML");
    if (descriptor) {
      return descriptor;
    }

    prototype = Object.getPrototypeOf(prototype);
  }

  return null;
}
