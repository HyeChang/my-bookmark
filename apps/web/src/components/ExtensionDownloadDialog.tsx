import "./ExtensionDialogs.css";

type ExtensionDownloadDialogProps = {
  extensionDownloadPath: string;
  userscriptDownloadPath: string;
  userscriptCopyStatus: string | null;
  onClose: () => void;
  onUserscriptCodeCopy: () => void;
};

export default function ExtensionDownloadDialog({
  extensionDownloadPath,
  userscriptDownloadPath,
  userscriptCopyStatus,
  onClose,
  onUserscriptCodeCopy
}: ExtensionDownloadDialogProps) {
  return (
    <div className="overlay-backdrop" onClick={() => onClose()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="extension-download-dialog"
        className="surface-card overlay-dialog-shell extension-download-dialog-shell"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="overlay-dialog-header">
          <div className="overlay-dialog-title">
            <p className="workspace-panel-kicker">확장</p>
            <h2>브라우저 확장 다운로드</h2>
          </div>
          <button type="button" className="ghost-button" onClick={() => onClose()}>
            닫기
          </button>
        </div>
        <div className="overlay-dialog-panel extension-download-panel extension-download-panel-readable">
          <section className="surface-card extension-download-card extension-download-card-readable">
            <div className="bookmark-composer-section-header">
              <h3>설치 파일</h3>
              <p>Chrome 또는 Edge에서 직접 불러올 수 있는 압축 파일입니다.</p>
            </div>
            <a className="primary-button extension-download-link" href={extensionDownloadPath} download>
              확장 다운로드 (.zip)
            </a>
          </section>
          <section className="surface-card extension-download-card extension-download-card-readable">
            <div className="bookmark-composer-section-header">
              <h3>Tampermonkey 스크립트</h3>
              <p>
                Tampermonkey가 설치된 브라우저에서 페이지, 선택 텍스트, 페이지 이미지를
                Bookmark로 저장할 수 있는 userscript입니다.
              </p>
            </div>
            <div className="action-row extension-download-actions">
              <a
                className="primary-button extension-download-link"
                href={userscriptDownloadPath}
                target="_blank"
                rel="noreferrer"
              >
                Tampermonkey 스크립트 열기
              </a>
              <a
                className="secondary-button extension-download-link"
                href={userscriptDownloadPath}
                download="bookmark-saver.user.js"
              >
                파일 다운로드
              </a>
              <button
                type="button"
                className="secondary-button"
                onClick={() => onUserscriptCodeCopy()}
              >
                스크립트 코드 복사
              </button>
            </div>
            {userscriptCopyStatus ? (
              <p className="extension-token-connection-status">{userscriptCopyStatus}</p>
            ) : null}
          </section>
          <section className="surface-card extension-download-card extension-download-card-readable">
            <div className="bookmark-composer-section-header">
              <h3>Tampermonkey 사용 방법</h3>
              <p>
                설치형 확장 대신 userscript로 저장 기능을 연결하는 절차입니다. 브라우저가
                직접 추가를 막으면 복사 또는 다운로드 방식으로 설치하세요.
              </p>
            </div>
            <ol className="extension-download-steps">
              <li>브라우저에 Tampermonkey를 설치합니다.</li>
              <li>Tampermonkey 스크립트 열기를 눌러 설치 화면이 뜨면 설치합니다.</li>
              <li>
                추가할 수 없다는 브라우저 메시지가 뜨면 스크립트 코드 복사를 누른 뒤
                Tampermonkey 대시보드의 <code>+</code>에서 붙여넣고 저장합니다.
              </li>
              <li>확장 토큰 화면에서 자동 연결을 누르면 API 주소와 토큰이 저장됩니다.</li>
              <li>다른 웹페이지에서 Shift + 우클릭 또는 Tampermonkey 메뉴로 저장합니다.</li>
            </ol>
          </section>
          <section className="surface-card extension-download-card extension-download-card-readable">
            <div className="bookmark-composer-section-header">
              <h3>설치 방법</h3>
              <p>스토어 등록 전에는 개발자 모드에서 압축을 해제한 뒤 불러와야 합니다.</p>
            </div>
            <ol className="extension-download-steps">
              <li>다운로드한 zip 파일을 압축 해제합니다.</li>
              <li>
                Chrome은 <code>chrome://extensions</code>, Edge는{" "}
                <code>edge://extensions</code>로 이동합니다.
              </li>
              <li>개발자 모드를 켠 뒤 압축해제된 확장 프로그램 로드를 누릅니다.</li>
              <li>압축을 푼 폴더를 선택하면 바로 사용할 수 있습니다.</li>
            </ol>
          </section>
        </div>
      </section>
    </div>
  );
}
