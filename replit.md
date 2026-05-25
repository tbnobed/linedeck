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
# Copy and configure env
cp docker/.env.example .env
# Edit .env: set POSTGRES_PASSWORD and SESSION_SECRET

# Build and start all services
docker compose up -d --build

# App now available at http://<host>:80
# Health check: curl http://<host>/api/healthz
```

Services: `db` (PostgreSQL), `api` (Express API on 5000), `console` (Nginx serving built React + reverse proxying `/api/`)

## Gotchas

- After any `openapi.yaml` change, always run `pnpm --filter @workspace/api-spec run codegen` before working on frontend or backend
- SSE endpoint `/api/events` is NOT in the generated hooks — it's a custom `EventSource` in the frontend
- Nginx config has `proxy_buffering off` on `/api/events` — required for SSE to work through the reverse proxy
- `pnpm --filter @workspace/db run push` only affects dev; production DB migrations are handled by the Replit Publish flow

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
