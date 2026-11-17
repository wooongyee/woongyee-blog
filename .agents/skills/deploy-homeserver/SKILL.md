---
name: deploy-homeserver
description: >-
  Monitor or trigger GitHub Actions CD deployment to the ys-home self-hosted
  runner, inspect Docker/runner health, and verify https://blog.woongyee.com.
  Trigger keywords - deploy blog, deploy homeserver, actions deploy, 홈서버 배포.
---

# Deploy Homeserver (`ys-home`)

`woongyee-blog` deploys automatically to `ys-home` via GitHub Actions
(`.github/workflows/deploy.yml`) whenever commits are pushed/merged to `main`.

## Normal CD Flow (GitHub Actions + Self-Hosted Runner)

1. Merging a PR into `main` triggers `.github/workflows/deploy.yml`:
   - `verify` (`ubuntu-latest`): `npm run verify` + `npm run build`
   - `deploy` (`[self-hosted, linux, x64, ys-home]`): runs `docker compose --project-name woongyee-blog --env-file /home/ys050/workspace/woongyee-blog/.env -f docker-compose.prod.yml up -d --build --wait` and verifies health + public URLs
   - `notify` (`ubuntu-latest`, `if: always()`): posts success/failure details to Slack when `secrets.SLACK_WEBHOOK_URL` is configured
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

## Post-Deployment Verification

Confirm live public routes if checking manually:

- `https://blog.woongyee.com` (HTTP 200)
- `https://blog.woongyee.com/blog` (HTTP 200)
- `https://blog.woongyee.com/sitemap.xml` (HTTP 200)
- `https://blog.woongyee.com/test` (HTTP 404 in production)

## Troubleshooting `ys-home` Runner or Docker

If `deploy` fails or queues indefinitely:

1. Check GitHub runner registration status:
   ```bash
   gh api repos/wooongyee/woongyee-blog/actions/runners --jq '.runners[] | {name, status, busy, labels: [.labels[].name]}'
   ```
2. Check runner service and Docker status on `ys-home`:
   ```bash
   ssh ys-home "wsl -d Ubuntu-24.04 -- bash -s" <<'EOF'
   systemctl --user status actions-runner-woongyee-blog.service --no-pager
   docker ps --filter name=woongyee-blog --format 'table {{.Names}}\t{{.Status}}'
   docker logs --tail 50 woongyee-blog
   EOF
   ```
3. Never overwrite or print `/home/ys050/workspace/woongyee-blog/.env` secrets.
