---
name: deploy-homeserver
description: >-
  Deploy wooongyee-blog to the ys-home server via seedops after PRs are merged
  to main, and verify https://blog.woongyee.com health. Trigger keywords -
  deploy blog, deploy homeserver, seedops deploy, 홈서버 배포.
---

# Deploy Homeserver (`ys-home`)

Deploy `wooongyee-blog` from `main` to the home server container stack using
`seedops` MCP / CLI.

## Pre-Deployment Checklist

1. Confirm the target changes are merged into `origin/main` and CI passed:
   ```bash
   gh run list --repo wooongyee/woongyee-blog --branch main --limit 3
   ```
2. Verify `Dockerfile` and `docker-compose.prod.yml` match expected build args
   and runtime environment variables (`NOTION_API_KEY`, `NOTION_DATABASE_ID`,
   `CLOUDINARY_*`, `NEXT_PUBLIC_BLOG_URL=https://blog.woongyee.com`).
3. Confirm user approval before executing a production rebuild/restart if not
   already explicitly requested.

## Deployment Procedure

1. Use the `seedops` MCP server (`https://ops.woongyee.com/mcp`) to inspect the
   `ys-home` host and existing `woongyee-blog` service/compose status.
2. Pull the latest `main` on the deployment directory, rebuild, and recreate the
   container using `docker-compose.prod.yml` (preserving `.env` secrets on the
   host; never overwrite or print secrets).
3. Wait for the Docker healthcheck (`http://127.0.0.1:3000/api/webhook/notion`)
   to report `healthy`.

## Post-Deployment Verification

1. Verify external HTTPS endpoint and key routes:
   - `https://blog.woongyee.com` (HTTP 200)
   - `https://blog.woongyee.com/blog` (HTTP 200)
   - `https://blog.woongyee.com/test` (HTTP 404 in production)
2. Report the deployed commit SHA, container health state, and HTTP check
   results to the user.
