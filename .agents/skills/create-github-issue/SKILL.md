---
name: create-github-issue
description: >-
  Create structured GitHub issues in wooongyee/woongyee-blog using the gh CLI,
  matching .github/ISSUE_TEMPLATE/ and printing ready-to-run Orca dispatch
  commands. Trigger keywords - create issue, new issue, file bug, report bug,
  feature request, github issue, 이슈 생성.
---

# Create GitHub Issue

Create clean, actionable GitHub issues on `wooongyee/woongyee-blog` using `gh`.
GitHub Issues are the single source of truth (SSOT) for work across Antigravity,
Claude, and Codex; do not create local ticket files (`tasks/`, `backlog.md`).

- Write issue titles and bodies in **Korean** (keep file paths, symbol names,
  and commands in backticks).

## Prerequisites

- Verify `gh auth status` is authenticated.
- Inspect existing repository labels before applying any:

```bash
gh label list --repo wooongyee/woongyee-blog --limit 50
```

## Extracting Issue Content

Distill the conversation or technical spec (e.g., `docs/CURRENT_SPEC_AND_IMPROVEMENTS.md`)
into a single coherent, PR-sized issue. If a topic requires multiple PRs, split it
into separate issues so each PR can close one issue via `Closes #<id>`.

### Bug Report (`bug: <한국어 요약>`)

Match `.github/ISSUE_TEMPLATE/bug_report.yml`:

```bash
gh issue create \
  --repo wooongyee/woongyee-blog \
  --label "bug" \
  --title "bug: <간결한 한국어 요약>" \
  --body "$(cat <<'EOF'
## 문제 상황

<무엇이 잘못 동작하는지, 어느 파일/경로에서 발생하는지 요약합니다.>

## 영향

<사용자/운영자 관점의 영향과 현재 우회 방법을 적습니다.>

## 재현 방법

1. <재현 단계 또는 Mock 테스트 시나리오>
2. <실제 동작 vs 기대 동작>

## 완료 조건 (Acceptance Criteria)

- [ ] <버그 수정 완료를 검증할 수 있는 구체적 조건>
- [ ] `tests/` 회귀 테스트 추가 (외부 API Mock 처리)
- [ ] `npm run verify` 통과

## 대상 파일 / 범위

- `<path/to/file>`
EOF
)"
```

### Feature / Improvement Request (`feat: <한국어 요약>`)

Match `.github/ISSUE_TEMPLATE/feature_request.yml`:

```bash
gh issue create \
  --repo wooongyee/woongyee-blog \
  --label "enhancement" \
  --title "feat: <간결한 한국어 요약>" \
  --body "$(cat <<'EOF'
## 문제 상황

<현재 부족한 기능이나 한계를 요약합니다.>

## 배경 및 기대 효과

<독자 경험, 작성 워크플로우, 운영 측면에서 왜 필요한지 적습니다.>

## 제안 설계

<사용자에게 보이는 동작, API/설정 계약, 엣지 케이스를 적습니다.>

## 완료 조건 (Acceptance Criteria)

- [ ] <완료로 간주하기 위한 검증 가능한 조건>
- [ ] `tests/` 단위/통합 테스트 추가 (외부 API Mock 처리)
- [ ] `npm run verify` 통과

## 대상 파일 / 범위

- `<path/to/file>`
EOF
)"
```

## Post-Creation Orca Output

After creating issue `#<id>`, report the issue URL and provide the ready-to-use
Orca commands so the user or coordinator can immediately launch work:

1. **Supervised Worker (via `orca-issue-pipeline` / `orchestration`)**:
   ```bash
   orca orchestration worker-start \
     --spec "Use the build-from-issue skill to implement GitHub issue #<id> in wooongyee/woongyee-blog and open a PR using create-github-pr." \
     --worktree new-child --name issue-<id> --agent codex
   ```
2. **Independent Worktree Handoff (via `orca-cli`)**:
   ```bash
   orca worktree create --name issue-<id> --no-parent --agent codex \
     --reference https://github.com/wooongyee/woongyee-blog/issues/<id> \
     --prompt "Use the build-from-issue skill to implement GitHub issue #<id>." --json
   ```
