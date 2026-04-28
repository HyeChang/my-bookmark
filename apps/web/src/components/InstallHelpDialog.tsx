type InstallHelpDialogProps = {
  onClose: () => void;
};

export default function InstallHelpDialog({ onClose }: InstallHelpDialogProps) {
  return (
    <div className="overlay-backdrop" onClick={() => onClose()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="install-help-dialog"
        className="surface-card overlay-dialog-shell install-help-dialog-shell"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="overlay-dialog-header">
          <div className="overlay-dialog-title">
            <p className="workspace-panel-kicker">설치</p>
            <h2>모바일 앱 설치 방법</h2>
          </div>
          <button type="button" className="ghost-button" onClick={() => onClose()}>
            닫기
          </button>
        </div>
        <div className="overlay-dialog-panel extension-download-panel extension-download-panel-readable install-help-panel-readable">
          <section className="surface-card extension-download-card extension-download-card-readable">
            <div className="bookmark-composer-section-header">
              <h3>Android Chrome/Edge</h3>
              <p>브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택하면 됩니다.</p>
            </div>
            <ol className="extension-download-steps">
              <li>상단 또는 하단의 브라우저 메뉴를 엽니다.</li>
              <li>
                <code>앱 설치</code>, <code>홈 화면에 추가</code>, <code>설치</code> 중 하나를 누릅니다.
              </li>
              <li>홈 화면에 생긴 Bookmark 아이콘으로 바로 실행합니다.</li>
            </ol>
          </section>
          <section className="surface-card extension-download-card extension-download-card-readable">
            <div className="bookmark-composer-section-header">
              <h3>iPhone / iPad Safari</h3>
              <p>Safari에서는 공유 메뉴를 통해 설치형 웹앱으로 추가합니다.</p>
            </div>
            <ol className="extension-download-steps">
              <li>Safari에서 현재 페이지를 연 상태로 하단 공유 버튼을 누릅니다.</li>
              <li>
                <code>홈 화면에 추가</code>를 선택합니다.
              </li>
              <li>이름을 확인하고 추가하면 앱처럼 실행할 수 있습니다.</li>
            </ol>
          </section>
        </div>
      </section>
    </div>
  );
}
