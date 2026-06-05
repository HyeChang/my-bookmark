export function getInitialPageContent(
  pendingUserContent: string | null | undefined,
  selectedText: string | null | undefined
) {
  return pendingUserContent || selectedText || "";
}

export function getPageContentHelperText(selectedText: string | null | undefined) {
  if (selectedText && selectedText.trim()) {
    return "선택한 텍스트가 자동으로 채워졌고, 지금 바로 수정할 수 있습니다.";
  }

  return "직접 페이지 내용을 입력하거나, 선택한 텍스트를 붙여넣어 저장할 수 있습니다.";
}
