import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

function schedulePwaServiceWorkerRegistration() {
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) {
    return;
  }

  const loadRegistrationModule = () => {
    void import("./pwa/register").then(({ registerPwaServiceWorker }) => {
      registerPwaServiceWorker();
    });
  };

  const scheduleRegistrationModuleLoad = () => {
    if (typeof globalThis.requestIdleCallback === "function") {
      globalThis.requestIdleCallback(loadRegistrationModule, { timeout: 2500 });
      return;
    }

    globalThis.setTimeout(loadRegistrationModule, 0);
  };

  if (document.readyState === "complete") {
    scheduleRegistrationModuleLoad();
    return;
  }

  globalThis.addEventListener("load", scheduleRegistrationModuleLoad, { once: true });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

schedulePwaServiceWorkerRegistration();
