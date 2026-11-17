# Repository Guidelines (`woongyee-blog`)

Personal Next.js 15 blog powered by Notion as CMS, Cloudinary for image persistence, and Docker self-hosting on a home server (`ys-home`, `https://blog.woongyee.com`).

## Architecture & Key Paths

- `app/` — Next.js App Router pages and API routes (`/api/og`, `/api/webhook/notion`).
- `lib/notion/` — Notion client, block/page parsers, and data source queries (`api.ts`, `client.ts`, `parser.ts`, `images.ts`, `types.ts`).
- `lib/cloudinary/` — Cloudinary upload and URL transformation helpers.
- `lib/utils/` — Markdown/HTML pipeline (`markdown.ts`), TOC/reference extractors, JSON-LD, formatters, cache revalidation.
- `components/` — React components (`blog/`, `common/`, `layout/`).
- `blog.config.ts` — Central blog and Notion property mapping configuration.
- `tests/` — Vitest unit/integration tests (mock external Notion/Cloudinary APIs).
- `docs/CURRENT_SPEC_AND_IMPROVEMENTS.md` — Baseline technical audit and improvement backlog.

## Verification Gates

Run before committing or opening a PR:

```bash
npm run verify   # runs: eslint && tsc --noEmit && vitest run
```

- Always mock `@notionhq/client`, `cloudinary`, and external network calls in `tests/`. Never hit live Notion or Cloudinary APIs in tests.
- If UI or layout behavior changed, verify locally with `npm run dev` (or Orca's built-in browser via `orca-cli`) when applicable.

## Issue-Driven Workflow & Orca Conventions

GitHub Issues (`wooongyee/woongyee-blog`) are the single source of truth (SSOT) for tasks, plans, and progress across models (Antigravity, Claude, Codex). Do **not** create local ticket tracking files (`tasks/`, `backlog.md`, etc.).

- **Branching**: Never commit or open PRs directly from `main`. Use `feat/<issue-number>-<slug>`, `fix/<issue-number>-<slug>`, or `chore/<issue-number>-<slug>`.
- **PR Linking**: Every feature/bugfix PR must reference an existing issue with `Closes #<issue-number>`.
- **Skills** (`.agents/skills/`):
  - `create-github-issue`: Turn discussions into structured GitHub issues matching `.github/ISSUE_TEMPLATE/`.
  - `build-from-issue`: Plan on the issue (`> **🏗️ build-plan**`), implement, test, run `npm run verify`, and chain to `create-github-pr`.
  - `create-github-pr`: Verify branch & `npm run verify`, push, open PR, and update Orca workspace status/references.
  - `review-github-pr`: Audit PR diff against linked issue Acceptance Criteria and post a structured review.
  - `orca-issue-pipeline`: Coordinator workflow to dispatch implementation and cross-model review via Orca workers.
  - `deploy-homeserver`: Rebuild and deploy the container on `ys-home` via `seedops` after merging to `main`.

## Orca Dual-Mode Rules

When running inside an Orca-managed workspace:

- **Supervised Worker** (prompt contains Task and Dispatch IDs): Use `orca orchestration ask` if blocked on a product decision, and report completion with `worker_done` including PR URL and verification output.
- **Interactive / Handoff Worktree**: Keep the Orca workspace card synced (`orca reference add`, `orca worktree set --workspace-status ... --comment "..."`), and flag `--unread` when asking the user for input.
- If `orca` CLI is unavailable in a non-Orca shell (e.g., CI), skip Orca status commands without failing the workflow.
