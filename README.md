# 健康评估全栈挑战

[![CI](https://github.com/BakerSean168/health-assessment-challenge/actions/workflows/ci.yml/badge.svg)](https://github.com/BakerSean168/health-assessment-challenge/actions/workflows/ci.yml)

一种测试驱动开发优先的渐进式健康评估漏斗实现，灵感来自 BetterMe 风格的 Web-to-App 引导流程。

该项目特意设计为一个为期三天的工程挑战。目标不是克隆商业产品或复现数十个营销页面。相反，它提取了在技术上有意义的核心产品机制：渐进式数据收集、服务端持久化与恢复、确定性结果生成、订阅门控结果投影、幂等支付模拟，以及基于证据的测试。

## 项目状态

**阶段：** 实现与公开部署已完成；交付文档与 AI 复盘已对齐

该仓库从一开始就公开，因此实现历史、测试优先的工作流程、设计决策和权衡取舍均可供审查。

**在线演示：** https://assessment.bakersean.top

在线漏斗暴露了一个不透明的 `?order=<assessment UUID>` 用于流程关联，而 HttpOnly cookie 仍然是授权/恢复边界；仅复制订单 URL 不会在其他浏览器会话中授予访问权限。

在线站点刻意面向终端用户：它向终端用户展示健康旅程，而非叙述持久化、快照、服务端状态、TDD 或其他实现细节。评审者所需的证据在本文档、docs 目录、测试和提交历史中。

**固定评审会话（两者使用完全相同的评估答案与结果快照）：**

- FREE：`22222222-2222-4222-8222-222222222222`
- ACTIVE：`11111111-1111-4111-8111-111111111111`

这两个 session 仅用于只读结果对比。请不要对固定 FREE session 调用 `/api/pay`；如需验证支付幂等性，请使用下面会自动创建临时 session 的 `/pay` cURL。

## 评审者快速路径

如果您只有几分钟时间：

1. 打开[在线评估](https://assessment.bakersean.top)并完成七步漏斗。在流程中途刷新一次以验证服务端恢复能力。
2. 直接复制下方“FREE / ACTIVE 一键对比”两条 cURL，确认两份相同评估数据只因订阅状态不同而返回不同结果投影。
3. 再从普通浏览器完成模拟支付，确认同一结果端点会从 FREE 切换到 ACTIVE。
4. 运行 `pnpm test:all` 执行所有自动化测试层，或通过 CI 徽章查看 GitHub Actions 绿色运行结果。
5. 阅读[领域/数据模型](docs/03-domain-and-data-model.md)、[API 契约](docs/04-api-contract.md)和 [AI 复盘](docs/12-ai-retrospective.md)以了解三个最高价值的设计领域。

### API 概览

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/session` | 创建/复用服务端拥有的匿名会话和评估 |
| `GET` | `/api/assessment` | 恢复已持久化的答案和推导出的可恢复步骤 |
| `PATCH` | `/api/assessment/steps/:stepKey` | 使用乐观版本控制验证并持久化单个答案 |
| `POST` | `/api/assessment/submit` | 原子性完成汇总并创建一个版本化结果快照 |
| `GET` | `/api/assessment/result` | 返回 FREE 或 ACTIVE 服务端结果投影 |
| `POST` | `/api/pay` | 幂等地模拟支付并激活会话 |

### FREE / ACTIVE 一键对比

两条固定评审 session 使用完全相同的答案（男性、24 岁、175 cm、75 kg、目标 68 kg、中等活动量）和同一个 `demo-v1` 结果快照；唯一有意不同的是订阅状态。复制以下命令即可直接比较服务端授权投影：

```bash
BASE_URL=https://assessment.bakersean.top
FREE_SESSION_ID=22222222-2222-4222-8222-222222222222
ACTIVE_SESSION_ID=11111111-1111-4111-8111-111111111111

printf '%s\n' '--- FREE ---'
curl -sS "$BASE_URL/api/assessment/result" \
  -H "Cookie: health_assessment_session=$FREE_SESSION_ID"
printf '\n%s\n' '--- ACTIVE ---'
curl -sS "$BASE_URL/api/assessment/result" \
  -H "Cookie: health_assessment_session=$ACTIVE_SESSION_ID"
printf '\n'
```

预期差异：FREE 响应仍返回相同的 BMI，但 `recommendedDailyCalories` 与 `estimatedGoalDate` 只包含 `{ "locked": true }`；ACTIVE 响应则返回同一份已存储快照中的 `2380` kcal/day 与 `2026-12-18`。这证明高级值是在服务端按订阅状态投影，而不是先发送给浏览器再通过 CSS 隐藏。

### 使用 cURL 复现 `/pay`

```bash
BASE_URL=https://assessment.bakersean.top
COOKIE_JAR=$(mktemp)

curl -sS -c "$COOKIE_JAR" -X POST "$BASE_URL/api/session"
curl -sS -b "$COOKIE_JAR" \
  -H 'content-type: application/json' \
  -d '{"idempotencyKey":"reviewer_curl_demo_001"}' \
  "$BASE_URL/api/pay"

rm -f "$COOKIE_JAR"
```

使用相同的 cookie/key 重复第二次请求是安全的，并会报告 `replayed: true`。该 `/pay` 示例使用临时 session，不会修改上面的固定 FREE / ACTIVE 对比夹具。

## 产品流程

```mermaid
flowchart TD
    A[落地页] --> B[性别]
    B --> C[目标]
    C --> D[活动量]
    D --> E[身高]
    E --> F[当前体重]
    F --> G[年龄]
    G --> H[目标体重]
    H --> I[分析]
    I --> J[健康档案]
    J --> K[预测]
    K --> L[免费结果 / 付费墙]
    L -->|POST /api/pay| M[激活订阅]
    M --> N[完整结果]
```

该实现保留了七个已持久化的评估输入，同时使用反馈屏幕来保持参考漏斗中观察到的 提问 -> 推导 -> 提供价值 节奏。

## 工程目标

- 在服务端增量持久化评估答案。
- 通过从已持久化答案推导进度，在刷新或重新访问时恢复精确的可恢复状态。
- 当先前答案发生更改时重新验证依赖答案。
- 在 HTTP 边界验证运行时输入。
- 在服务端（而非仅在 UI 中）强制执行漏斗排序。
- 使用乐观并发控制保护过时写入。
- 在提交时生成确定性结果快照。
- 为免费和已激活订阅返回不同的结果 DTO。
- 永远不向免费客户端发送锁定的高级值。
- 将所有会话范围的 API 响应标记为 private/no-store。
- 使评估提交和模拟支付在保持过时答案写入在乐观并发下严格的同时，可以安全重试。
- 使用 RED -> GREEN -> REFACTOR 的行为优先开发方式。
- 保持 CI 作为代码检查、类型检查、测试和构建健康的可执行证据。

## 固定技术栈

- Node.js 24 LTS（CI 中为 `24.21.0`；engine `>=24.19 <25`）+ pnpm 11.22.0
- Next.js 16.3.4 App Router + React 19.3.0 + TypeScript 5.9.3（`strict`）
- Tailwind CSS 4
- shadcn/ui `base-nova` 预设，使用 Base UI 原语
- Lucide 图标
- PostgreSQL
- Prisma 7.10 + PostgreSQL 17 集成环境
- Zod 4.6
- Vitest 5
- Playwright 1.63
- GitHub Actions
- Docker/GHCR 部署到现有的成都阿里云主机，前端使用 Caddy

UI 层遵循库优先策略：当 shadcn/ui 提供合适的组件时，将该组件作为可访问、有样式的基线使用，并在本地针对产品进行定制，而非从头重建原语。鼓励项目特定的组合；不鼓励重复的原语。

精确的依赖版本由 lockfile 在引导时固定。

## 架构概览

```text
浏览器 / React 漏斗
        |
        v
Next.js 路由处理器
        |
        v
应用用例
        |
        +-----------------------+
        |                       |
        v                       v
领域策略                   仓储
（步骤流程、计算、           |
 结果访问）                 v
                        Prisma / PostgreSQL
```

HTTP 处理器保持精简。领域计算不依赖 React、Prisma、cookie 或系统时钟。结果访问根据订阅状态在服务端进行投影。

### 共享 API 契约

请求/响应结构由可执行契约拥有，而非在路由处理器和浏览器客户端中分别重新声明。Zod 模式是运行时的唯一事实来源，TypeScript DTO 通过 `z.infer` 推断；服务器使用与浏览器在接收时验证的相同模式来验证传出的成功负载。公共机器错误码在一个 `as const` 词汇表中定义，特定于代码的详细负载和 HTTP 状态映射围绕该词汇表推导，多变体应用失败通过 `assertNever` 保护的穷举 switch 映射，确保新添加的错误不会静默地落入通用分支。

领域字面量集（如 gender、goal、activity、assessment step/status、BMI category、subscription status 和 payment status）作为 `as const` 元组导出一次。评估步骤命令从判别式 Zod 联合类型推断，相同的命令到答案映射由 React 状态和 Prisma 写入复用。仅编译时的对齐检查确保领域枚举/答案字段/结果快照与生成的 Prisma 类型一致，确保应用投影与公共 DTO 一致。TypeScript 还启用了 `noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitReturns`、未使用符号检查和 switch 穿透检查，以确保这些保证不会被宽松的编译器默认值削弱。

### 实际持久化模型

```mermaid
erDiagram
    ANONYMOUS_SESSION ||--|| ASSESSMENT : owns
    ANONYMOUS_SESSION ||--|| SUBSCRIPTION : has
    ASSESSMENT ||--o| ASSESSMENT_RESULT : snapshots
    ANONYMOUS_SESSION ||--o{ PAYMENT_EVENT : records

    ANONYMOUS_SESSION {
      uuid id PK
    }
    SUBSCRIPTION {
      uuid session_id PK_FK
      enum status
      timestamp activated_at
    }
    ASSESSMENT {
      uuid id PK
      uuid session_id UK
      int revision
      enum status
      float height_cm
      float weight_kg
      int age
      float target_weight_kg
    }
    ASSESSMENT_RESULT {
      uuid id PK
      uuid assessment_id UK
      float bmi
      int recommended_daily_calories
      date estimated_goal_date
      string calculation_version
    }
    PAYMENT_EVENT {
      uuid id PK
      uuid session_id FK
      string idempotency_key
      enum status
    }
```

`Subscription` 是一个刻意设计的小型 1:1 扩展表，直接以 `session_id` 为键；它满足挑战明确要求的用户/数据/订阅关系，而不发明模拟支付范围内不存在的计划、续费、提供方或计费周期字段。`PaymentEvent` 保持为模拟支付转换的重放/幂等记录。

## TDD 工作流程

每个实现任务遵循以下循环：

```text
验收标准
        -> 失败测试 (RED)
        -> 最小实现 (GREEN)
        -> 不改变行为的重构
        -> 带证据提交
```

集成测试驱动持久化、恢复行为、排序、乐观锁、提交、授权和支付语义。单元测试驱动纯计算和策略逻辑。Playwright 保留用于两个最高价值的浏览器流程。

## 本地运行

前提条件：Node.js 24、pnpm 11 和 Docker。最快的本地路径是复用可丢弃的 PostgreSQL 测试容器：

```bash
pnpm install
pnpm db:test:up
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public' pnpm db:migrate:deploy
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public' pnpm dev
```

质量门禁：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
```

一键自动化测试运行：

```bash
pnpm test:all
```

### 按行为分类的测试覆盖

| 层级 | 当前证据 | 存在原因 |
|---|---|---|
| 单元/组件 | 83 个测试 | 纯计算边界、步骤策略、FREE 脱敏、生产 Prisma 生命周期和产品组件行为应在没有基础设施噪声的情况下快速失败 |
| PostgreSQL 集成 | 49 个测试 | 持久化、恢复、排序、乐观并发、畸形/注入形输入、原子提交、结果授权和支付幂等性依赖于真实的数据库/HTTP 边界语义 |
| Playwright | 2 个浏览器旅程 | 两个最高价值的用户路径证明 cookie、Next 路由、刷新恢复、FREE 结果、付费墙、模拟支付和 ACTIVE 结果协同工作 |
| GitHub Actions | 4 个作业 | 干净的运行器证明 lint/typecheck/tests/build 和不可变的应用/迁移镜像发布是可复现的 |

在这个三天的范围内有意不涵盖的内容：真实账户认证、支付提供方/webhook 集成、多计划订阅计费、Chromium 之外的跨浏览器/设备矩阵、负载测试以及参考产品的营销/升级页面。这些被省略是因为评估标准考察的是后端/数据/测试闭环，而非生产计费或像素级完美的漏斗复现。行为覆盖优先于追求会奖励低价值实现细节测试的行覆盖率百分比。

两个浏览器流程也可以指向已部署的环境，而无需启动本地开发服务器：

```bash
E2E_BASE_URL=https://assessment.bakersean.top pnpm test:e2e
```

评审者端固定 FREE / ACTIVE 结果投影检查已放在 README 顶部的“一键对比”部分；两条 session 使用相同数据，只改变订阅状态。

## 文档

- [范围与成功标准](docs/00-scope-and-success-criteria.md)
- [参考漏斗审计](docs/01-reference-funnel-audit.md)
- [系统架构](docs/02-architecture.md)
- [领域与数据模型](docs/03-domain-and-data-model.md)
- [API 契约](docs/04-api-contract.md)
- [TDD 策略与测试矩阵](docs/05-tdd-strategy.md)
- [实现计划](docs/06-implementation-plan.md)
- [AI 使用日志](docs/07-ai-usage-log.md)
- [决策日志](docs/08-decisions.md)
- [UI 组件策略](docs/09-ui-component-policy.md)
- [计算策略 v1](docs/10-calculation-policy.md)
- [部署与评估者演示](docs/11-deployment.md)
- [AI 协作复盘](docs/12-ai-retrospective.md)
- [面试官视角审计](docs/13-interviewer-audit.md)
- [面试官代码审查审计](docs/14-code-review-audit.md)
- [技术面试防御指南](docs/15-interview-defense.md)

## 非目标

本挑战刻意**不**尝试实现生产级健康平台、真实医疗指导、真实支付处理、营销分析、升级销售、推荐系统或像素级完美的 BetterMe 克隆。

热量指导和目标日期估算的计算策略在 `docs/10-calculation-policy.md` 中记录为确定性工程演示策略，而非医疗建议。

## 仓库原则

1. 行为优先于实现。
2. 服务端状态是权威来源。
3. TypeScript 类型不能替代运行时验证。
4. 授权不是 UI 隐藏。
5. 持久化事实；推导展示/进度状态，而非复制它。
6. 重试安全性是正确性的一部分，但过时写入不能被静默接受。
7. 优先使用显式的小型抽象，而非框架繁重的仪式。
8. 每个非显而易见的设计决策都应在面试中可解释。
