# Project Context Handoff

Last updated: 2026-04-15

This file is a handoff context for another AI to continue work on this project from the current milestone.

## Project Summary

This is a monorepo document editor project with:

- Frontend: React + Vite + TypeScript in `apps/Frontend`
- Backend: Express + TypeScript + PostgreSQL in `apps/Backend`
- Shared contracts/types: `packages/shared`

Core product behavior currently implemented:

- Email/password auth
- Document dashboard
- Block-based editor
- Share-by-link document viewing with read-only access
- Global light/dark theme toggle across landing, auth, dashboard, and editor

## Current Milestone

The latest completed feature work was:

1. Document sharing
2. Global dark/light theme support

The intended sharing behavior is:

- A document owner can enable sharing.
- The app generates a share link.
- Anyone with that link can open and read the full document.
- Shared viewers must not be able to edit, add, delete, drag, or otherwise mutate document content.

The intended theme behavior is:

- A sun/moon icon appears at the top-right across the app.
- Theme applies consistently to landing, auth, dashboard, and editor pages.
- Light theme should remain visually coherent and not look like a broken inversion of dark mode.

## Important Files

### Frontend

- `apps/Frontend/src/app/App.tsx`
  - App routing
  - Includes global `ThemeToggle`
  - Added shared route: `/shared/:shareToken`

- `apps/Frontend/src/main.tsx`
  - Wraps app with `ThemeProvider`

- `apps/Frontend/src/stores/theme.tsx`
  - Theme state
  - Persists theme in `localStorage`
  - Writes `data-theme` to `document.documentElement`

- `apps/Frontend/src/components/ThemeToggle.tsx`
  - Top-right sun/moon theme button

- `apps/Frontend/src/features/documents/DashboardPage.tsx`
  - Owner document list
  - Share toggle button
  - Copy share link behavior
  - Share feedback messaging

- `apps/Frontend/src/features/editor/EditorPage.tsx`
  - Handles both owner editor view and shared reader view
  - Loads owner doc detail or shared doc detail depending on route
  - Shows read-only messaging for shared viewers
  - Lets owners enable/disable sharing and copy share link

- `apps/Frontend/src/components/BlockEditor.tsx`
  - Added `readOnly`, `initialBlocks`, and `queryKey` props
  - Shared readers render the full document from initial data
  - Read-only mode hides slash menu, command bar, delete zone, and creation affordances

- `apps/Frontend/src/components/Block.tsx`
  - Added `readOnly` support
  - Prevents editing, toggling todos, changing image URLs, drag handles, add buttons, and inline toolbar actions

- `apps/Frontend/src/lib/api.ts`
  - Added:
    - `getDocumentDetail`
    - `getSharedDocumentDetail`
    - `updateDocumentShare`

- `apps/Frontend/src/styles.css`
  - Global theme tokens
  - Light/dark theme styles
  - Theme toggle styles
  - Shared/read-only banner styles

### Backend

- `apps/Backend/src/modules/documents/documents.routes.ts`
  - Public route:
    - `GET /api/documents/shared/:shareToken`
  - Auth routes:
    - `GET /api/documents`
    - `POST /api/documents`
    - `GET /api/documents/:id`
    - `PATCH /api/documents/:id`
    - `PATCH /api/documents/:id/share`
    - `DELETE /api/documents/:id`

- `apps/Backend/src/modules/documents/documents.controller.ts`
  - Added shared document controller
  - Added share toggle controller

- `apps/Backend/src/modules/documents/documents.service.ts`
  - Added:
    - `getSharedDocumentDetail`
    - `updateDocumentShareForUser`
  - `listDocuments` now includes share metadata
  - Owner document detail now includes share metadata and `viewerRole`

- `apps/Backend/src/modules/documents/documents.repository.ts`
  - Added:
    - `findDocumentByShareTokenHash`
    - `updateDocumentShareSettings`

### Shared Package

- `packages/shared/src/types/api.ts`
  - Extended document DTOs with:
    - `isPublic`
    - `shareToken`
    - `shareUrl`
    - `viewerRole`
  - Added `DocumentShareResponse`

- `packages/shared/src/schemas/document.ts`
  - Added `updateDocumentShareSchema`

- `packages/shared/src/constants/error-codes.ts`
  - Added share/read-only related error codes

## Current Share Implementation Notes

The database schema already had:

- `documents.is_public`
- `documents.share_token_hash`

Current implementation behavior:

- When sharing is enabled, a random token is generated and stored in `share_token_hash`.
- The frontend constructs a link like `/shared/<token>`.
- Public read access uses `GET /api/documents/shared/:shareToken`.
- Owner document detail responses include whether the document is public and the current share link.

Important caveat:

