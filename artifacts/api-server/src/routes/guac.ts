import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

router.post("/guac/token", async (req: Request, res: Response): Promise<void> => {
  const baseUrlRaw = process.env["GUACAMOLE_URL"];
  const username = process.env["GUACAMOLE_USERNAME"];
  const password = process.env["GUACAMOLE_PASSWORD"];

  if (!baseUrlRaw || !username || !password) {
    req.log.warn(
      { hasUrl: !!baseUrlRaw, hasUser: !!username, hasPass: !!password },
      "Guacamole credentials not configured",
    );
    res.status(503).json({ error: "Guacamole server is not configured on this instance." });
    return;
  }

  const baseUrl = normalizeBaseUrl(baseUrlRaw);

  try {
    const body = new URLSearchParams({ username, password }).toString();
    const upstream = await fetch(`${baseUrl}/api/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      req.log.error({ status: upstream.status, body: text.slice(0, 500) }, "Guacamole token request failed");
      res.status(503).json({ error: `Guacamole rejected auth (HTTP ${upstream.status}).` });
      return;
    }

    const json = (await upstream.json()) as { authToken?: string; dataSource?: string };
    if (!json.authToken) {
      req.log.error({ json }, "Guacamole response missing authToken");
      res.status(503).json({ error: "Guacamole returned no auth token." });
      return;
    }

    // Return a SAME-ORIGIN path, not the internal Guacamole URL. The browser
    // will open the tunnel through our /api/guac-proxy reverse proxy so the
    // WebSocket uses wss:// matching the page's origin (no mixed-content
    // block) and the internal Guacamole IP stays private to the LAN.
    res.json({
      authToken: json.authToken,
      dataSource: json.dataSource ?? "mysql",
      baseUrl: "/api/guac-proxy",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to reach Guacamole server");
    res.status(503).json({ error: "Could not reach Guacamole server." });
  }
});

export default router;
