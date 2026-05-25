import http from "node:http";
import app, { guacProxy } from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

// Wire WebSocket upgrade through the Guacamole proxy so /api/guac-proxy/
// websocket-tunnel reaches guacamole's WebSocket endpoint. Without this,
// browser tunnel connections silently fail with a 400/upgrade error.
const upgrade = guacProxy?.upgrade;
if (upgrade) {
  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/api/guac-proxy")) {
      // http-proxy-middleware's upgrade typing wants a net.Socket; the actual
      // emitted value is a Duplex that is a net.Socket at runtime. Safe cast.
      upgrade(req, socket as never, head);
    }
  });
}

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});
server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
