# 部署与评审演示

## 目标

T21 要求完整流程有一个稳定的公开部署，包括模拟支付过渡环节。生产目标是现有的成都阿里云主机，复用其 Caddy 边缘代理和 PostgreSQL 进程，同时保持本挑战作为独立的 Compose 项目、数据库、数据库角色和容器镜像。

## 生产拓扑

```text
Internet
  -> assessment.bakersean.top
  -> existing Caddy on Aliyun :443
  -> health-assessment:3000
  -> existing PostgreSQL process
       -> dedicated database: health_assessment
       -> dedicated role: health_assessment_app
```

本挑战不共享 MemoFlow 的表或 schema。它仅加入现有的 Docker 网络，以便 Caddy 可以访问应用，应用可以通过服务 DNS 访问 PostgreSQL。

## 容器发布模型

Next.js 应用使用 `output: "standalone"` 和多阶段 Dockerfile。

在 `main` 分支上完整 CI 套件通过后，生成两个不可变的发布制品：

- `ghcr.io/bakersean168/health-assessment-challenge:sha-<commit>` — 最小化 Next.js 运行时；
- `ghcr.io/bakersean168/health-assessment-challenge:migrate-sha-<commit>` — 一次性 Prisma 迁移镜像。

`latest` / `migrate-latest` 仅为便捷别名。生产 Compose 应锁定 commit-SHA 标签，以确保回滚是显式且可复现的。

阿里云主机拉取镜像而非本地构建应用。这是有意为之的，因为该主机资源有限且已在运行 MemoFlow 工作负载；CI 承担构建时的内存/CPU 开销。

## 主机布局

```text
/opt/health-assessment/
  compose.yaml          # deployed copy of repository compose.production.yaml
  deploy.sh             # deployed copy of scripts/deploy-aliyun.sh
  .env                  # root-only, never committed
```

应用加入外部 `memoflow_memoflow-network` 网络，但作为与 MemoFlow 独立的 Compose 项目和生命周期。

运行时容器的内存限制为 384 MiB，V8 老生代上限为 256 MiB。主机应保留少量 swap 作为瞬时内存压力的安全网；swap 不被视为正常运行时容量。

## 必需的生产配置

仅 root 可访问的 `.env` 包含：

```text
APP_IMAGE=ghcr.io/bakersean168/health-assessment-challenge:sha-<commit>
MIGRATOR_IMAGE=ghcr.io/bakersean168/health-assessment-challenge:migrate-sha-<commit>
DATABASE_URL=postgresql://health_assessment_app:<secret>@postgres:5432/health_assessment?schema=public
SHARED_DOCKER_NETWORK=memoflow_memoflow-network
DATABASE_POOL_MAX=4
```

当 `NODE_ENV=production` 时，匿名会话 cookie 自动变为 `Secure`，同时保持 `HttpOnly`、`SameSite=Lax`，且作用域为 `/`。

## 数据库迁移

生产 Compose 在应用启动前运行迁移镜像：

```bash
scp scripts/deploy-aliyun.sh <ssh-host>:/opt/health-assessment/deploy.sh
ssh <ssh-host> 'chmod 700 /opt/health-assessment/deploy.sh && /opt/health-assessment/deploy.sh'
```

部署辅助脚本会验证 Compose 配置、拉取不可变镜像、移除任何过时的一次性迁移容器、运行有界迁移步骤，然后才替换/启动应用。因此，迁移失败不会影响已在运行的应用。脚本会等待应用健康检查通过后才报告成功。`prisma migrate deploy` 保持为显式发布步骤，而非在 Next.js 构建期间执行。

## Caddy 路由

现有的生产 Caddy 实例仍然是端口 80/443 上唯一的公共监听器。当前生效的生产站点配置块为：

```caddy
assessment.bakersean.top {
    reverse_proxy health-assessment:3000

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
}
```

配置变更在重载前会经过验证。正常情况下优雅重载即可；在初始切换期间，Caddy 容器被重建过一次，因为其绑定挂载仍引用旧的 Caddyfile inode。MemoFlow 应用容器未被替换。

## 固定评审对比会话

迁移完成后，使用相同的发布源或受信任的操作环境播种一对非个人的评审夹具：

```bash
DATABASE_URL='postgresql://...' pnpm seed:evaluator-demo
```

默认会创建两个固定 session：

- FREE：`22222222-2222-4222-8222-222222222222`
- ACTIVE：`11111111-1111-4111-8111-111111111111`

两者使用完全相同的合成评估数据（男性、24 岁、175 cm、75 kg、目标 68 kg、中等活动量）、相同的 `demo-v1` 计算策略和相同的结果值；唯一有意不同的是订阅状态。脚本可安全重复运行：FREE 夹具会被恢复为 FREE 并清除其支付事件，ACTIVE 夹具会保持 ACTIVE 并确保存在 `seeded-evaluator-demo` 支付事件。若确有需要，也可通过 `FREE_DEMO_SESSION_ID` / `ACTIVE_DEMO_SESSION_ID` 覆盖默认 UUID。

