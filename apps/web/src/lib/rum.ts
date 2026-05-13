type RumMetricName =
  | "navigation"
  | "first-contentful-paint"
  | "largest-contentful-paint"
  | "layout-shift"
  | "interaction"
  | "dashboard-data-refresh"
  | "dashboard-bookmark-list-view-models"
  | "dashboard-panel-preload"
  | "dashboard-dialog-preload";

type RumMetricRating = "good" | "needs-improvement" | "poor";

type RumMetricPayload = {
  metric: RumMetricName;
  value: number;
  rating: RumMetricRating;
  navigation?: string;
  detail?: string;
};

let hasInitializedRealUserMonitoring = false;
let cumulativeLayoutShift = 0;
let longestInteraction = 0;
const DASHBOARD_DATA_REFRESH_MEASURE = "bookmark:dashboard:data-refresh";
const DASHBOARD_BOOKMARK_LIST_VIEW_MODELS_MEASURE =
  "bookmark:dashboard:bookmark-list-view-models";
const DASHBOARD_PANEL_PRELOAD_MEASURE_PREFIX = "bookmark:dashboard:panel-preload:";
const DASHBOARD_DIALOG_PRELOAD_MEASURE_PREFIX = "bookmark:dashboard:dialog-preload:";

function getRating(metric: RumMetricName, value: number): RumMetricRating {
  if (metric === "largest-contentful-paint") {
    return value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
  }

  if (metric === "layout-shift") {
    return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
  }

  if (metric === "interaction") {
    return value <= 200 ? "good" : value <= 500 ? "needs-improvement" : "poor";
  }

  if (metric === "first-contentful-paint") {
    return value <= 1800 ? "good" : value <= 3000 ? "needs-improvement" : "poor";
  }

  if (
    metric === "dashboard-data-refresh" ||
    metric === "dashboard-bookmark-list-view-models" ||
    metric === "dashboard-panel-preload" ||
    metric === "dashboard-dialog-preload"
  ) {
    return value <= 500 ? "good" : value <= 1500 ? "needs-improvement" : "poor";
  }

  return value <= 2500 ? "good" : value <= 4500 ? "needs-improvement" : "poor";
}

function normalizeMetricValue(value: number) {
  return Math.max(0, Math.round(value * 100) / 100);
}

function sendRumMetric(payload: RumMetricPayload) {
  const body = JSON.stringify({
    ...payload,
    value: normalizeMetricValue(payload.value)
  });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/api/rum", blob)) {
      return;
    }
  }

  if (typeof fetch === "function") {
    void fetch("/api/rum", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body,
      keepalive: true
    }).catch(() => undefined);
  }
}

function observePerformanceEntry(
  type: string,
  callback: (entries: PerformanceEntry[]) => void,
  options?: { durationThreshold?: number }
) {
  if (typeof PerformanceObserver !== "function") {
    return;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      callback(list.getEntries());
    });
    observer.observe({
      type,
      buffered: true,
      ...(options?.durationThreshold ? { durationThreshold: options.durationThreshold } : {})
    });
  } catch {
    // Older browsers may not support every metric type.
  }
}

function reportNavigationMetric() {
  const navigationEntry = performance
    .getEntriesByType("navigation")
    .find((entry): entry is PerformanceNavigationTiming => "duration" in entry);

  if (!navigationEntry) {
    return;
  }

  sendRumMetric({
    metric: "navigation",
    value: navigationEntry.duration,
    rating: getRating("navigation", navigationEntry.duration),
    navigation: navigationEntry.type
  });
}

function reportLayoutShiftMetric() {
  if (cumulativeLayoutShift <= 0) {
    return;
  }

  sendRumMetric({
    metric: "layout-shift",
    value: cumulativeLayoutShift,
    rating: getRating("layout-shift", cumulativeLayoutShift)
  });
}

function reportInteractionMetric() {
  if (longestInteraction <= 0) {
    return;
  }

  sendRumMetric({
    metric: "interaction",
    value: longestInteraction,
    rating: getRating("interaction", longestInteraction)
  });
}

function reportDashboardMeasureMetrics(entries: PerformanceEntry[]) {
  for (const entry of entries) {
    if (entry.name === DASHBOARD_DATA_REFRESH_MEASURE) {
      sendRumMetric({
        metric: "dashboard-data-refresh",
        value: entry.duration,
        rating: getRating("dashboard-data-refresh", entry.duration)
      });
      continue;
    }

    if (entry.name === DASHBOARD_BOOKMARK_LIST_VIEW_MODELS_MEASURE) {
      sendRumMetric({
        metric: "dashboard-bookmark-list-view-models",
        value: entry.duration,
        rating: getRating("dashboard-bookmark-list-view-models", entry.duration)
      });
      continue;
    }

    if (entry.name.startsWith(DASHBOARD_PANEL_PRELOAD_MEASURE_PREFIX)) {
      const detail = entry.name.slice(DASHBOARD_PANEL_PRELOAD_MEASURE_PREFIX.length);
      sendRumMetric({
        metric: "dashboard-panel-preload",
        value: entry.duration,
        rating: getRating("dashboard-panel-preload", entry.duration),
        detail
      });
      continue;
    }

    if (entry.name.startsWith(DASHBOARD_DIALOG_PRELOAD_MEASURE_PREFIX)) {
      const detail = entry.name.slice(DASHBOARD_DIALOG_PRELOAD_MEASURE_PREFIX.length);
      sendRumMetric({
        metric: "dashboard-dialog-preload",
        value: entry.duration,
        rating: getRating("dashboard-dialog-preload", entry.duration),
        detail
      });
    }
  }
}

export function initRealUserMonitoring() {
  if (
    import.meta.env.MODE === "test" ||
    hasInitializedRealUserMonitoring ||
    typeof window === "undefined" ||
    typeof performance === "undefined"
  ) {
    return;
  }

  hasInitializedRealUserMonitoring = true;

  observePerformanceEntry("paint", (entries) => {
    const firstContentfulPaint = entries.find(
      (entry) => entry.name === "first-contentful-paint"
    );

    if (firstContentfulPaint) {
      sendRumMetric({
        metric: "first-contentful-paint",
        value: firstContentfulPaint.startTime,
        rating: getRating("first-contentful-paint", firstContentfulPaint.startTime)
      });
    }
  });

  observePerformanceEntry("largest-contentful-paint", (entries) => {
    const latestEntry = entries.at(-1);
    if (!latestEntry) {
      return;
    }

    sendRumMetric({
      metric: "largest-contentful-paint",
      value: latestEntry.startTime,
      rating: getRating("largest-contentful-paint", latestEntry.startTime)
    });
  });

  observePerformanceEntry("layout-shift", (entries) => {
    for (const entry of entries) {
      const layoutShiftEntry = entry as PerformanceEntry & {
        hadRecentInput?: boolean;
        value?: number;
      };

      if (!layoutShiftEntry.hadRecentInput) {
        cumulativeLayoutShift += layoutShiftEntry.value ?? 0;
      }
    }
  });

  observePerformanceEntry(
    "event",
    (entries) => {
      for (const entry of entries) {
        longestInteraction = Math.max(longestInteraction, entry.duration);
      }
    },
    { durationThreshold: 40 }
  );

  observePerformanceEntry("measure", reportDashboardMeasureMetrics);

  window.addEventListener("load", reportNavigationMetric, { once: true });
  window.addEventListener("pagehide", () => {
    reportLayoutShiftMetric();
    reportInteractionMetric();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      reportLayoutShiftMetric();
      reportInteractionMetric();
    }
  });
}
