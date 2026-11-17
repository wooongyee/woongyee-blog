---
name: create-github-pr
description: >-
  Verify branch state and npm run verify, push the branch, create a GitHub PR
  linking Closes #<id>, and sync Orca workspace references and status. Trigger
  keywords - create PR, pull request, new PR, submit for review, PR 생성.
---

# Create GitHub Pull Request

Create a pull request on `wooongyee/woongyee-blog` using `gh` and synchronize
Orca worktree status.

## Prerequisites

- `gh auth status` is authenticated.
- Work is on a non-`main` branch (`feat/<id>-<slug>`, `fix/<id>-<slug>`, or `chore/<id>-<slug>`).
- `npm run verify` passes after the final edit.

## Step 1: Verify Branch, Diff, and Checks

```bash
BRANCH="$(git branch --show-current)"
test "$BRANCH" != "main"
git status -sb
npm run verify
```

- Ensure no unrelated files or secrets (`.env*`) are staged or tracked.
- Commit changes using Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`,
  `test:`) referencing the issue number where helpful.

## Step 2: Push and Create the PR

Push the current branch to `origin`:

```bash
git push -u origin HEAD
```

Create the PR matching `.github/pull_request_template.md` and always include
`Closes #<id>` when closing an issue:

```bash
PR_URL="$(gh pr create \
  --repo wooongyee/woongyee-blog \
  --base main \
  --title "<type>(scope): <concise summary>" \
  --body "$(cat <<'EOF'
## Related Issue

Closes #<id>

## Summary

- <what changed and why>

## Verification

- [x] `npm run verify` (`eslint`, `tsc --noEmit`, `vitest run` — <N> passed)
- [ ] <any additional route/manual checks>

## Notes / Limitations

- <remaining caveats or "None">
EOF
)")"
echo "$PR_URL"
```

## Step 3: Sync Orca Workspace Card

If `orca` CLI is available, attach the PR link, set the PR number, and move the
worktree card to `in-review`:

```bash
PR_NUM="$(basename "$PR_URL")"
orca reference add "$PR_URL" --worktree active --json || true
orca worktree set --worktree active \
  --pr "$PR_NUM" \
  --workspace-status in-review \
  --comment "PR #${PR_NUM} opened (Closes #<id>)" \
  --json || true
```

Report the PR URL and verification summary.