评审人员无需浏览器 cookie 工具即可直接比较两个服务端投影：

```bash
BASE_URL=https://assessment.bakersean.top
FREE_SESSION_ID=22222222-2222-4222-8222-222222222222
ACTIVE_SESSION_ID=11111111-1111-4111-8111-111111111111

curl -sS "$BASE_URL/api/assessment/result" \
  -H "Cookie: health_assessment_session=$FREE_SESSION_ID"
curl -sS "$BASE_URL/api/assessment/result" \
  -H "Cookie: health_assessment_session=$ACTIVE_SESSION_ID"
```

固定 FREE session 只用于结果对比，不应拿来执行 `/api/pay`；支付重试/幂等演示使用 README 中会新建临时 session 的 cURL。普通的新鲜浏览器在 `/api/pay` 成功之前同样保持 FREE 状态。

## 公开冒烟检查清单

在标记 T21 完成之前，请从已部署的主机名而非 localhost 进行验证：

1. `/` 渲染产品着陆页并进入 `/assessment`。
2. 新鲜会话完成全部七项输入，并在流程中途刷新后仍然存活。
3. FREE 状态的 `/result` 暴露 BMI/分类，但其 JSON 响应不包含受保护的卡路里/日期值。
4. 模拟支付对话框激活会话，同一 `/result` 端点返回存储的完整快照。
5. 刷新后保持 ACTIVE 访问权限。
6. 播种的 FREE / ACTIVE 固定会话可通过文档中的 `curl` 请求直接展示差异化结果投影。

## 已验证的生产状态

截至 2026-09-11，成都阿里云主机具备：

- 一个独立的 `health_assessment` PostgreSQL 数据库，由专用角色 `health_assessment_app` 拥有；
- 所有已提交的 Prisma 迁移均已成功应用；
- 不可变的 GHCR 应用镜像作为健康的 Next.js standalone 容器运行；
- 384 MiB 应用内存限制、256 MiB V8 老生代上限，以及 1 GiB 主机 swap 安全网；
- 一对通过带外方式播种、数据完全相同且仅订阅状态不同的固定 FREE / ACTIVE 评审会话供直接对比；
- 公共 HTTPS 端点 `https://assessment.bakersean.top`，由 Cloudflare 后方的 Caddy 管理证书；
- FREE 和付费 Playwright 流程均在公共部署上通过。

首次部署尝试暴露了一个仅在生产环境中出现的打包缺陷：迁移镜像通过 `pnpm` 启动，因此 Corepack 在容器启动时尝试从 `registry.npmjs.org` 下载 pnpm。在大陆主机上该请求会卡住，而机器上的 Docker 健康检查开始超时。先前启动的内核日志中没有 OOM kill 证据。修正后的镜像直接调用已签入的 Prisma CLI 并限制迁移内存。迁移器的依赖集现在也与完整的应用/测试依赖图隔离；本地镜像大小从约 1.65 GB 降至约 675 MB（缩减约 59%），同时仍然应用相同的已提交迁移。

`sslip.io` 主机名仅作为临时无 DNS 探测进行了测试，但大陆源站返回了阿里云 `403`，Caddy 无法提供服务，因此该路由被移除而非作为脆弱的变通方案保留。

## 公开验证

生产 Compose 文件将应用/迁移器连接到现有的 MemoFlow Docker 网络，同时应用保持独立的 Compose 项目和生命周期。DNS 凭据保持在本仓库之外。

在小型成都主机上，迁移被刻意限制在 256 MiB，并直接从 `node_modules` 执行已签入的 Prisma CLI；它不会在容器启动时调用 Corepack/pnpm。这避免了不必要的包管理器引导/网络依赖，并限制了对现有生产工作负载的瞬时压力。

首次公开 Playwright 运行暴露了第二个仅在生产环境中出现的缺陷：`getPrismaClient()` 在 `NODE_ENV=production` 下创建了新的 Prisma 客户端。使用 `@prisma/adapter-pg` 适配器时，每个客户端拥有一个 `pg` 连接池，因此并发浏览器流程耗尽了专用数据库角色的 10 连接限制，高度步骤 PATCH 返回了 `P2037 TooManyConnections`。回归测试现在在真实的生产环境下启动数据库模块，并断言重复的应用查找复用同一客户端。生产环境还将共享连接池上限设为四个连接（`DATABASE_POOL_MAX=4`）。修复后，当时的单元/组件测试套件、36 个 PostgreSQL 集成测试、常规 CI 浏览器测试，以及公共 FREE/付费 Playwright 流程全部通过。

远程浏览器验证可以通过公共产品界面重复执行。它通过相同的 HTTP 流程创建普通的合成匿名会话/支付事件；它不会直接操作生产数据库：

```bash
E2E_BASE_URL=https://assessment.bakersean.top pnpm test:e2e
```
