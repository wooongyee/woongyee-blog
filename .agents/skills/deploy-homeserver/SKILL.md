---
name: deploy-homeserver
description: >-
  Monitor, approve, or trigger GitHub Actions Staging -> Production CD
  deployment on the ys-home self-hosted runner, inspect Docker/runner health,
  and verify staging and https://blog.woongyee.com. Trigger keywords - deploy
  blog, deploy homeserver, actions deploy, staging deploy, 홈서버 배포.
---

# Deploy Homeserver (`ys-home`)

`woongyee-blog` follows **GitHub Flow + Build-Once Staging → Production
Approval Gate** (`.github/workflows/deploy.yml`, documented in
`docs/DEPLOYMENT_PIPELINE.md`).

## Normal CD Flow

1. Merging a PR into `main` triggers `.github/workflows/deploy.yml`:
   - `verify` (`ubuntu-latest`): `npm run verify` + `npm run build`
   - `deploy-staging` (`[self-hosted, linux, x64, ys-home]`): builds
     `woongyee-blog:<sha>` once and deploys `woongyee-blog-staging` on
     `127.0.0.1:3010` (accessible privately via Tailnet at
     `https://laptop-60dnj58q.tail35561b.ts.net:3010`)
   - `deploy-prod` (`environment: Production`, requires reviewer `wooongyee`):
     after manual QA on staging and approval in GitHub Actions, promotes the
     **exact same `woongyee-blog:<sha>` image** (`--no-build`) to `woongyee-blog`
     (`https://blog.woongyee.com`)
   - `notify` (`ubuntu-latest`, `if: always()`): posts status to Slack when
     `secrets.SLACK_WEBHOOK_URL` is set
2. Monitor the latest run from CLI:

```bash
gh run list --repo wooongyee/woongyee-blog --workflow deploy.yml --limit 5
gh run watch <run-id> --repo wooongyee/woongyee-blog
```

## Manual Trigger / Re-deploy

Trigger `deploy.yml` on `main` without a new commit:

```bash
gh workflow run deploy.yml --repo wooongyee/woongyee-blog --ref main
```

## Verification Endpoints

- **Staging (Tailnet only)**: `https://laptop-60dnj58q.tail35561b.ts.net:3010`
- **Production**:
  - `https://blog.woongyee.com` (HTTP 200)
  - `https://blog.woongyee.com/blog` (HTTP 200)
  - `https://blog.woongyee.com/sitemap.xml` (HTTP 200)
  - `https://blog.woongyee.com/test` (HTTP 404 in production)

## Troubleshooting `ys-home` Runner or Docker

1. Check GitHub runner status:
   ```bash
   gh api repos/wooongyee/woongyee-blog/actions/runners --jq '.runners[] | {name, status, busy, labels: [.labels[].name]}'
   ```
2. Check runner service and both staging/prod containers on `ys-home`:
   ```bash
   ssh ys-home "wsl -d Ubuntu-24.04 -- bash -s" <<'EOF'
   systemctl --user status actions-runner-woongyee-blog.service --no-pager
   docker ps --filter name=woongyee-blog --format 'table {{.Names}}\t{{.Status}}'
   docker logs --tail 50 woongyee-blog
   EOF
   ```
3. Never overwrite or print `/home/ys050/workspace/woongyee-blog/.env` secrets.
