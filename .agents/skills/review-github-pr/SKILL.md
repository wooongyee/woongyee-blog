---
name: review-github-pr
description: >-
  Review a GitHub pull request in wooongyee/woongyee-blog by auditing its diff
  against the linked issue Acceptance Criteria and posting a structured review.
  Trigger keywords - review PR, review pull request, code review, PR 리뷰.
---

# Review GitHub Pull Request

Audit a PR diff against its linked GitHub issue Acceptance Criteria, project
conventions (`AGENTS.md`), and regression risks.

## Step 1: Resolve PR & Linked Issue

Accept a PR number (`#12` or `12`) or branch name.

```bash
gh pr view <number> --repo wooongyee/woongyee-blog \
  --json number,title,body,state,headRefName,baseRefName,author,closingIssuesReferences,url
```

If given a branch name without a PR number:

```bash
gh pr list --repo wooongyee/woongyee-blog --head "<branch>" --state open --json number,url
```

For every issue in `closingIssuesReferences`, fetch its Acceptance Criteria and
`> **🏗️ build-plan**` comments:

```bash
gh issue view <issue_number> --repo wooongyee/woongyee-blog \
  --json number,title,body,comments,labels
```

## Step 2: Inspect the Diff & Check Scope

Fetch the full diff:

```bash
gh pr diff <number> --repo wooongyee/woongyee-blog
```

Check locally if needed (or if no PR exists yet, diff `origin/main...HEAD`).
Optionally inspect modified files around the diff to verify types, imports, and
error handling. Do not skip reading test files added or modified in the PR.

## Step 3: Criteria Audit & Code Review Checklist

Evaluate every item strictly from observed code and diff:

1. **Acceptance Criteria Audit**: Map each checkbox from the linked issue to
   concrete evidence in the diff (`PASS`, `PARTIAL`, or `MISSING`).
2. **Next.js / Notion / Cloudinary Correctness**:
   - Pagination (`has_more`/`next_cursor`), error propagation vs silent fallback,
     and cache revalidation (`revalidateTag`/`revalidatePath`).
   - Safe handling of missing env vars during build or runtime.
   - No live Notion/Cloudinary API calls in `tests/`.
3. **Code Quality & Maintainability**:
   - No duplicated logic, silent error swallowing, or unintended breaking edits
     to `blog.config.ts` / Docker configs.
   - Adequate unit/regression tests in `tests/`.

## Step 4: Publish Review & Return Verdict

Post a structured comment **in Korean** on the PR (or submit a GitHub review
when appropriate; note GitHub forbids approving your own PR if author ==
reviewer account, in which case post `gh pr comment`):

```bash
gh pr comment <number> --repo wooongyee/woongyee-blog --body "$(cat <<'EOF'
## 코드 리뷰 요약

- **PR**: #<number>
- **연결된 이슈**: #<issue_number>
- **판정 (Verdict)**: `APPROVE` | `REQUEST_CHANGES`

### 완료 조건(Acceptance Criteria) 점검
- [x] / [ ] <완료 조건 1>: <근거 또는 누락 사항>

### 발견 사항 (Findings)
- **[Blocker | Major | Minor | Nit]** `<file>:<line>` — <핵심 설명 및 수정 방향>

### 검증 메모
- <Diff에서 확인된 테스트 및 로컬 실행 결과>
EOF
)"
```

If running as an **Orca Supervised Worker**, return the structured verdict
(`APPROVE` or `REQUEST_CHANGES`), linked issue audit, and blocking findings (if
any) via `worker_done`.
