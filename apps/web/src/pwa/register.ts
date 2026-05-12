function registerServiceWorker() {
  void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}

export function registerPwaServiceWorker() {
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) {
    return;
  }

  if (document.readyState === "complete") {
    registerServiceWorker();
    return;
  }

  globalThis.addEventListener("load", registerServiceWorker, { once: true });
}
