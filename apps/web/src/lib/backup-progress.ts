export type BackupProgressSnapshot = {
  message: string;
  current?: number;
  total?: number;
  percent?: number;
};

export type BackupProgressReporter = (progress: BackupProgressSnapshot) => void;

export type BackupOperationKind =
  | "bookmark-export"
  | "bookmark-import"
  | "memo-export"
  | "memo-import";

export type BackupOperationProgress = BackupProgressSnapshot & {
  kind: BackupOperationKind;
  title: string;
};

export function getBackupProgressPercent(progress: BackupProgressSnapshot) {
  if (typeof progress.percent === "number" && Number.isFinite(progress.percent)) {
    return Math.min(100, Math.max(0, progress.percent));
  }

  if (
    typeof progress.current === "number" &&
    typeof progress.total === "number" &&
    progress.total > 0
  ) {
    return Math.min(100, Math.max(0, (progress.current / progress.total) * 100));
  }

  return null;
}
