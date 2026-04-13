# BlockNote Assignment

Day 1 implementation for the BlockNote intern practical:
- email/password auth with JWT access + refresh token rotation
- PostgreSQL schema + SQL migrations
- authenticated document dashboard
- create, rename, delete, and list documents

## Tech Stack

- Frontend: React, Vite, TypeScript, TanStack Query
- Backend: Express, TypeScript, pg, Zod, pino
- Database: PostgreSQL

## Project Structure

```text
apps/
  api/       Express API
  web/       React frontend
packages/
  shared/    Shared schemas, constants, and response types
```

## Environment Setup

1. Copy `.env.example` to `.env`
2. Update secrets and database URL

Required variables:
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

## Local Run

Install dependencies:

```bash
npm install
```

Run the database migrations:

```bash
npm run migrate -w apps/api
```

Start the backend:

```bash
npm run dev -w apps/api
```

Start the frontend:

```bash
npm run dev -w apps/web
```

## Build

```bash
npm run build
```

## Notes

- Document ownership is enforced in the API.
- All SQL uses parameterized queries.
- The Day 1 scope is intentionally limited to auth, schema, and document list flows.
- Share links, editor behaviors, autosave, and block reordering are still pending.
