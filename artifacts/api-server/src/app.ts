import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import pinoHttp from "pino-http";
import { createProxyMiddleware, type Options as ProxyOptions } from "http-proxy-middleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ── Guacamole reverse proxy.
// The browser must NOT talk to the internal Guacamole server directly — when
// LineDeck is served over HTTPS, a plain ws:// tunnel to the LAN IP is a
// mixed-content violation ("operation is insecure") and gets blocked. We
// proxy /api/guac-proxy/* (incl. WebSocket upgrade for /websocket-tunnel) to
// the configured GUACAMOLE_URL so the browser only ever talks same-origin.
//
// Mounted BEFORE express.json/urlencoded so request bodies aren't consumed,
// and BEFORE the /api router so /api/guac-proxy doesn't fall into the
// per-route 404 handler.
const guacUpstream = process.env["GUACAMOLE_URL"]?.replace(/\/+$/, "");
export const guacProxy = guacUpstream
  ? createProxyMiddleware({
      target: guacUpstream,
      changeOrigin: true,
      ws: true,
      pathRewrite: { "^/api/guac-proxy": "" },
      logger,
    } satisfies ProxyOptions)
  : null;
if (guacProxy) {
  app.use("/api/guac-proxy", guacProxy);
  logger.info({ target: guacUpstream }, "Guacamole reverse proxy enabled at /api/guac-proxy");
} else {
  logger.warn("GUACAMOLE_URL not set — /api/guac-proxy disabled");
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ── Static serving of the React console build (production / docker).
// Resolved from STATIC_DIR or ./public relative to the API server's cwd.
// In dev (vite dev server runs separately) the dir won't exist and we skip.
const staticDir = path.resolve(
  process.cwd(),
  process.env["STATIC_DIR"] ?? "./public",
);
if (fs.existsSync(staticDir)) {
  logger.info({ staticDir }, "Serving static console build");
  app.use(
    express.static(staticDir, {
      index: false,
      maxAge: "1y",
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );
  // SPA fallback — GET requests for HTML navigations serve index.html.
  // Excludes /api and /api/* (let the router 404) and non-HTML requests so
  // missing static assets return a real 404 instead of an HTML body.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();
    if (req.path === "/api" || req.path.startsWith("/api/")) return next();
    if (!req.accepts("html")) return next();
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
