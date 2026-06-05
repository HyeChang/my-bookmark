import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import { closeCurrentExtensionView } from "../lib/browser";
import {
  defaultExtensionSettings,
  formatDefaultTagIdsInput,
  loadExtensionSettings,
  parseDefaultTagIdsInput,
  saveExtensionSettings,
  type ExtensionFastSaveMode
} from "../lib/storage";

function OptionsApp() {
  const [apiBaseUrl, setApiBaseUrl] = useState(defaultExtensionSettings.apiBaseUrl);
  const [token, setToken] = useState(defaultExtensionSettings.token);
  const [defaultFolderId, setDefaultFolderId] = useState(defaultExtensionSettings.defaultFolderId);
  const [defaultTagIdsInput, setDefaultTagIdsInput] = useState("");
  const [fastSaveMode, setFastSaveMode] = useState<ExtensionFastSaveMode>("popup");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadExtensionSettings().then((settings) => {
      setApiBaseUrl(settings.apiBaseUrl);
      setToken(settings.token);
      setDefaultFolderId(settings.defaultFolderId);
      setDefaultTagIdsInput(formatDefaultTagIdsInput(settings.defaultTagIds));
      setFastSaveMode(settings.fastSaveMode);
    });
  }, []);

  async function handleSave() {
    await saveExtensionSettings({
      apiBaseUrl,
      token,
      defaultFolderId,
      defaultTagIds: parseDefaultTagIdsInput(defaultTagIdsInput),
      fastSaveMode
    });

    setStatusMessage("확장 설정을 저장했습니다.");
  }

  async function handleSaveAndClose() {
    await handleSave();
    await closeCurrentExtensionView();
  }

  return (
    <main
      style={{
        margin: 0,
        minHeight: "100vh",
        padding: 24,
        fontFamily: "Segoe UI, sans-serif",
        background: "#f3f6fb",
        color: "#0f172a",
        display: "flex",
        flexDirection: "column",
        gap: 16
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 10px", fontSize: 24 }}>Bookmark Saver 설정</h1>
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
            확장 토큰, 기본 폴더, 기본 태그, 빠른 저장 동작을 저장합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void closeCurrentExtensionView()}
          style={{
            borderRadius: 12,
            border: "1px solid #d9e2ec",
            background: "#ffffff",
            color: "#0f172a",
            padding: "10px 14px",
            fontWeight: 700
          }}
        >
          닫기
        </button>
      </header>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span>API 주소</span>
        <input
          value={apiBaseUrl}
          placeholder="https://your-worker.example.workers.dev"
          onChange={(event) => setApiBaseUrl(event.target.value)}
          style={{
            borderRadius: 12,
            border: "1px solid #d9e2ec",
            background: "#ffffff",
            color: "#0f172a",
            padding: "11px 12px"
          }}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span>확장 토큰</span>
        <textarea
          value={token}
          onChange={(event) => setToken(event.target.value)}
          rows={4}
          style={{
            borderRadius: 12,
            border: "1px solid #d9e2ec",
            background: "#ffffff",
            color: "#0f172a",
            padding: "11px 12px"
          }}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span>기본 폴더 ID</span>
        <input
          value={defaultFolderId}
          onChange={(event) => setDefaultFolderId(event.target.value)}
          style={{
            borderRadius: 12,
            border: "1px solid #d9e2ec",
            background: "#ffffff",
            color: "#0f172a",
            padding: "11px 12px"
          }}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span>기본 태그 ID</span>
        <input
          value={defaultTagIdsInput}
          placeholder="tag-1, tag-2"
          onChange={(event) => setDefaultTagIdsInput(event.target.value)}
          style={{
            borderRadius: 12,
            border: "1px solid #d9e2ec",
            background: "#ffffff",
            color: "#0f172a",
            padding: "11px 12px"
          }}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span>빠른 저장 기본 동작</span>
        <select
          value={fastSaveMode}
          onChange={(event) => setFastSaveMode(event.target.value as ExtensionFastSaveMode)}
          style={{
            borderRadius: 12,
            border: "1px solid #d9e2ec",
            background: "#ffffff",
            color: "#0f172a",
            padding: "11px 12px"
          }}
        >
          <option value="popup">항상 팝업에서 확인</option>
          <option value="immediate">기본 설정으로 바로 저장</option>
        </select>
      </label>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="button"
          onClick={() => void handleSave()}
          style={{
            borderRadius: 12,
            border: "1px solid #d9e2ec",
            background: "#ffffff",
            color: "#0f172a",
            padding: "11px 14px",
            fontWeight: 700
          }}
        >
          설정 저장
        </button>
        <button
          type="button"
          onClick={() => void handleSaveAndClose()}
          style={{
            borderRadius: 12,
            border: "none",
            background: "#2563eb",
            color: "#ffffff",
            padding: "11px 14px",
            fontWeight: 700
          }}
        >
          저장 후 닫기
        </button>
      </div>

      {statusMessage ? <p style={{ margin: 0, color: "#166534" }}>{statusMessage}</p> : null}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>
);
