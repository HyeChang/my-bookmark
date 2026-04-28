import type { ExtensionToken } from "@bookmark/shared";

type ExtensionTokenDialogProps = {
  tokens: ExtensionToken[];
  tokenLabelDraft: string;
  latestIssuedToken: string | null;
  connectionMessage: string | null;
  isConnecting: boolean;
  onClose: () => void;
  onTokenLabelDraftChange: (value: string) => void;
  onTokenCreate: () => void | Promise<void>;
  onAutoConnect: () => void | Promise<void>;
  onTokenRevoke: (tokenId: string) => void | Promise<void>;
};

export default function ExtensionTokenDialog({
  tokens,
  tokenLabelDraft,
  latestIssuedToken,
  connectionMessage,
  isConnecting,
  onClose,
  onTokenLabelDraftChange,
  onTokenCreate,
  onAutoConnect,
  onTokenRevoke
}: ExtensionTokenDialogProps) {
  return (
    <div className="overlay-backdrop" onClick={() => onClose()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="extension-token-dialog"
        className="surface-card overlay-dialog-shell extension-token-dialog-shell"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="overlay-dialog-header">
          <div className="overlay-dialog-title">
            <p className="workspace-panel-kicker">확장</p>
            <h2>확장 토큰 관리</h2>
          </div>
          <button type="button" className="ghost-button" onClick={() => onClose()}>
            닫기
          </button>
        </div>
        <div className="overlay-dialog-panel extension-token-panel extension-token-panel-readable">
          <section className="surface-card extension-token-create-card extension-token-card-readable">
            <div className="bookmark-composer-section-header">
              <h3>새 토큰</h3>
              <p>Chrome/Edge 확장에서 사용할 토큰을 발급합니다.</p>
            </div>
            <label>
              토큰 이름
              <input
                name="extensionTokenLabel"
                value={tokenLabelDraft}
                onChange={(event) => onTokenLabelDraftChange(event.target.value)}
                placeholder="예: Chrome desktop"
              />
            </label>
            <div className="action-row">
              <button type="button" className="primary-button" onClick={() => void onTokenCreate()}>
                토큰 발급
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={isConnecting}
                onClick={() => void onAutoConnect()}
              >
                {isConnecting ? "연결 중..." : "확장 자동 연결"}
              </button>
            </div>
            {connectionMessage ? (
              <p className="extension-token-connection-status">{connectionMessage}</p>
            ) : null}
          </section>
          {latestIssuedToken ? (
            <section className="surface-card extension-token-secret-card extension-token-card-readable">
              <div className="bookmark-composer-section-header">
                <h3>방금 발급한 토큰</h3>
                <p>이 값은 지금만 다시 확인할 수 있습니다.</p>
              </div>
              <code>{latestIssuedToken}</code>
            </section>
          ) : null}
          <section className="surface-card extension-token-list-card extension-token-card-readable">
            <div className="bookmark-composer-section-header">
              <h3>발급된 토큰</h3>
              <p>사용하지 않는 토큰은 바로 폐기할 수 있습니다.</p>
            </div>
            {tokens.length > 0 ? (
              <ul className="extension-token-list">
                {tokens.map((token) => (
                  <li key={token.id} className="extension-token-row extension-token-row-readable">
                    <div className="extension-token-copy">
                      <strong>{token.label}</strong>
                      <span>{new Date(token.createdAt).toLocaleString("ko-KR")}</span>
                    </div>
                    <button
                      type="button"
                      className="ghost-button"
                      aria-label={`${token.label} 토큰 삭제`}
                      onClick={() => void onTokenRevoke(token.id)}
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-text">아직 발급한 확장 토큰이 없습니다.</p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
