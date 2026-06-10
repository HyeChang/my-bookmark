import type { CSSProperties } from "react";
import {
  getBackupProgressPercent,
  type BackupOperationProgress
} from "../lib/backup-progress";

export type BackupProgressIndicatorProps = {
  progress: BackupOperationProgress;
};

export default function BackupProgressIndicator({ progress }: BackupProgressIndicatorProps) {
  const percent = getBackupProgressPercent(progress);
  const roundedPercent = percent === null ? null : Math.round(percent);
  const progressStyle =
    roundedPercent === null
      ? undefined
      : ({
          "--backup-progress-percent": `${roundedPercent}%`
        } as CSSProperties);

  return (
    <section
      className="backup-progress-indicator"
      role="status"
      aria-label="백업 작업 진행"
      aria-live="polite"
    >
      <div className="backup-progress-copy">
        <p className="backup-progress-title">{progress.title}</p>
        <p className="backup-progress-message">{progress.message}</p>
      </div>
      <div className="backup-progress-meta">
        {typeof progress.current === "number" && typeof progress.total === "number" ? (
          <span className="backup-progress-count">
            {progress.current} / {progress.total}
          </span>
        ) : roundedPercent !== null ? (
          <span className="backup-progress-count">{roundedPercent}%</span>
        ) : null}
      </div>
      <div
        className={`backup-progress-bar${
          roundedPercent === null ? " backup-progress-bar-indeterminate" : ""
        }`}
        role="progressbar"
        aria-label={`${progress.title} 진행률`}
        aria-valuemin={roundedPercent === null ? undefined : 0}
        aria-valuemax={roundedPercent === null ? undefined : 100}
        aria-valuenow={roundedPercent === null ? undefined : roundedPercent}
      >
        <span className="backup-progress-bar-fill" style={progressStyle} />
      </div>
    </section>
  );
}
