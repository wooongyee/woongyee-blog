---
name: orca-issue-pipeline
description: >-
  Coordinator workflow using Orca orchestration to dispatch GitHub issues to
  isolated child worktrees, cross-review PRs with a second agent/model, and
  loop feedback until ready to merge. Trigger keywords - orca pipeline,
  orchestrate issue, worker implement and review, 이슈 파이프라인.
---

# Orca Issue Pipeline (Coordinator)

Coordinate end-to-end issue implementation and cross-model PR review using Orca
`orchestration` workers in isolated child worktrees.

## Prerequisites

- Load the `orchestration` skill guide first (`orca skills get orchestration`).
- Target issues already exist in `wooongyee/woongyee-blog` (created via
  `create-github-issue` if needed).
- Default maker/checker pairing (unless the user specifies otherwise):
  - **Implementer (`Maker`)**: `codex` (runs `build-from-issue` + `create-github-pr`)
  - **Reviewer (`Checker`)**: `claude` (runs `review-github-pr`)

## Phase 1: Dispatch Implementation Worker(s)

For each independent issue `#<id>`, spawn a supervised worker in its own child
worktree (`--worktree new-child`) so parallel issues never collide:

```bash
orca orchestration worker-start \
  --spec "Use the build-from-issue skill to implement GitHub issue #<id> in wooongyee/woongyee-blog, pass npm run verify, and open a PR using create-github-pr. Return the PR number, PR URL, and verification summary via worker_done." \
  --worktree new-child \
  --name issue-<id> \
  --agent codex
```

Start all independent issue workers in this turn, then **end your turn** so Orca
wakes you when a worker asks a question or finishes (`worker_done`). Never poll.

## Phase 2: Dispatch Cross-Model Reviewer

When an implementation worker finishes with PR `#<pr_num>` (and `worker_done`
reports success):

1. Start a reviewer worker with a different agent (e.g., `claude`) in the
   current or child worktree (read-only PR inspection via `gh`):

```bash
orca orchestration worker-start \
  --spec "Use the review-github-pr skill to review PR #<pr_num> in wooongyee/woongyee-blog against its linked issue Acceptance Criteria. Post the review comment on GitHub and return Verdict (APPROVE or REQUEST_CHANGES) plus any blocking findings via worker_done." \
  --worktree current \
  --name review-pr-<pr_num> \
  --agent claude
```

2. End your turn and wait for the reviewer's `worker_done`.

## Phase 3: Feedback Loop or Completion

- **If `Verdict: REQUEST_CHANGES`**:
  Send the review findings back to the original implementation worker using its
  dispatch ID (reopening it automatically as a follow-up task):

  ```bash
  orca orchestration send \
    --to dispatch:<maker_dispatch_id> \
    --subject "Address review feedback on PR #<pr_num>" \
    --body "<blocking findings from review-github-pr>. Update the branch, re-run npm run verify, push, and reply via worker_done."
  ```

  Once updated, re-run Phase 2 review (max 2 review cycles before escalating to
  the user).

- **If `Verdict: APPROVE`**:
  Optionally update the child worktree status and report all outcomes, PR URLs,
  verification evidence, and merge readiness to the user. Do **not** merge to
  `main` or deploy to production unless the user explicitly authorized it.
