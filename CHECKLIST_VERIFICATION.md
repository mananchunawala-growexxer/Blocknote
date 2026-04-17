# Checklist Verification

This file maps the requested edge-case checklist to current implementation evidence, automated verification, and any remaining manual checks.

## Current Status

| Checklist Item | Status | Evidence |
| --- | --- | --- |
| GitHub repo is public (or reviewer added as collaborator) | Manual/external | Cannot be verified from local workspace; confirm in Git hosting settings |
| Live URL works and is accessible without VPN | Manual/external | Cannot be verified from local workspace alone; confirm from a non-VPN network/browser |
| `README.md` covers setup, decisions, known issues | Verified | `README.md:1` |
| `AI_LOG.md` has at least one entry per working day | Partially verified | `AI_LOG.md:3`; current log contains real dated entries, but historical day-by-day completeness still needs manual confirmation |
| `.env.example` present with all required variables | Verified | `.env.example:1`, `apps/Backend/src/config/env.ts:11` |
| `order_index` is FLOAT in the database schema | Verified | `apps/Backend/migrations/001_init.sql:22`, `apps/Backend/migrations/002_blocks_order_index_float.sql:1` |
| Cross-account access returns `403` | Automated | `apps/Backend/src/__tests__/edge-cases.test.ts:113` |
| Share token route rejects `POST`/`PATCH`/`DELETE` at API level | Automated | `apps/Backend/src/modules/documents/documents.routes.ts:16`, `apps/Backend/src/__tests__/edge-cases.test.ts:105` |
| Auto-save does not allow stale overwrites | Automated | `apps/Frontend/src/components/BlockEditor.tsx:141`, `apps/Frontend/src/components/BlockEditor.test.tsx:142` |
| Enter mid-block split works with zero text loss | Automated | `apps/Frontend/src/components/Block.tsx:109`, `apps/Frontend/src/components/BlockEditor.test.tsx:100` |

## Automated Commands

Run backend edge-case verification:

```bash
npm run test:edge --workspace=@blocknote/api
```

Run project builds:

```bash
npm run build --workspace=@blocknote/api
npm run build --workspace=@blocknote/web
```

Run frontend editor verification:

```bash
npm run test --workspace=@blocknote/web
```

## Notes

- The backend integration test currently covers:
  - shared token write-method rejection with `405`
  - cross-account document and block access rejection with `403`
  - public shared-link read-only document access
- The frontend DOM test currently covers:
  - mid-word Enter split using a real contenteditable selection
  - queued autosave behavior while an older save is still in flight
- External hosting checks should be recorded separately once verified in deployment.
