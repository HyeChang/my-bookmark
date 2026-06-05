function slugifyTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildScreenshotFilename(pageTitle: string) {
  const slug = slugifyTitle(pageTitle);
  return slug ? `bookmark-${slug}.png` : "bookmark-capture.png";
}

export async function dataUrlToFile(dataUrl: string, filename: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, {
    type: blob.type || "image/png"
  });
}

export async function captureVisibleTabImage(windowId?: number) {
  const chromeApi = (globalThis as { chrome?: any }).chrome;
  if (!chromeApi?.tabs?.captureVisibleTab) {
    throw new Error("현재 브라우저는 스크린샷 캡처를 지원하지 않습니다.");
  }

  const dataUrl = await chromeApi.tabs.captureVisibleTab(windowId, {
    format: "png"
  });

  if (typeof dataUrl !== "string" || dataUrl.length === 0) {
    throw new Error("스크린샷을 캡처하지 못했습니다.");
  }

  return dataUrl;
}
