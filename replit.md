# WhatsApp Bot Platform

A SaaS dashboard for managing WhatsApp bots — users register, create bots, connect them to WhatsApp, and manage subscription plans.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/dashboard run dev` — run the frontend dashboard
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + JWT auth (jsonwebtoken + bcryptjs)
- DB: PostgreSQL + Drizzle ORM
- Frontend: React + Vite + Tailwind CSS + Zustand
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/` — Drizzle database schema (users, bots, subscriptions)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/middlewares/auth.ts` — JWT middleware
- `artifacts/dashboard/src/` — React frontend
- `artifacts/dashboard/src/store/useAuthStore.ts` — Zustand auth store

## Architecture decisions

- JWT auth (access token 15min + refresh token 7d) stored in localStorage
- `setAuthTokenGetter` from `@workspace/api-client-react` wires JWT into all API calls
- PostgreSQL used (already provisioned) instead of MongoDB — same data model, Drizzle ORM
- Bot "start/stop" and "pairing code" are simulation stubs (actual WhatsApp via ourin-baileys would require a VPS deployment)
- Free subscription auto-created when a bot is created (with 100-year expiry)

## Product

- Register / login with JWT auth
- Create and manage multiple WhatsApp bots
- Bot status tracking (inactive, connecting, connected, disconnected)
- Pairing code generation for WhatsApp connection
- Subscription tiers: Free, Basic ($4.99/mo), Premium ($9.99/mo) with feature gating
- Dashboard overview with bot stats

## Gotchas

- Always run `pnpm run typecheck:libs` after changing DB schema files before typechecking the API server
- After changing `lib/api-spec/openapi.yaml`, run codegen before using the updated types
- JWT_SECRET and JWT_REFRESH_SECRET are stored as env vars (not secrets) — rotate them in production

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
