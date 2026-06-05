import { useState, type FormEvent } from "react";
import "./OverlayDialog.css";
import "./MemoLockDialog.css";

export type MemoLockDialogMode = "setup" | "unlock";

export type MemoLockDialogProps = {
  errorMessage: string | null;
  isBusy: boolean;
  mode: MemoLockDialogMode;
  onClose: () => void;
  onSubmit: (password: string) => void | Promise<void>;
};

const MEMO_LOCK_MIN_PASSWORD_LENGTH = 4;

export default function MemoLockDialog({
  errorMessage,
  isBusy,
  mode,
  onClose,
  onSubmit
}: MemoLockDialogProps) {
  const [password, setPassword] = useState("");
  const isSetup = mode === "setup";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit(password);
  }

  return (
    <div className="overlay-backdrop memo-lock-backdrop" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={isSetup ? "메모 잠금 설정" : "메모 잠금 해제"}
        className="memo-lock-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="memo-lock-header">
          <div>
            <p className="memo-lock-kicker">메모 잠금</p>
            <h2>{isSetup ? "비밀번호 설정" : "잠금 메모 보기"}</h2>
          </div>
          <button
            type="button"
            className="ghost-button memo-lock-close-button"
            aria-label="메모 잠금 닫기"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <p className="memo-lock-description">
          {isSetup
            ? "잠금 메모를 보호할 이 계정의 비밀번호를 설정합니다."
            : "비밀번호를 입력하면 잠금 메모가 현재 세션에서 표시됩니다."}
        </p>
        <form className="memo-lock-form" onSubmit={handleSubmit}>
          <label className="memo-lock-field">
            <span>비밀번호</span>
            <input
              type="password"
              autoComplete={isSetup ? "new-password" : "current-password"}
              minLength={MEMO_LOCK_MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
          </label>
          {errorMessage ? (
            <p className="memo-lock-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <div className="memo-lock-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              취소
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isBusy || password.length < MEMO_LOCK_MIN_PASSWORD_LENGTH}
            >
              {isBusy ? "처리 중..." : isSetup ? "설정" : "잠금 해제"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
