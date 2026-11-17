---
name: build-from-issue
description: >-
  Plan, implement, test, and open a PR for a GitHub issue in
  wooongyee/woongyee-blog, keeping GitHub issue comments and Orca workspace
  cards synchronized. Trigger keywords - build issue, implement issue, fix issue,
  work on issue, build-from-issue.
---

# Build From Issue

Plan and implement work described in a `wooongyee/woongyee-blog` GitHub issue,
verify with `npm run verify`, and chain into `create-github-pr`.

## Step 1: Inspect the Issue & Bind Orca Context

1. Fetch the full issue, comments, labels, and state:

```bash
gh issue view <id> --repo wooongyee/woongyee-blog \
  --json number,title,body,state,labels,comments,assignees
```

2. Check for existing `> **🏗️ build-plan**` or `> **🏗️ build-from-issue-agent**`
   comments and any newer human feedback. Do not duplicate work if an open PR
   already addresses the issue.
3. If running inside an Orca workspace (`command -v orca >/dev/null 2>&1`),
   attach the issue reference and update the sidebar card:

```bash
orca reference add https://github.com/wooongyee/woongyee-blog/issues/<id> --worktree active --json || true
orca worktree set --worktree active --workspace-status in-progress --comment "Issue #<id>: planning" --json || true
```

## Step 2: Record or Update the Build Plan

Before editing code (unless a `> **🏗️ build-plan**` already covers the exact
plan and has no pending changes), post a concise plan comment on the issue:

- Scope & affected files
- Implementation approach & edge cases
- Tests to add in `tests/` (mocking Notion/Cloudinary)

```bash
gh issue comment <id> --repo wooongyee/woongyee-blog --body "$(cat <<'EOF'
> **🏗️ build-plan**
>
> - **Branch**: `feat/<id>-<slug>` (or `fix/<id>-<slug>`)
> - **Affected files**: ...
> - **Approach**: ...
> - **Tests**: ...
EOF
)"
```

If the user only asked for a plan, stop here and report the plan URL.

### Handling Ambiguity or Blockers (Dual-Mode)

If critical product/design decisions are missing or ambiguous:
1. Post a comment starting with `> **🏗️ build-from-issue-agent**` on the issue
   explaining the question and options.
2. **If dispatched as an Orca Supervised Worker** (your prompt contains Task and
   Dispatch IDs): invoke `orca orchestration ask` (per the `orchestration` skill)
   and end your turn.
3. **If running in an interactive Orca worktree**: flag `--unread` and ask the
   user directly:
   ```bash
   orca worktree set --worktree active --unread --comment "Issue #<id>: needs decision" --json || true
   ```

## Step 3: Branch, Implement, and Test

1. Never work directly on `main`. Check `git branch --show-current`:
   - If on `main` (or an unrelated branch), create an issue branch:
     `git checkout -b fix/<id>-<slug>` or `git checkout -b feat/<id>-<slug>`.
   - If already inside an Orca worktree created for this issue on a non-`main`
     branch, reuse that branch (or rename if appropriate).
2. Implement the smallest coherent change satisfying every Acceptance Criterion.
3. Add or update unit/integration tests in `tests/`. Mock `@notionhq/client`,
   `cloudinary`, and external HTTP calls; never call live external APIs in tests.
4. Keep `docs/` or `AGENTS.md` updated only if behavior, config, or commands
   actually changed.

## Step 4: Verify

Update Orca card status and run the full verification gate:

```bash
orca worktree set --worktree active --comment "Issue #<id>: running npm run verify" --json || true
npm run verify
```

- `npm run verify` runs `eslint`, `tsc --noEmit --incremental false`, and `vitest run`.
- Fix any failures (up to 3 retries for the same root cause; if stuck, document
  the failure and ask via Dual-Mode rules).
- If UI, routes, or rendering changed and a local server is useful, verify with
  `npm run dev` / Orca's built-in browser (`orca-cli`).

## Step 5: Open PR and Report Completion

1. Chain into the `create-github-pr` skill to push the branch, open the PR with
   `Closes #<id>`, and sync Orca's `--pr` and `in-review` status.
2. **If dispatched as an Orca Supervised Worker**: call `worker_done` (per the
   `orchestration` skill) reporting the PR URL, `Closes #<id>`, and exact
   `npm run verify` results.
