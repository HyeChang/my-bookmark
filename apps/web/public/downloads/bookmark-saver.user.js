// ==UserScript==
// @name         Bookmark Saver
// @namespace    https://bookmark.keygenerator25.workers.dev/
// @version      0.1.11
// @description  Save the current page, selected text, and page images to Bookmark from Tampermonkey.
// @author       Bookmark
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_openInTab
// @grant        unsafeWindow
// @connect      *
// @updateURL    https://bookmark.keygenerator25.workers.dev/downloads/bookmark-saver.user.js?v=0.1.11
// @downloadURL  https://bookmark.keygenerator25.workers.dev/downloads/bookmark-saver.user.js?v=0.1.11
// ==/UserScript==

(function () {
  "use strict";

  const BOOKMARK_WEB_BRIDGE_SOURCE = "bookmark-web";
  const BOOKMARK_EXTENSION_BRIDGE_SOURCE = "bookmark-extension";
  const BOOKMARK_EXTENSION_CLIENT_TYPE = "userscript";
  const BOOKMARK_WEB_URL = "https://bookmark.keygenerator25.workers.dev/";
  const SETTINGS_KEY = "bookmarkSaver.settings";
  const DEFAULT_SETTINGS = {
    apiBaseUrl: "https://bookmark.keygenerator25.workers.dev",
    token: "",
    defaultFolderId: "",
    defaultTagIds: []
  };

  const FLOATING_BUTTON_ID = "bookmark-saver-userscript-button";
  const PANEL_ID = "bookmark-saver-userscript-panel";
  const CONTEXT_MENU_ID = "bookmark-saver-userscript-context-menu";
  const PANEL_PASTED_FILES = new WeakMap();
  let trustedHtmlPolicy = null;

  function getPageWindow() {
    try {
      if (
        typeof unsafeWindow !== "undefined" &&
        unsafeWindow &&
        typeof unsafeWindow.addEventListener === "function" &&
        typeof unsafeWindow.postMessage === "function"
      ) {
        return unsafeWindow;
      }
    } catch {
      // Fall back to the userscript window below.
    }

    return globalThis.window || globalThis;
  }

  function getTargetOrigin(win) {
    return win?.location?.origin || globalThis.location?.origin || "*";
  }

  function getTrustedTypes() {
    try {
      if (globalThis.trustedTypes?.createPolicy) {
        return globalThis.trustedTypes;
      }
    } catch {
      // Fall back to the page window below.
    }

    try {
      const pageWindow = getPageWindow();
      if (pageWindow?.trustedTypes?.createPolicy) {
        return pageWindow.trustedTypes;
      }
    } catch {
      // Use raw strings when Trusted Types cannot be accessed.
    }

    return null;
  }

  function toTrustedHtml(html) {
    const trustedTypes = getTrustedTypes();
    if (!trustedTypes) {
      return html;
    }

    try {
      trustedHtmlPolicy =
        trustedHtmlPolicy ||
        trustedTypes.createPolicy("bookmark-saver-userscript", {
          createHTML: (value) => value
        });
      return trustedHtmlPolicy.createHTML(html);
    } catch {
      return html;
    }
  }

  function setShadowHtml(root, html) {
    root.innerHTML = toTrustedHtml(html);
  }

  function isBookmarkWebOrigin(win) {
    const hostname = win?.location?.hostname || globalThis.location?.hostname || "";
    return (
      hostname === "bookmark.keygenerator25.workers.dev" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1"
    );
  }

  function normalizeBaseUrl(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function normalizeTagIds(value) {
    if (Array.isArray(value)) {
      return Array.from(new Set(value.map((tagId) => String(tagId).trim()).filter(Boolean)));
    }

    return Array.from(
      new Set(
        String(value || "")
          .split(",")
          .map((tagId) => tagId.trim())
          .filter(Boolean)
      )
    );
  }

  function normalizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};

    return {
      apiBaseUrl: normalizeBaseUrl(source.apiBaseUrl) || DEFAULT_SETTINGS.apiBaseUrl,
      token: String(source.token || "").trim(),
      defaultFolderId: String(source.defaultFolderId || "").trim(),
      defaultTagIds: normalizeTagIds(source.defaultTagIds)
    };
  }

  function loadSettings() {
    try {
      if (typeof GM_getValue === "function") {
        return normalizeSettings(GM_getValue(SETTINGS_KEY, DEFAULT_SETTINGS));
      }
    } catch {
      // Fall back to localStorage below.
    }

    try {
      const raw = globalThis.localStorage?.getItem(SETTINGS_KEY);
      return normalizeSettings(raw ? JSON.parse(raw) : DEFAULT_SETTINGS);
    } catch {
      return normalizeSettings(DEFAULT_SETTINGS);
    }
  }

  function saveSettings(settings, options = {}) {
    const normalized = normalizeSettings(settings);
    let didSaveToScriptStorage = false;

    try {
      if (typeof GM_setValue === "function") {
        GM_setValue(SETTINGS_KEY, normalized);
        didSaveToScriptStorage = true;
      }
    } catch {
      // Fall back to localStorage below.
    }

    if (options.requireScriptStorage && !didSaveToScriptStorage) {
      throw new Error("Tampermonkey storage is unavailable.");
    }

    try {
      globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage failures. The caller will still use the normalized value now.
    }

    return normalized;
  }

  function buildApiUrl(apiBaseUrl, path) {
    return `${normalizeBaseUrl(apiBaseUrl)}${path}`;
  }

  function isSuccessStatus(status) {
    return status >= 200 && status < 300;
  }

  function gmRequest(options) {
    const method = options.method || "GET";
    const headers = options.headers || {};
    const responseType = options.responseType || "json";

    if (typeof GM_xmlhttpRequest === "function") {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method,
          url: options.url,
          headers,
          data: options.data,
          responseType,
          timeout: options.timeout || 30000,
          onload: (response) => resolve(response),
          onerror: () => reject(new Error("네트워크 요청에 실패했습니다.")),
          ontimeout: () => reject(new Error("네트워크 요청 시간이 초과되었습니다."))
        });
      });
    }

    return fetch(options.url, {
      method,
      headers,
      body: options.data
    }).then(async (response) => {
      let body;
      if (responseType === "blob") {
        body = await response.blob();
      } else if (responseType === "json") {
        body = await response.json().catch(() => null);
      } else {
        body = await response.text();
      }

      return {
        status: response.status,
        response: body,
        responseText: typeof body === "string" ? body : JSON.stringify(body || "")
      };
    });
  }

  async function requestJson(settings, path, init = {}) {
    const response = await gmRequest({
      method: init.method || "GET",
      url: buildApiUrl(settings.apiBaseUrl, path),
      headers: {
        authorization: `Bearer ${settings.token}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.headers || {})
      },
      data: init.body,
      responseType: "json"
    });

    if (!isSuccessStatus(response.status)) {
      throw new Error(`API 요청에 실패했습니다. (${response.status})`);
    }

    if (response.response && typeof response.response === "object") {
      return response.response;
    }

    try {
      return JSON.parse(response.responseText || "{}");
    } catch {
      return {};
    }
  }

  async function requestUpload(settings, bookmarkId, file) {
    const formData = new FormData();
    formData.set("file", file);

    const response = await gmRequest({
      method: "POST",
      url: buildApiUrl(settings.apiBaseUrl, `/api/bookmarks/${bookmarkId}/assets`),
      headers: {
        authorization: `Bearer ${settings.token}`
      },
      data: formData,
      responseType: "text"
    });

    if (!isSuccessStatus(response.status)) {
      throw new Error(`이미지 업로드에 실패했습니다. (${response.status})`);
    }
  }

  async function loadFolders(settings) {
    const data = await requestJson(settings, "/api/folders");
    return Array.isArray(data.folders) ? data.folders : [];
  }

  async function loadTags(settings) {
    const data = await requestJson(settings, "/api/tags");
    return Array.isArray(data.tags) ? data.tags : [];
  }

  function normalizeSelectionText(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");
  }

  function collectImageCandidates() {
    const urls = Array.from(document.images || []).map((image) => {
      const source = image.currentSrc || image.src || "";
      return {
        source: source.trim(),
        width: image.naturalWidth || image.width || 0,
        height: image.naturalHeight || image.height || 0
      };
    });

    return Array.from(
      new Set(
        urls
          .filter((image) => image.source && !image.source.startsWith("data:"))
          .filter((image) => image.width >= 48 || image.height >= 48)
          .map((image) => image.source)
      )
    ).slice(0, 12);
  }

  function getFileNameFromUrl(imageUrl) {
    try {
      const pathname = new URL(imageUrl, globalThis.location.href).pathname;
      return pathname.split("/").filter(Boolean).pop() || "bookmark-image.png";
    } catch {
      return "bookmark-image.png";
    }
  }

  async function createFileFromImageUrl(imageUrl) {
    const response = await gmRequest({
      url: imageUrl,
      responseType: "blob"
    });

    if (!isSuccessStatus(response.status)) {
      throw new Error(`이미지를 불러오지 못했습니다. (${response.status})`);
    }

    const blob =
      response.response instanceof Blob
        ? response.response
        : new Blob([response.responseText || ""], { type: "application/octet-stream" });

    return new File([blob], getFileNameFromUrl(imageUrl), {
      type: blob.type || "image/png"
    });
  }

  function getImageFileExtension(mimeType) {
    const type = String(mimeType || "").toLowerCase();
    if (type.includes("jpeg") || type.includes("jpg")) {
      return "jpg";
    }
    if (type.includes("gif")) {
      return "gif";
    }
    if (type.includes("webp")) {
      return "webp";
    }
    if (type.includes("bmp")) {
      return "bmp";
    }
    if (type.includes("svg")) {
      return "svg";
    }
    return "png";
  }

  function ensureNamedImageFile(file, index) {
    const type = file.type || "image/png";
    const name = String(file.name || "").trim();
    if (name && file instanceof File) {
      return file;
    }

    return new File([file], `pasted-image-${Date.now()}-${index + 1}.${getImageFileExtension(type)}`, {
      type,
      lastModified: Date.now()
    });
  }

  function getClipboardImageFiles(event) {
    const clipboard = event.clipboardData;
    if (!clipboard) {
      return [];
    }

    const imageFiles = [];
    const seen = new Set();

    function appendFile(file) {
      if (!file || !String(file.type || "").startsWith("image/")) {
        return;
      }

      const key = `${file.name || ""}:${file.size}:${file.type}:${file.lastModified || 0}`;
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      imageFiles.push(file);
    }

    for (const item of Array.from(clipboard.items || [])) {
      if (item.kind === "file" && String(item.type || "").startsWith("image/")) {
        appendFile(item.getAsFile());
      }
    }

    for (const file of Array.from(clipboard.files || [])) {
      appendFile(file);
    }

    return imageFiles.map((file, index) => ensureNamedImageFile(file, index));
  }

  function getPastedImageEntries(root) {
    const entries = PANEL_PASTED_FILES.get(root);
    return Array.isArray(entries) ? entries : [];
  }

  function getPastedImageFiles(root) {
    return getPastedImageEntries(root).map((entry) => entry.file);
  }

  function revokePastedImageEntry(entry) {
    if (entry.previewUrl) {
      URL.revokeObjectURL(entry.previewUrl);
    }
  }

  function clearPastedImageFiles(root) {
    for (const entry of getPastedImageEntries(root)) {
      revokePastedImageEntry(entry);
    }
    PANEL_PASTED_FILES.delete(root);
  }

  function createPastedImageEntry(file, index) {
    const id =
      globalThis.crypto?.randomUUID?.() ||
      `pasted-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;
    return {
      id,
      file,
      previewUrl: typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : ""
    };
  }

  function renderPastedImageFiles(root) {
    const container = root.querySelector("[data-bms-pasted-images]");
    if (!container) {
      return;
    }

    const entries = getPastedImageEntries(root);
    container.textContent = "";

    if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "bms-muted";
      empty.textContent = "붙여넣은 이미지가 없습니다.";
      container.append(empty);
      return;
    }

    for (const entry of entries) {
      const row = document.createElement("div");
      row.className = "bms-pasted-image-row";

      const image = document.createElement("img");
      image.src = entry.previewUrl;
      image.alt = "";

      const text = document.createElement("span");
      text.textContent = `${entry.file.name} (${Math.ceil(entry.file.size / 1024)} KB)`;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.textContent = "제거";
      removeButton.addEventListener("click", () => {
        const nextEntries = getPastedImageEntries(root).filter((item) => item.id !== entry.id);
        revokePastedImageEntry(entry);
        PANEL_PASTED_FILES.set(root, nextEntries);
        renderPastedImageFiles(root);
      });

      row.append(image, text, removeButton);
      container.append(row);
    }
  }

  function addPastedImageFiles(root, files) {
    if (files.length === 0) {
      return;
    }

    const currentEntries = getPastedImageEntries(root);
    const nextEntries = [
      ...currentEntries,
      ...files.map((file, index) => createPastedImageEntry(file, currentEntries.length + index))
    ];
    PANEL_PASTED_FILES.set(root, nextEntries);
    renderPastedImageFiles(root);
    setStatus(root, `${files.length}개 이미지를 붙여넣었습니다. 저장하면 첨부로 업로드됩니다.`, "success");
  }

  async function saveBookmark(settings, payload, imageUrls = [], imageFiles = []) {
    if (!settings.token) {
      throw new Error("확장 토큰이 필요합니다. Bookmark 웹앱에서 자동 연결하거나 설정에 토큰을 입력해주세요.");
    }

    const data = await requestJson(settings, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const bookmark = data.bookmark;

    if (!bookmark?.id) {
      throw new Error("북마크 생성 응답을 확인하지 못했습니다.");
    }

    for (const imageUrl of imageUrls) {
      const file = await createFileFromImageUrl(imageUrl);
      await requestUpload(settings, bookmark.id, file);
    }

    for (const file of imageFiles) {
      await requestUpload(settings, bookmark.id, file);
    }

    return bookmark;
  }

  function notify(message) {
    if (typeof GM_notification === "function") {
      GM_notification({
        title: "Bookmark Saver",
        text: message,
        timeout: 3200
      });
      return;
    }

    console.info(`[Bookmark Saver] ${message}`);
  }

  function reportActionError(error) {
    const message = error instanceof Error ? error.message : "작업을 완료하지 못했습니다.";
    notify(`Bookmark Saver 오류: ${message}`);
    try {
      console.error("[Bookmark Saver]", error);
    } catch {
      // Ignore console failures.
    }
  }

  function runAction(action) {
    Promise.resolve()
      .then(action)
      .catch((error) => reportActionError(error));
  }

  function openBookmarkMainPage() {
    if (globalThis.location?.origin === new URL(BOOKMARK_WEB_URL).origin) {
      return;
    }

    if (typeof GM_openInTab === "function") {
      GM_openInTab(BOOKMARK_WEB_URL, {
        active: true,
        insert: true,
        setParent: true
      });
      return;
    }

    const opened = globalThis.open?.(BOOKMARK_WEB_URL, "_blank");
    if (opened && typeof opened.focus === "function") {
      opened.focus();
      return;
    }

    notify("팝업이 차단되어 메인 페이지를 열지 못했습니다.");
  }

  function removeElementById(id) {
    const existing = document.getElementById(id);
    if (existing) {
      existing.remove();
    }
  }

  function createShadowHost(id) {
    removeElementById(id);
    const host = document.createElement("div");
    host.id = id;
    document.documentElement.append(host);
    return {
      host,
      root: host.attachShadow({ mode: "open" })
    };
  }

  function setStatus(root, message, kind = "idle") {
    const status = root.querySelector("[data-bms-status]");
    if (!status) {
      return;
    }

    status.textContent = message || "";
    status.dataset.kind = kind;
  }

  function getFolderName(folder) {
    return String(folder?.name || folder?.id || "이름 없는 폴더").trim() || "이름 없는 폴더";
  }

  function getFolderSortOrder(folder) {
    const sortOrder = Number(folder?.sortOrder);
    return Number.isFinite(sortOrder) ? sortOrder : 0;
  }

  function getSortedFolders(folders) {
    return [...folders].sort(
      (leftFolder, rightFolder) =>
        getFolderSortOrder(leftFolder) - getFolderSortOrder(rightFolder) ||
        getFolderName(leftFolder).localeCompare(getFolderName(rightFolder), "ko")
    );
  }

  function getFolderOptions(folders) {
    const normalizedFolders = getSortedFolders(
      folders.filter((folder) => folder && typeof folder === "object" && folder.id)
    );
    const knownFolderIds = new Set(normalizedFolders.map((folder) => String(folder.id)));
    const foldersByParentId = new Map();
    const duplicateNameCounts = new Map();

    for (const folder of normalizedFolders) {
      const folderName = getFolderName(folder);
      duplicateNameCounts.set(folderName, (duplicateNameCounts.get(folderName) || 0) + 1);

      const parentFolderId = String(folder.parentFolderId || "").trim();
      const parentKey = parentFolderId && knownFolderIds.has(parentFolderId) ? parentFolderId : "";
      const childFolders = foldersByParentId.get(parentKey) || [];
      childFolders.push(folder);
      foldersByParentId.set(parentKey, childFolders);
    }

    const options = [];
    const visitedFolderIds = new Set();

    function visit(folder, depth, parentPath, trail) {
      const folderId = String(folder.id || "");
      if (!folderId || visitedFolderIds.has(folderId) || trail.has(folderId)) {
        return;
      }

      const folderName = getFolderName(folder);
      const nextPath = [...parentPath, folderName];
      const parentLabel = parentPath.join(" / ");
      const isDuplicateName = (duplicateNameCounts.get(folderName) || 0) > 1;
      const branchPrefix = depth === 0 ? "" : `${"  ".repeat(Math.max(0, depth - 1))}└ `;

      options.push({
        folder,
        label: `${branchPrefix}${folderName}${isDuplicateName && parentLabel ? ` · ${parentLabel}` : ""}`,
        path: nextPath.join(" / ")
      });
      visitedFolderIds.add(folderId);

      const nextTrail = new Set(trail);
      nextTrail.add(folderId);
      for (const childFolder of foldersByParentId.get(folderId) || []) {
        visit(childFolder, depth + 1, nextPath, nextTrail);
      }
    }

    for (const folder of foldersByParentId.get("") || []) {
      visit(folder, 0, [], new Set());
    }

    for (const folder of normalizedFolders) {
      visit(folder, 0, [], new Set());
    }

    return options;
  }

  function appendFolderOptions(select, folders, selectedId) {
    select.textContent = "";
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "폴더 없음";
    select.append(emptyOption);

    for (const { folder, label, path } of getFolderOptions(folders)) {
      const option = document.createElement("option");
      option.value = folder.id || "";
      option.textContent = label;
      option.title = path;
      option.dataset.folderPath = path;
      option.setAttribute("aria-label", path);
      option.selected = option.value === selectedId;
      select.append(option);
    }
  }

  function appendTagOptions(container, tags, selectedTagIds) {
    container.textContent = "";

    if (tags.length === 0) {
      const empty = document.createElement("p");
      empty.className = "bms-muted";
      empty.textContent = "사용 가능한 태그가 없습니다.";
      container.append(empty);
      return;
    }

    for (const tag of tags) {
      const label = document.createElement("label");
      label.className = "bms-chip";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = tag.id || "";
      checkbox.checked = selectedTagIds.includes(tag.id);

      const swatch = document.createElement("span");
      swatch.className = "bms-swatch";
      swatch.style.background = tag.color || "#8da0bc";

      const name = document.createElement("span");
      name.textContent = tag.name || tag.id || "태그";

      label.append(checkbox, swatch, name);
      container.append(label);
    }
  }

  function appendImageCandidates(container, imageUrls) {
    container.textContent = "";

    if (imageUrls.length === 0) {
      const empty = document.createElement("p");
      empty.className = "bms-muted";
      empty.textContent = "이 페이지에서 첨부할 만한 이미지를 찾지 못했습니다.";
      container.append(empty);
      return;
    }

    for (const imageUrl of imageUrls) {
      const label = document.createElement("label");
      label.className = "bms-image-row";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = imageUrl;

      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = "";
      image.loading = "lazy";

      const text = document.createElement("span");
      text.textContent = imageUrl;

      label.append(checkbox, image, text);
      container.append(label);
    }
  }

  async function saveFromPanel(root) {
    const settings = saveSettings({
      apiBaseUrl: root.querySelector("[data-bms-api-base-url]")?.value,
      token: root.querySelector("[data-bms-token]")?.value,
      defaultFolderId: root.querySelector("[data-bms-default-folder-id]")?.value,
      defaultTagIds: root.querySelector("[data-bms-default-tag-ids]")?.value
    });

    const selectedTagIds = Array.from(root.querySelectorAll("[data-bms-tags] input:checked"))
      .map((input) => input.value)
      .filter(Boolean);
    const hasTagCheckboxes = root.querySelectorAll("[data-bms-tags] input").length > 0;
    const manualTagIds = normalizeTagIds(root.querySelector("[data-bms-default-tag-ids]")?.value);
    const imageUrls = Array.from(root.querySelectorAll("[data-bms-images] input:checked"))
      .map((input) => input.value)
      .filter(Boolean);
    const pastedImageFiles = getPastedImageFiles(root);
    const attachmentCount = imageUrls.length + pastedImageFiles.length;

    const payload = {
      url: root.querySelector("[data-bms-url]")?.value.trim() || globalThis.location.href,
      folderId: root.querySelector("[data-bms-folder-id]")?.value || settings.defaultFolderId || null,
      tagIds: hasTagCheckboxes ? selectedTagIds : manualTagIds,
      userTitle: root.querySelector("[data-bms-title]")?.value.trim() || null,
      userContent: root.querySelector("[data-bms-content]")?.value.trim() || null,
      isFavorite: Boolean(root.querySelector("[data-bms-favorite]")?.checked),
      isHidden: Boolean(root.querySelector("[data-bms-hidden]")?.checked)
    };

    setStatus(root, attachmentCount > 0 ? "북마크와 이미지를 저장하는 중입니다..." : "북마크를 저장하는 중입니다...", "saving");

    await saveBookmark(settings, payload, imageUrls, pastedImageFiles);
    setStatus(root, "저장했습니다.", "success");
    notify("북마크를 저장했습니다.");
  }

  async function openPanel(mode = "page") {
    const settings = loadSettings();
    const selectedText = normalizeSelectionText(globalThis.getSelection?.().toString() || "");
    const imageUrls = collectImageCandidates();
    const { host, root } = createShadowHost(PANEL_ID);

    setShadowHtml(root, `
      <style>
        :host {
          all: initial;
          color-scheme: light;
          font-family: Inter, "Segoe UI", system-ui, sans-serif;
        }

        *, *::before, *::after {
          box-sizing: border-box;
        }

        .bms-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(10, 15, 25, 0.42);
        }

        .bms-panel {
          width: min(720px, 100%);
          max-height: min(820px, calc(100vh - 36px));
          overflow: auto;
          border: 1px solid #dfe3e8;
          border-radius: 8px;
          background: #ffffff;
          color: #20242b;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
        }

        .bms-header,
        .bms-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid #edf0f4;
        }

        .bms-footer {
          position: sticky;
          bottom: 0;
          border-top: 1px solid #edf0f4;
          border-bottom: none;
          background: #ffffff;
        }

        .bms-title-group {
          min-width: 0;
        }

        .bms-kicker {
          margin: 0 0 3px;
          color: #66707d;
          font-size: 12px;
          font-weight: 700;
        }

        h2, h3 {
          margin: 0;
          color: #20242b;
          letter-spacing: 0;
        }

        h2 {
          font-size: 18px;
        }

        h3 {
          font-size: 15px;
        }

        .bms-body {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 16px;
        }

        .bms-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        label,
        .bms-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
          color: #20242b;
          font-size: 13px;
          font-weight: 700;
        }

        input,
        textarea,
        select {
          width: 100%;
          min-height: 38px;
          border: 1px solid #dfe3e8;
          border-radius: 8px;
          background: #ffffff;
          color: #20242b;
          padding: 8px 10px;
          font: inherit;
          font-weight: 500;
          letter-spacing: 0;
        }

        textarea {
          min-height: 92px;
          resize: vertical;
        }

        details {
          border: 1px solid #e7ebf0;
          border-radius: 8px;
          padding: 12px;
          background: #f8fafc;
        }

        summary {
          cursor: pointer;
          color: #20242b;
          font-size: 14px;
          font-weight: 800;
        }

        .bms-stack {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 12px;
        }

        .bms-check-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .bms-check {
          display: inline-flex;
          align-items: center;
          flex-direction: row;
          gap: 7px;
          width: auto;
          font-size: 13px;
          font-weight: 700;
        }

        .bms-check input,
        .bms-chip input,
        .bms-image-row input {
          width: 16px;
          height: 16px;
          min-height: 16px;
          padding: 0;
          accent-color: #1683e8;
          flex: 0 0 auto;
        }

        .bms-chip-list,
        .bms-image-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .bms-chip {
          display: inline-flex;
          align-items: center;
          flex-direction: row;
          gap: 6px;
          width: auto;
          max-width: 100%;
          border: 1px solid #dfe3e8;
          border-radius: 8px;
          background: #ffffff;
          padding: 7px 9px;
          font-size: 13px;
          font-weight: 700;
        }

        .bms-swatch {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.16);
        }

        .bms-image-list {
          flex-direction: column;
        }

        .bms-paste-target {
          border: 1px dashed #b8c2d0;
          border-radius: 8px;
          background: #f8fafc;
          padding: 12px;
          outline: none;
        }

        .bms-paste-target:focus {
          border-color: #1683e8;
          box-shadow: 0 0 0 3px rgba(22, 131, 232, 0.14);
        }

        .bms-paste-target strong,
        .bms-paste-target span {
          display: block;
        }

        .bms-paste-target strong {
          margin-bottom: 3px;
          color: #20242b;
          font-size: 13px;
        }

        .bms-paste-target span {
          color: #66707d;
          font-size: 12px;
          font-weight: 500;
          line-height: 1.45;
        }

        .bms-pasted-image-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .bms-pasted-image-row {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr) auto;
          align-items: center;
          gap: 9px;
          width: 100%;
          border: 1px solid #dfe3e8;
          border-radius: 8px;
          background: #ffffff;
          padding: 8px;
          font-size: 12px;
          font-weight: 600;
        }

        .bms-pasted-image-row img {
          width: 44px;
          height: 44px;
          border-radius: 7px;
          object-fit: cover;
          background: #eef2f6;
        }

        .bms-pasted-image-row span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .bms-pasted-image-row button {
          min-height: 30px;
          padding: 5px 9px;
        }

        .bms-image-row {
          display: grid;
          grid-template-columns: 16px 44px minmax(0, 1fr);
          align-items: center;
          gap: 9px;
          width: 100%;
          border: 1px solid #dfe3e8;
          border-radius: 8px;
          background: #ffffff;
          padding: 8px;
          font-size: 12px;
          font-weight: 600;
        }

        .bms-image-row img {
          width: 44px;
          height: 44px;
          border-radius: 7px;
          object-fit: cover;
          background: #eef2f6;
        }

        .bms-image-row span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .bms-muted {
          margin: 0;
          color: #66707d;
          font-size: 13px;
          font-weight: 500;
          line-height: 1.5;
        }

        .bms-button-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        button,
        .bms-button {
          min-height: 36px;
          border: 1px solid #dfe3e8;
          border-radius: 8px;
          background: #f7f8fa;
          color: #20242b;
          padding: 8px 12px;
          font: inherit;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .bms-primary {
          border-color: #1683e8;
          background: #1683e8;
          color: #ffffff;
        }

        [data-bms-status] {
          min-width: 0;
          margin: 0;
          color: #66707d;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.4;
        }

        [data-bms-status][data-kind="error"] {
          color: #b91c1c;
        }

        [data-bms-status][data-kind="success"] {
          color: #15803d;
        }

        [data-bms-status][data-kind="saving"] {
          color: #1683e8;
        }

        @media (max-width: 640px) {
          .bms-backdrop {
            padding: 10px;
          }

          .bms-grid {
            grid-template-columns: 1fr;
          }

          .bms-header,
          .bms-footer {
            align-items: stretch;
            flex-direction: column;
          }

          .bms-button-row {
            justify-content: stretch;
          }

          .bms-button-row button {
            flex: 1 1 auto;
          }
        }
      </style>
      <div class="bms-backdrop" data-bms-close>
        <section class="bms-panel" role="dialog" aria-modal="true" aria-label="Bookmark Saver" tabindex="-1" data-bms-panel>
          <header class="bms-header">
            <div class="bms-title-group">
              <p class="bms-kicker">Tampermonkey</p>
              <h2>Bookmark Saver</h2>
            </div>
            <button type="button" data-bms-close-button>닫기</button>
          </header>
          <div class="bms-body">
            <div class="bms-grid">
              <label>
                제목
                <input type="text" data-bms-title>
              </label>
              <label>
                URL
                <input type="url" data-bms-url>
              </label>
            </div>
            <label>
              메모 / 선택 텍스트
              <textarea data-bms-content></textarea>
            </label>
            <div class="bms-grid">
              <label>
                폴더
                <select data-bms-folder-id>
                  <option value="">폴더 없음</option>
                </select>
              </label>
              <label>
                기본 태그 ID
                <input type="text" data-bms-default-tag-ids placeholder="tag-1, tag-2">
              </label>
            </div>
            <div class="bms-check-row">
              <label class="bms-check">
                <input type="checkbox" data-bms-favorite>
                즐겨찾기
              </label>
              <label class="bms-check">
                <input type="checkbox" data-bms-hidden>
                숨김 북마크
              </label>
            </div>
            <section class="bms-field">
              <h3>태그</h3>
              <div class="bms-chip-list" data-bms-tags>
                <p class="bms-muted">태그 목록을 불러오는 중입니다.</p>
              </div>
            </section>
            <section class="bms-field">
              <h3>이미지 첨부</h3>
              <p class="bms-muted">선택한 이미지는 북마크 저장 뒤 첨부파일로 업로드합니다. 탭 스크린샷 캡처는 설치형 확장 전용 기능입니다.</p>
              <div class="bms-paste-target" tabindex="0" data-bms-paste-target>
                <strong>복사한 이미지 붙여넣기</strong>
                <span>이 패널 안에서 Ctrl+V를 누르면 클립보드 이미지가 첨부 목록에 추가됩니다.</span>
              </div>
              <div class="bms-pasted-image-list" data-bms-pasted-images></div>
              <div class="bms-image-list" data-bms-images></div>
            </section>
            <details ${settings.token ? "" : "open"}>
              <summary>연결 설정</summary>
              <div class="bms-stack">
                <label>
                  API 주소
                  <input type="url" data-bms-api-base-url>
                </label>
                <label>
                  확장 토큰
                  <textarea data-bms-token></textarea>
                </label>
                <label>
                  기본 폴더 ID
                  <input type="text" data-bms-default-folder-id>
                </label>
                <p class="bms-muted">Bookmark 웹앱의 확장 토큰 화면에서 자동 연결을 누르면 이 설정이 자동으로 저장됩니다.</p>
              </div>
            </details>
          </div>
          <footer class="bms-footer">
            <p data-bms-status></p>
            <div class="bms-button-row">
              <button type="button" data-bms-open-main>메인 페이지 열기</button>
              <button type="button" data-bms-save-settings>설정 저장</button>
              <button type="button" class="bms-primary" data-bms-save>북마크 저장</button>
            </div>
          </footer>
        </section>
      </div>
    `);

    const titleInput = root.querySelector("[data-bms-title]");
    const urlInput = root.querySelector("[data-bms-url]");
    const contentInput = root.querySelector("[data-bms-content]");
    const apiBaseUrlInput = root.querySelector("[data-bms-api-base-url]");
    const tokenInput = root.querySelector("[data-bms-token]");
    const defaultFolderInput = root.querySelector("[data-bms-default-folder-id]");
    const defaultTagInput = root.querySelector("[data-bms-default-tag-ids]");
    const folderSelect = root.querySelector("[data-bms-folder-id]");
    const tagContainer = root.querySelector("[data-bms-tags]");
    const imageContainer = root.querySelector("[data-bms-images]");
    const panel = root.querySelector("[data-bms-panel]");
    const pasteTarget = root.querySelector("[data-bms-paste-target]");
    const closePanel = () => {
      clearPastedImageFiles(root);
      host.remove();
    };

    titleInput.value = document.title || globalThis.location.href;
    urlInput.value = globalThis.location.href;
    contentInput.value = mode === "selection" ? selectedText : selectedText;
    apiBaseUrlInput.value = settings.apiBaseUrl;
    tokenInput.value = settings.token;
    defaultFolderInput.value = settings.defaultFolderId;
    defaultTagInput.value = settings.defaultTagIds.join(", ");

    PANEL_PASTED_FILES.set(root, []);
    appendImageCandidates(imageContainer, imageUrls);
    renderPastedImageFiles(root);

    panel.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    panel.addEventListener("paste", (event) => {
      const pastedFiles = getClipboardImageFiles(event);
      if (pastedFiles.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      addPastedImageFiles(root, pastedFiles);
    });
    pasteTarget.addEventListener("click", () => pasteTarget.focus());
    pasteTarget.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        pasteTarget.focus();
      }
    });
    setTimeout(() => panel.focus(), 0);
    root.querySelector("[data-bms-close]").addEventListener("click", closePanel);
    root.querySelector("[data-bms-close-button]").addEventListener("click", closePanel);
    root.querySelector("[data-bms-open-main]").addEventListener("click", () => openBookmarkMainPage());
    root.querySelector("[data-bms-save-settings]").addEventListener("click", () => {
      saveSettings({
        apiBaseUrl: apiBaseUrlInput.value,
        token: tokenInput.value,
        defaultFolderId: defaultFolderInput.value,
        defaultTagIds: defaultTagInput.value
      });
      setStatus(root, "설정을 저장했습니다.", "success");
    });
    root.querySelector("[data-bms-save]").addEventListener("click", () => {
      saveFromPanel(root).catch((error) => {
        setStatus(root, error instanceof Error ? error.message : "저장하지 못했습니다.", "error");
      });
    });

    if (!settings.token) {
      appendTagOptions(tagContainer, [], settings.defaultTagIds);
      setStatus(root, "토큰을 저장하면 북마크를 저장할 수 있습니다.", "error");
      return;
    }

    try {
      const [folders, tags] = await Promise.all([
        loadFolders(settings).catch(() => []),
        loadTags(settings).catch(() => [])
      ]);
      appendFolderOptions(folderSelect, folders, settings.defaultFolderId);
      appendTagOptions(tagContainer, tags, settings.defaultTagIds);
      setStatus(root, "저장할 내용을 확인해주세요.");
    } catch {
      appendTagOptions(tagContainer, [], settings.defaultTagIds);
      setStatus(root, "폴더와 태그 목록을 불러오지 못했습니다. 저장은 계속 시도할 수 있습니다.", "error");
    }
  }

  async function saveImmediate(mode) {
    const settings = loadSettings();
    const selectedText = normalizeSelectionText(globalThis.getSelection?.().toString() || "");

    if (mode === "selection" && !selectedText) {
      notify("선택한 텍스트가 없습니다.");
      return;
    }

    if (!settings.token) {
      notify("확장 토큰이 필요합니다. 설정 패널을 엽니다.");
      await openPanel(mode);
      return;
    }

    const payload = {
      url: globalThis.location.href,
      folderId: settings.defaultFolderId || null,
      tagIds: settings.defaultTagIds,
      userTitle: document.title || null,
      userContent: mode === "selection" ? selectedText || null : null,
      isFavorite: false,
      isHidden: false
    };

    await saveBookmark(settings, payload, []);
    notify("북마크를 저장했습니다.");
  }

  function announcePresence() {
    const pageWindow = getPageWindow();
    if (!isBookmarkWebOrigin(pageWindow)) {
      return;
    }

    pageWindow.postMessage(
      {
        source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
        type: "bookmark-extension:ready",
        clientType: BOOKMARK_EXTENSION_CLIENT_TYPE
      },
      getTargetOrigin(pageWindow)
    );
  }

  function attachBridge() {
    const pageWindow = getPageWindow();
    if (!isBookmarkWebOrigin(pageWindow)) {
      return;
    }

    pageWindow.addEventListener("message", (event) => {
      if (event.origin && event.origin !== getTargetOrigin(pageWindow)) {
        return;
      }

      const data = event.data;
      if (!data || typeof data !== "object" || data.source !== BOOKMARK_WEB_BRIDGE_SOURCE) {
        return;
      }

      if (data.type === "bookmark-extension:ping") {
        pageWindow.postMessage(
          {
            source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
            type: "bookmark-extension:pong",
            clientType: BOOKMARK_EXTENSION_CLIENT_TYPE
          },
          getTargetOrigin(pageWindow)
        );
        return;
      }

      if (
        data.type !== "bookmark-extension:configure" ||
        typeof data.requestId !== "string" ||
        !data.settings ||
        typeof data.settings !== "object"
      ) {
        return;
      }

      try {
        const apiBaseUrl = normalizeBaseUrl(data.settings.apiBaseUrl);
        const token = String(data.settings.token || "").trim();

        if (!apiBaseUrl || !token) {
          throw new Error("Invalid settings");
        }

        const savedSettings = saveSettings(
          {
            ...loadSettings(),
            apiBaseUrl,
            token
          },
          { requireScriptStorage: true }
        );

        if (savedSettings.token !== token || savedSettings.apiBaseUrl !== apiBaseUrl) {
          throw new Error("Settings verification failed");
        }

        pageWindow.postMessage(
          {
            source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
            type: "bookmark-extension:configured",
            requestId: data.requestId,
            clientType: BOOKMARK_EXTENSION_CLIENT_TYPE
          },
          getTargetOrigin(pageWindow)
        );
      } catch {
        pageWindow.postMessage(
          {
            source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
            type: "bookmark-extension:configure-failed",
            requestId: data.requestId,
            clientType: BOOKMARK_EXTENSION_CLIENT_TYPE
          },
          getTargetOrigin(pageWindow)
        );
      }
    });
  }

  function mountFloatingButton() {
    if (!document.documentElement) {
      return;
    }

    const { root } = createShadowHost(FLOATING_BUTTON_ID);
    setShadowHtml(root, `
      <style>
        :host {
          all: initial;
        }

        button {
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 2147483646;
          width: 44px;
          height: 44px;
          border: 1px solid rgba(255, 255, 255, 0.24);
          border-radius: 8px;
          background: #1683e8;
          color: #ffffff;
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.28);
          font: 800 18px/1 "Segoe UI", system-ui, sans-serif;
          cursor: pointer;
        }

        button:hover {
          background: #0f73d0;
        }
      </style>
      <button type="button" title="Bookmark Saver 열기" aria-label="Bookmark Saver 열기">B</button>
    `);
    root.querySelector("button").addEventListener("click", () => runAction(() => openPanel("page")));
  }

  function closeContextMenu() {
    removeElementById(CONTEXT_MENU_ID);
  }

  function getContextMenuPosition(event, width, height) {
    const margin = 10;
    const viewportWidth = globalThis.innerWidth || document.documentElement.clientWidth || width;
    const viewportHeight = globalThis.innerHeight || document.documentElement.clientHeight || height;

    return {
      left: Math.min(event.clientX, viewportWidth - width - margin),
      top: Math.min(event.clientY, viewportHeight - height - margin)
    };
  }

  function mountContextMenu() {
    if (!document.documentElement || isBookmarkWebOrigin(globalThis.window)) {
      return;
    }

    function openContextMenu(event) {
      event.preventDefault();
      event.stopPropagation();
      closeContextMenu();

      const { host, root } = createShadowHost(CONTEXT_MENU_ID);
      const position = getContextMenuPosition(event, 230, 230);
      host.style.position = "fixed";
      host.style.left = `${Math.max(10, position.left)}px`;
      host.style.top = `${Math.max(10, position.top)}px`;
      host.style.zIndex = "2147483647";

      setShadowHtml(root, `
        <style>
          :host {
            all: initial;
            color-scheme: light;
            font-family: Inter, "Segoe UI", system-ui, sans-serif;
          }

          *, *::before, *::after {
            box-sizing: border-box;
          }

          .bms-menu {
            width: 230px;
            border: 1px solid #dfe3e8;
            border-radius: 8px;
            background: #ffffff;
            color: #20242b;
            box-shadow: 0 18px 44px rgba(15, 23, 42, 0.26);
            padding: 6px;
          }

          .bms-menu-title {
            margin: 0;
            padding: 7px 8px 6px;
            color: #66707d;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0;
          }

          button {
            display: flex;
            width: 100%;
            min-height: 34px;
            align-items: center;
            justify-content: flex-start;
            border: 0;
            border-radius: 7px;
            background: transparent;
            color: #20242b;
            padding: 7px 8px;
            font: 700 13px/1.3 "Segoe UI", system-ui, sans-serif;
            text-align: left;
            cursor: pointer;
          }

          button:hover {
            background: #eef6ff;
            color: #0f5fb9;
          }

          .bms-menu-hint {
            margin: 4px 0 0;
            border-top: 1px solid #edf0f4;
            padding: 7px 8px 4px;
            color: #7a8493;
            font-size: 11px;
            line-height: 1.35;
          }
        </style>
        <div class="bms-menu" role="menu" aria-label="Bookmark Saver 메뉴">
          <p class="bms-menu-title">Bookmark Saver</p>
          <button type="button" role="menuitem" data-bms-context-open-panel>저장 패널 열기</button>
          <button type="button" role="menuitem" data-bms-context-save-page>현재 페이지 바로 저장</button>
          <button type="button" role="menuitem" data-bms-context-save-selection>선택 텍스트 저장</button>
          <button type="button" role="menuitem" data-bms-context-open-main>메인 페이지 열기</button>
          <p class="bms-menu-hint">일반 우클릭은 기본 메뉴, Shift + 우클릭은 Bookmark 메뉴를 엽니다.</p>
        </div>
      `);

      root.querySelector("[data-bms-context-open-panel]").addEventListener("click", () => {
        closeContextMenu();
        runAction(() => openPanel("page"));
      });
      root.querySelector("[data-bms-context-save-page]").addEventListener("click", () => {
        closeContextMenu();
        saveImmediate("page").catch((error) =>
          notify(error instanceof Error ? error.message : "저장하지 못했습니다.")
        );
      });
      root.querySelector("[data-bms-context-save-selection]").addEventListener("click", () => {
        closeContextMenu();
        saveImmediate("selection").catch((error) =>
          notify(error instanceof Error ? error.message : "선택 텍스트를 저장하지 못했습니다.")
        );
      });
      root.querySelector("[data-bms-context-open-main]").addEventListener("click", () => {
        closeContextMenu();
        openBookmarkMainPage();
      });
    }

    document.addEventListener(
      "mousedown",
      (event) => {
        if (!event.shiftKey || event.button !== 2) {
          return;
        }

        openContextMenu(event);
      },
      true
    );

    document.addEventListener(
      "contextmenu",
      (event) => {
        if (!event.shiftKey) {
          closeContextMenu();
          return;
        }

        openContextMenu(event);
      },
      true
    );

    document.addEventListener("click", () => closeContextMenu(), true);
    document.addEventListener("scroll", () => closeContextMenu(), true);
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") {
          closeContextMenu();
        }
      },
      true
    );
  }

  function registerMenus() {
    if (typeof GM_registerMenuCommand !== "function") {
      return;
    }

    GM_registerMenuCommand("Bookmark 메인 페이지 열기", () => runAction(() => openBookmarkMainPage()));
    GM_registerMenuCommand("Bookmark Saver 저장 패널 열기", () => runAction(() => openPanel("page")));
    GM_registerMenuCommand("현재 페이지 바로 저장", () => {
      runAction(() => saveImmediate("page"));
    });
    GM_registerMenuCommand("선택 텍스트 저장", () => {
      runAction(() => saveImmediate("selection"));
    });
    GM_registerMenuCommand("Bookmark Saver 설정", () => runAction(() => openPanel("settings")));
  }

  attachBridge();
  announcePresence();
  registerMenus();
  mountContextMenu();

  globalThis.addEventListener("keydown", (event) => {
    if (event.altKey && event.shiftKey && event.code === "KeyB") {
      event.preventDefault();
      runAction(() => openPanel("page"));
    }
  });
})();
