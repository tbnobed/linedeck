# ViP Dante VM Console

A broadcast operations console for monitoring Dante virtual audio machines (VMs) in a live grid, controlling line states (Idle / Standby / On Air) in real time across multiple operator machines, and managing guest labels — all synced via Server-Sent Events.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/console run dev` — run the React console frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Real-time: Server-Sent Events (SSE) via `/api/events`
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Frontend: React + Vite + Tailwind CSS (shadcn/ui)
- Build: esbuild (CJS bundle for API)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas (server-side validation)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks (frontend)
- `lib/db/src/schema/lines.ts` — lines table schema (line state per VM)
- `lib/db/src/schema/vms.ts` — vms table schema (VM configuration)
- `artifacts/api-server/src/routes/` — Express route handlers (lines, vms, events, health)
- `artifacts/api-server/src/lib/sse.ts` — in-process SSE fan-out broadcaster
- `artifacts/console/src/` — React frontend

## Architecture decisions

- SSE over WebSockets for real-time sync: simpler, proxy-friendly, one-way push from server is sufficient
- Lines keyed by arbitrary string ID (e.g. `vm-101`) not tied to the vms table — allows line state to exist even before a VM is configured
- PostgreSQL instead of SQLite — production-grade from day one, supports concurrent operators
- In-process SSE fan-out (no Redis) — sufficient for a handful of operators watching 10–12 VMs; documented scaling path if needed
- VMs are configurable at runtime via the `/vms` admin page — no hardcoded VM list

## Product

- **VM Grid console** (`/`) — grid of iframe VM tiles, each with line state pill (click to cycle idle/standby/on-air), editable guest label, and enlarge-to-modal
- **VM Configuration** (`/vms`) — add, edit, delete VMs with name, URL, phone number, and position
- **Real-time sync** — all connected operators see state changes within ~100ms via SSE

## Docker (Ubuntu server deployment)

```bash
cp docker/.env.example .env
# Edit .env: POSTGRES_PASSWORD, SESSION_SECRET, GUACAMOLE_URL/USERNAME/PASSWORD

docker compose up -d --build
# App available at http://<host>:${LINEDECK_HOST_PORT:-8090}
# Health: curl http://<host>:8090/api/healthz
```

Services:
- `db` — PostgreSQL, not published (internal-only on the `linedeck` network)
- `migrate` — one-shot, runs `drizzle-kit push` before `app` starts
- `app` — single Node container: Express API on `/api/*` AND serves the built React console as static files for everything else. Published on `LINEDECK_HOST_PORT` (default 8090).

Designed to coexist with other stacks on the same host: containers are prefixed `linedeck-*`, the internal DB is not exposed, and the host port is configurable so it never collides with other apps already on 80/5000. Front a domain at it with Nginx Proxy Manager (or any reverse proxy) by pointing the proxy host at `http://<host>:8090`.

NPM proxy host settings worth setting: enable **Websockets Support** (Guacamole tunnel) and add a custom location for `/api/events` with `proxy_buffering off;` and a long read timeout (e.g. `proxy_read_timeout 3600s;`) so SSE streams don't get buffered or cut.

### HTTPS / TLS (mkcert)

LineDeck runs on an internal hostname with no public DNS, so Let's Encrypt is not an option. We use [mkcert](https://github.com/FiloSottile/mkcert) to issue a locally-trusted cert and serve it from NPM. **HTTPS is required for clipboard sync** — browsers refuse `navigator.clipboard` on plain HTTP.

One-time on the docker host:

```bash
# Install mkcert + the local root CA
sudo apt install -y libnss3-tools
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64" && chmod +x mkcert-* && sudo mv mkcert-* /usr/local/bin/mkcert
mkcert -install

# Issue the LineDeck leaf cert (covers apex + wildcard under the parent zone)
cd ~/linedeck
mkcert line.trinity.local "*.trinity.local"

# Export the root CA for operator workstations
cp "$(mkcert -CAROOT)/rootCA.pem" ./linedeck-rootCA.crt
```

In NPM (**SSL Certificates → Add Custom Certificate**):
- **Certificate Key** ← `line.trinity.local+1-key.pem`
- **Certificate** ← `line.trinity.local+1.pem`
- Intermediate ← *empty*

Then on the proxy host: **SSL** tab → select that cert, enable **Force SSL** and **HTTP/2**. Do **not** paste `rootCA.pem` here — it has `keyUsage: keyCertSign` only and browsers will reject it with `ERR_SSL_KEY_USAGE_INCOMPATIBLE`.

Distribute `linedeck-rootCA.crt` to every operator workstation:
- **Windows (Chrome/Edge):** double-click → Install Certificate → Local Machine → Trusted Root Certification Authorities
- **Firefox:** has its own store. Either `about:config` → `security.enterprise_roots.enabled = true`, or import via Settings → Privacy & Security → View Certificates → Authorities → Import
- **macOS:** double-click → System keychain → "Always Trust" for SSL

### Guacamole reverse-proxy

The frontend connects to Guacamole through the API server at `/api/guac-proxy` (see `artifacts/api-server/src/app.ts` + `index.ts` for the WebSocket upgrade wiring). This keeps everything same-origin, so:
- An HTTPS page produces a `wss://` tunnel automatically (no mixed-content blocking)
- Operators don't need direct network access to the Guacamole server
- `GUACAMOLE_URL` only needs to be reachable from the LineDeck container, not the browser

## Gotchas

- After any `openapi.yaml` change, always run `pnpm --filter @workspace/api-spec run codegen` before working on frontend or backend
- SSE endpoint `/api/events` is NOT in the generated hooks — it's a custom `EventSource` in the frontend
- Nginx config has `proxy_buffering off` on `/api/events` — required for SSE to work through the reverse proxy
- `pnpm --filter @workspace/db run push` only affects dev; production DB migrations are handled by the Replit Publish flow

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
