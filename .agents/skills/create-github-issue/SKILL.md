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

### Bug Report (`bug: <concise summary>`)

Match `.github/ISSUE_TEMPLATE/bug_report.yml`:

```bash
gh issue create \
  --repo wooongyee/woongyee-blog \
  --label "bug" \
  --title "bug: <concise summary>" \
  --body "$(cat <<'EOF'
## Problem Statement

<Summarize what is broken or behaving unexpectedly and where it occurs.>

## Impact

<Describe the user/operator impact and any current workaround.>

## Reproduction Steps

1. <step or mocked test scenario>
2. <observed vs expected behavior>

## Acceptance Criteria

- [ ] <observable condition proving the bug is fixed>
- [ ] Regression test added in `tests/` (with mocked external APIs)
- [ ] `npm run verify` passes

## Suspected Files / Scope

- `<path/to/file>`
EOF
)"
```

### Feature / Improvement Request (`feat: <concise summary>`)

Match `.github/ISSUE_TEMPLATE/feature_request.yml`:

```bash
gh issue create \
  --repo wooongyee/woongyee-blog \
  --label "enhancement" \
  --title "feat: <concise summary>" \
  --body "$(cat <<'EOF'
## Problem Statement

<Summarize the missing capability or current limitation.>

## Impact / Why This Matters

<Explain why this improvement matters for readers, authoring, or operations.>

## Proposed Design

<Describe user-visible behavior, API/config contract, and edge cases.>

## Acceptance Criteria

- [ ] <observable condition required for completion>
- [ ] Unit/integration tests added in `tests/` (with mocked external APIs)
- [ ] `npm run verify` passes

## Target Files / Scope

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
