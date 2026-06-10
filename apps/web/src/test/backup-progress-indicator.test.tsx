import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BackupProgressIndicator from "../components/BackupProgressIndicator";

describe("BackupProgressIndicator", () => {
  it("renders backup progress message and determinate progressbar", () => {
    render(
      <BackupProgressIndicator
        progress={{
          kind: "bookmark-export",
          title: "북마크 내보내기",
          message: "북마크 이미지 준비 중",
          current: 3,
          total: 6
        }}
      />
    );

    expect(screen.getByRole("status", { name: "백업 작업 진행" })).toHaveTextContent(
      "북마크 이미지 준비 중"
    );
    expect(screen.getByText("3 / 6")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "북마크 내보내기 진행률" })).toHaveAttribute(
      "aria-valuenow",
      "50"
    );
  });

  it("renders an indeterminate progressbar when progress percent is unknown", () => {
    render(
      <BackupProgressIndicator
        progress={{
          kind: "memo-import",
          title: "메모 불러오기",
          message: "메모 백업 파일 읽는 중"
        }}
      />
    );

    const progressbar = screen.getByRole("progressbar", { name: "메모 불러오기 진행률" });
    expect(progressbar).not.toHaveAttribute("aria-valuenow");
    expect(progressbar).toHaveClass("backup-progress-bar-indeterminate");
  });
});
