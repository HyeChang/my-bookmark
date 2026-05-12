import { Hono } from "hono";

const allowedMetrics = new Set([
  "navigation",
  "first-contentful-paint",
  "largest-contentful-paint",
  "layout-shift",
  "interaction"
]);
const allowedRatings = new Set(["good", "needs-improvement", "poor"]);
const allowedNavigationTypes = new Set([
  "navigate",
  "reload",
  "back_forward",
  "prerender"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRumMetric(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  const metric = payload.metric;
  const value = payload.value;
  const rating = payload.rating;
  const navigation = payload.navigation;

  if (
    typeof metric !== "string" ||
    !allowedMetrics.has(metric) ||
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    typeof rating !== "string" ||
    !allowedRatings.has(rating)
  ) {
    return null;
  }

  if (
    navigation !== undefined &&
    (typeof navigation !== "string" || !allowedNavigationTypes.has(navigation))
  ) {
    return null;
  }

  return {
    metric,
    value: Math.round(value * 100) / 100,
    rating,
    ...(typeof navigation === "string" ? { navigation } : {})
  };
}

export const rumRoute = new Hono().post("/", async (c) => {
  let payload: unknown;

  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid RUM metric" }, 400);
  }

  const metric = parseRumMetric(payload);
  if (!metric) {
    return c.json({ error: "Invalid RUM metric" }, 400);
  }

  console.info("bookmark.rum", JSON.stringify(metric));
  return c.body(null, 204);
});
