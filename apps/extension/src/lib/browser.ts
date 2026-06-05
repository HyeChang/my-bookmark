export async function closeCurrentExtensionView() {
  const chromeApi = (globalThis as { chrome?: any }).chrome;

  if (chromeApi?.tabs?.getCurrent && chromeApi?.tabs?.remove) {
    const currentTab = await chromeApi.tabs.getCurrent().catch(() => null);
    if (currentTab?.id) {
      await chromeApi.tabs.remove(currentTab.id);
      return;
    }
  }

  if (globalThis.window?.close) {
    globalThis.window.close();
  }
}

export async function openUrlInNewTab(url: string) {
  const chromeApi = (globalThis as { chrome?: any }).chrome;

  if (chromeApi?.tabs?.create) {
    await chromeApi.tabs.create({ url });
    return;
  }

  if (globalThis.window?.open) {
    globalThis.window.open(url, "_blank", "noopener,noreferrer");
  }
}
