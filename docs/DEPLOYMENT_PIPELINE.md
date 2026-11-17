# 배포 파이프라인 및 브랜치 전략

`woongyee-blog`는 **단일 `main` 기반 GitHub Flow + Build-Once Staging → Production 승인 승격(Promote)** 전략을 사용합니다.

## 전체 흐름

1. **PR 단계 (`.github/workflows/ci.yml`)**
   - 이슈별 작업 브랜치(`feat/<id>-<slug>`, `fix/<id>-<slug>`, `chore/<id>-<slug>`)에서 PR을 생성합니다.
   - GitHub 호스티드 러너(`ubuntu-latest`)에서 `npm run verify` (`eslint` + `tsc --noEmit` + `vitest run`)와 `npm run build`를 검증합니다.
   - AI 교차 리뷰(`review-github-pr`) 통과 후 `main`으로 머지합니다.

2. **CI 검증 + Staging 자동 배포 (`.github/workflows/deploy.yml`)**
   - `main`에 머지(또는 `workflow_dispatch`)되면 먼저 `verify` 잡(`ubuntu-latest`)이 통과해야 다음 단계로 넘어갑니다.
   - `deploy-staging` 잡(`ys-home` Self-hosted Runner)이 Docker 이미지를 **1회만 빌드**해 `woongyee-blog:<git-sha>`로 태그하고, 스테이징 컨테이너(`woongyee-blog-staging`)를 기동합니다.
   - **스테이징 접속 주소 (Tailnet 전용, 외부 비공개)**:
     - `https://laptop-60dnj58q.tail35561b.ts.net:3010` (`tailscale serve` → `127.0.0.1:3010`)
     - 또는 `ys-home` 로컬 `http://127.0.0.1:3010`

3. **수동 QA 및 Production 승격 (`environment: Production`)**
   - 스테이징 URL에서 실제 Notion 데이터·UI·라우트를 직접 확인합니다.
   - 이상이 없으면 GitHub Actions 실행 페이지에서 **`Production` 환경 승인(`Approve and deploy`)**을 누릅니다.
   - `deploy-prod` 잡은 **재빌드 없이 스테이징에서 검증한 동일 `woongyee-blog:<git-sha>` 이미지**를 운영 컨테이너(`woongyee-blog`, `https://blog.woongyee.com`)로 승격(`--no-build`)합니다.

4. **롤백**
   - `ys-home`에는 최근 3개의 `woongyee-blog:<git-sha>` 이미지가 유지되므로, 문제 발생 시 이전 정상 커밋에서 `deploy.yml`을 재실행하거나 `IMAGE_TAG=<prev-sha>`로 즉시 되돌릴 수 있습니다.

5. **환경변수 및 알림**
   - 런타임/빌드 시크릿은 `ys-home`의 `/home/ys050/workspace/woongyee-blog/.env` (`chmod 600`)에서 `--env-file`로 주입합니다.
   - GitHub Repository Secret `SLACK_WEBHOOK_URL`이 등록되어 있으면 `notify` 잡이 성공/실패 결과를 Slack으로 전송합니다.
