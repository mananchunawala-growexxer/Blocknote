# BlockNote Assignment

This repo contains a Notion-style block editor with authenticated documents, public read-only sharing, block CRUD, autosave, slash commands, drag reorder, and PostgreSQL-backed persistence.

## Stack

- Frontend: React, Vite, TypeScript, TanStack Query
- Backend: Express, TypeScript, pg, Zod, pino
- Database: PostgreSQL

## Structure

```text
apps/
  Backend/   Express API and SQL migrations
  Frontend/  React editor and dashboard
packages/
  shared/    Shared schemas, constants, and API types
```

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in the database URL and 32+ character JWT secrets.
3. Install dependencies with `npm install`.
4. Run migrations with `npm run migrate --workspace=@blocknote/api`.
5. Start the backend with `npm run dev --workspace=@blocknote/api`.
6. Start the frontend with `npm run dev --workspace=@blocknote/web`.

## Render Deployment

For a Render backend service created from the repo root, use:

- Build command: `npm run build`
- Start command: `npm start --workspace=@blocknote/api`

The root build script compiles `@blocknote/shared`, `@blocknote/api`, and `@blocknote/web`, which ensures `apps/Backend/dist/server.js` exists before Render runs the backend start command.

## Required Variables

- `NODE_ENV`
- `PORT`
- `WEB_URL`
- `API_URL`
- `VITE_API_URL`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_TTL`
- `REFRESH_TOKEN_TTL`
- `SHARE_SESSION_TTL`
- `CORS_ORIGIN`
- `LOG_LEVEL`

## Decisions

- `order_index` uses floating-point spacing so blocks can be inserted between neighbors without renumbering the whole document.
- Shared document routes are read-only at the API layer.
- Ownership checks happen in document and block services before reads or writes.
- Autosave keeps the latest per-block edit queued so older requests do not overwrite newer text.

## Known Issues

- There is no automated integration test suite yet for cross-account access or share-route method rejection.
- `AI_LOG.md` reflects recorded work that was actually logged; it should be extended on each active work day.
- Live deployment and repo visibility depend on the environment where this project is hosted.
