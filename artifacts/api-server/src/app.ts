import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
