import { Hono } from "hono";

import type { HealthResponse } from "@bookmark/shared";

export const healthRoute = new Hono().get("/", (c) => {
  return c.json<HealthResponse>({ ok: true });
});
