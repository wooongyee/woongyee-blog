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

Create the PR matching `.github/pull_request_template.md` **in Korean**.
Always structure the PR body so a reader understands **what the original bug/problem was and why the change was needed first**, followed by **what was changed**, **verification**, **notes**, and place **`Closes #<id>` at the very bottom** under `## 관련 이슈`:

```bash
PR_URL="$(gh pr create \
  --repo wooongyee/woongyee-blog \
  --base main \
  --title "<type>(scope): <간결한 한국어 요약>" \
  --body "$(cat <<'EOF'
## 배경 및 문제 상황

- **기존 문제**: <애초에 어떤 버그/한계가 있었고 어떤 조건에서 발생했는지>
- **작업 이유 (영향)**: <이 문제 때문에 사용자/운영에 어떤 영향이 있어 이번 작업을 진행했는지>

## 해결 방법 및 변경 내용

- <원인을 어떻게 해결했는지 핵심 동작/설계 요약>
- <주요 수정 파일 및 추가된 테스트 파일 요약>

## 검증 내역

- [x] `npm run verify` (`eslint`, `tsc --noEmit --incremental false`, `vitest run` — <N>개 통과)
- [ ] <추가 라우트/수동 확인 내역>

## 참고 / 제한사항

- <남은 제약사항 또는 "없음">

## 관련 이슈

Closes #<id>
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