- Despite the column name `share_token_hash`, the current implementation stores the raw share token there, not a hash.
- This is functional for now, but the naming is misleading.
- If someone continues this work, they may want to either:
  - rename the column in a future migration, or
  - switch the implementation to store a hash and add a separate public token strategy

Do not assume the current name reflects the actual runtime behavior.

## Current Editor Access Model

Owner route:

- `/documents/:documentId`

Shared reader route:

- `/shared/:shareToken`

Editor behavior:

- Owners can edit normally.
- Shared readers see the document content but cannot mutate it.
- Read-only behavior is enforced in the frontend UI.

Important limitation:

- Block write endpoints are still auth-based owner flows.
- There is not yet a dedicated backend concept of "shared session" used by the editor.
- Read-only is currently achieved because shared viewers do not have edit controls and do not send edit mutations.

If future work requires stronger enforcement, backend write-path validation should explicitly reject any non-owner/shared-reader mutation attempts.

## Theme Implementation Notes

Theme state:

- Stored in `localStorage` under `blocknote-theme`
- Applied with `document.documentElement.dataset.theme`

Design intent:

- Light mode uses a bright blue/white document-product look
- Dark mode uses navy/steel tones, not pure black
- Glass panels and shared tokens were added to keep the UI consistent across screens

## Verification Already Done

Verified successfully:

- `npm run typecheck --workspace=@blocknote/web`
- `npm run build --workspace=@blocknote/web`

Result:

- Frontend typecheck passed
- Frontend production build passed

## Known Issue

Backend typecheck currently fails because of an existing TypeScript workspace configuration problem, not because of the new feature logic.

Failing area:

- `apps/Backend/tsconfig.json`

Problem:

- `rootDir` is set to `src`
- The backend imports from `packages/shared/src/...`
- TypeScript complains that the shared files are outside `rootDir`

Current state:

- This problem existed at verification time and blocks a clean backend `tsc --noEmit` result.

Likely follow-up options:

1. Adjust backend `tsconfig.json` so shared workspace sources are included properly.
2. Change package resolution so backend consumes built shared artifacts instead of source exports.

Do not assume backend typecheck is currently green.

## Existing Dirty Worktree Warning

The repo already had unrelated modified files before the latest feature work. Do not blindly revert changes.

Files already dirty during this feature work included:

- `apps/Frontend/src/components/Block.tsx`
- `apps/Frontend/src/components/BlockEditor.tsx`
- `apps/Frontend/src/components/SlashMenu.tsx`
- `apps/Frontend/src/styles.css`
- `apps/Frontend/vite.config.ts`
- `package.json`
- `packages/shared/src/constants/error-codes.ts`
- `packages/shared/src/types/api.ts`

There were also untracked docs in the root.

Any future AI should inspect the worktree before making destructive edits.

## Files Changed In This Milestone

Created:

- `PROJECT_CONTEXT_HANDOFF.md`
- `apps/Frontend/src/components/ThemeToggle.tsx`
- `apps/Frontend/src/stores/theme.tsx`

Updated:

- `apps/Backend/src/modules/documents/documents.controller.ts`
- `apps/Backend/src/modules/documents/documents.repository.ts`
- `apps/Backend/src/modules/documents/documents.routes.ts`
- `apps/Backend/src/modules/documents/documents.service.ts`
- `apps/Frontend/src/app/App.tsx`
- `apps/Frontend/src/components/Block.tsx`
- `apps/Frontend/src/components/BlockEditor.tsx`
- `apps/Frontend/src/features/documents/DashboardPage.tsx`
- `apps/Frontend/src/features/editor/EditorPage.tsx`
- `apps/Frontend/src/lib/api.ts`
- `apps/Frontend/src/main.tsx`
- `apps/Frontend/src/styles.css`
- `packages/shared/src/constants/error-codes.ts`
- `packages/shared/src/schemas/document.ts`
- `packages/shared/src/types/api.ts`

## Recommended Next Steps

Highest priority follow-ups:

1. Fix backend TypeScript config so backend typecheck passes.
2. Add explicit backend write protection semantics for any future shared-reader mutation path.
3. Decide whether share tokens should truly be hashed and migrate the schema/logic accordingly.
4. Manually test:
   - owner enables share
   - link opens without login
   - shared viewer can read all blocks
   - shared viewer cannot edit
   - owner can disable share and old link stops working
   - theme toggle persists across refresh and navigation

## Quick Prompt For Another AI

If you want to hand this to another AI, use something like:

"Read `PROJECT_CONTEXT_HANDOFF.md` first. Continue from the current sharing + global theme milestone. Do not revert unrelated worktree changes. Backend frontend stack is in `apps/Backend` and `apps/Frontend`, shared contracts are in `packages/shared`. First inspect backend typecheck/rootDir issue, then validate share-link behavior and read-only enforcement."
