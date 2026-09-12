# 技术面试答辩指南

## 目的

本文档不是另一份架构规范，而是一份紧凑的答辩指南，涵盖了评审者在阅读代码后最可能提出的问题。每个答案都陈述了实际交付的权衡，指明了代码证据，并避免声称三天挑战中未实现的生产环境能力。

## 30秒架构概述

> 这是一个采用 Next.js 的模块化单体应用，具有精心设计的轻量 HTTP 层、应用用例、领域策略以及基于 PostgreSQL 的 Prisma 仓储适配器。浏览器负责呈现状态，而服务器负责评估答案、进度推导、乐观修订、结果快照和访问控制。每个接受的答案在进度推进前都会被持久化提交。提交原子化地冻结一个版本化的结果。FREE 客户端永远不会收到高级功能值，模拟支付是事务幂等的。该实现通过可执行测试开发并反复修正，包括类似生产环境的 Playwright 运行。

## 高频问题

### 1. 为什么使用 Next.js Route Handlers 而不是单独的 NestJS/Express 后端？

**答案：** 本次挑战需要一个小型 Web 产品、六个 API 路由、一个 PostgreSQL 数据库和三天的交付窗口。拆分部署会增加 CORS、重复配置、部署协调和另一个故障边界，而不会改善评估的领域行为。Route Handlers 仅是传输适配器；领域/应用代码与框架无关，如果产品增长，可以轻松迁移。

**证据：** `src/app/api/**`、`src/modules/**/application`、`src/modules/**/domain`、`src/modules/**/infrastructure`。

**请勿声称：** Next.js 总是优于单独的后端。

### 2. 为什么 `currentStep` 不存储在数据库中？

**答案：** 进度已通过持久化的答案进行编码。存储可变的步骤指针会重复相同的事实并导致不一致，例如 `gender/goal/activity` 存在但 `currentStep=GOAL`。`getNextRequiredStep()` 在每次恢复读取时派生第一个缺失或上下文无效的语义步骤。这也处理了早期目标/体重编辑使目标体重无效而无需破坏性数据清除的情况。

**证据：** `src/modules/assessment/domain/assessment.ts`、`GET /api/assessment`。

### 3. 为什么使用语义步骤键而不是数字位置？

**答案：** 数字位置将持久化进度耦合到一个 UI 顺序。语义键（`GENDER`、`GOAL`、`TARGET_WEIGHT`）在漏斗重新排序或以后引入分支时保持意义稳定。在 v1 中，流程主要是线性的，但状态模型不依赖于屏幕索引。

### 4. 为什么每个匿名会话只对应一个评估？

**答案：** 重新参加/历史记录不在任务要求中。1:1 关系使恢复具有确定性，并避免发明“活跃评估”选择规则。如果账户/历史成为需求，`sessionId` 可以停止唯一性，并可以添加显式的生命周期/当前评估概念。

**证据：** `Assessment.sessionId @unique` 在 `prisma/schema.prisma` 中。

### 5. 如果计费只是模拟的，为什么订阅是一个单独的 1:1 表？

**答案：** 本次挑战明确要求模式显示订阅信息作为关系，因此最终模型使该边界具体化，而无需假装拥有完整的计费领域。`Subscription.sessionId` 同时是 PK 和 FK，该行当前仅存储 `FREE | ACTIVE`、`activatedAt` 和时间戳。`PaymentEvent` 单独记录幂等的模拟支付尝试。真实的计划、到期、续订、取消或提供商标识符仅在这些需求存在时才应添加。

**证据：** `Subscription` 和 `PaymentEvent` 在 `prisma/schema.prisma` 中；`PrismaPaymentRepository`。

### 6. 随机会话 UUID 真的是认证吗？

**答案：** 这是故意设计的演示级匿名持有者认证，任务要求允许这样做。服务器在 HttpOnly、生产环境 Secure、SameSite=Lax 的 cookie 中颁发随机 UUID；客户端无法通过请求 JSON 选择其他身份。它不被呈现为账户认证。生产环境账户需要真正的身份/会话系统、轮换/撤销策略、CSRF/威胁模型审查，以及可能更短的凭证有效期。

**证据：** `src/modules/session/http/session-cookie.ts`、`POST /api/session` 测试。

### 7. 为什么使用乐观并发？它解决了什么竞态条件？

**答案：** 刷新恢复和多个标签页可能持有相同评估的陈旧副本。每个聚合变更都携带 `expectedRevision`。仓储执行数据库比较并交换更新，受 `sessionId + IN_PROGRESS + revision` 约束。如果另一个写入者在初步读取后获胜，变更影响零行，请求变为 `409 ASSESSMENT_VERSION_CONFLICT`，因此陈旧数据无法静默覆盖更新的答案。

浏览器也将此冲突作为恢复路径处理：在 `ASSESSMENT_VERSION_CONFLICT` 时，它重新获取规范评估状态并将 UI 移动到最新的服务器派生步骤，而不是让用户停留在陈旧版本上。

**证据：** `PrismaAssessmentRepository.saveStep()`、`optimistic-concurrency.test.ts`、`assessment-funnel.test.tsx`。

### 8. 写入前的初步读取是否存在竞态条件？

**答案：** 是的，但正确性不依赖于它。读取用于领域策略和用户友好的验证。数据库 CAS 是并发边界。读取后的竞态条件由修订条件更新检测。仓储还使用 `updateManyAndReturn`，因此成功响应携带其自身 CAS 语句产生的精确行；它不执行可能意外观察到后来写入者的第二次 SELECT。

### 9. 为什么提交使用事务和结果快照？

**答案：** 完成有两个必须一起提交的不变式：评估变为 `COMPLETED`，并且恰好一个规范结果被持久化。事务原子性地执行 CAS 完成和快照创建。快照是版本化的，因此后来的计算代码更改无法静默重写早期用户看到的内容。

**证据：** `PrismaAssessmentSubmissionRepository.completeAssessment()`、唯一 `AssessmentResult.assessmentId`、`calculationVersion`。

### 10. 如果第一次提交成功但 HTTP 响应丢失会发生什么？

**答案：** 重试会看到已完成的评估和现有的规范结果，并返回成功而不重新计算或插入另一个快照。提交重试语义故意不同于陈旧答案写入：重试完成是幂等的，而陈旧 PATCH 仍然是严格冲突。

**证据：** `submit-assessment.test.ts` 重试情况。

### 11. `/pay` 在并发下如何保持幂等性？

**答案：** 调用者提供一个会话范围的幂等键。PostgreSQL 在 `(sessionId, idempotencyKey)` 上强制执行唯一性。支付事件插入和 FREE→ACTIVE 状态更改在一个事务中发生。具有相同键的并发请求被测试：一个插入事件，另一个返回 `replayed: true`，并持久化一个事件。重放路径仍然幂等地重新建立 ACTIVE，因此去重记录无法使 API 声称成功，同时规范访问仍为 FREE。

**证据：** `PrismaPaymentRepository`、`payment.test.ts`。

### 12. 为什么分别使用 400、409、415 和 422？

**答案：** 它们代表不同的客户端恢复行为。`400` 表示 JSON/schema 内容格式错误或结构无效。`409` 表示有效请求与聚合顺序、生命周期或乐观修订冲突。`415` 表示调用承载 JSON 的端点时使用了不同的媒体类型，并在正文解析前被拒绝。`422` 表示标量候选项结构有效但与当前领域上下文矛盾，例如为 `LOSE_WEIGHT` 设置更高的目标。稳定错误码是主要的机器契约。

**证据：** `docs/04-api-contract.md`、Route Handlers。

### 13. 为什么拒绝直接不一致的目标，但在上游编辑后保留旧目标？

**答案：** 新提交的矛盾目标没有理由被持久化，因此返回 `422` 而不推进修订。相比之下，旧目标在最初输入时可能是有效的；在上游目标/当前体重编辑后，它作为历史草稿数据被保留，而派生进度移回 `TARGET_WEIGHT`。这避免了破坏性清除，同时仍然阻止提交。

### 14. 前端和后端如何避免 API 类型漂移？

**答案：** 公共请求/响应形状是可执行的 Zod 契约，DTO 类型从中推导；Route Handlers 验证出站成功正文，浏览器客户端使用相同模式验证接收的正文。错误信封也是区分契约，包括代码特定的详细信息和一个错误码到 HTTP 状态的映射。领域字面值只声明一次，步骤命令从一个区分模式推导，详尽映射将步骤集与路由、UI、领域策略和持久化关联。仅编译的夹具还证明应用 DTO 投影和生成的 Prisma 枚举/字段保持对齐，而无需让领域导入 Prisma。更强的 TypeScript 标志（`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitReturns` 等）将意外漂移变为构建失败。

**证据：** `src/modules/assessment/contracts/`、`src/contracts/api-error.ts`、`src/modules/assessment/infrastructure/prisma-domain-alignment.typecheck.ts`、`src/lib/browser-api.ts`，以及它们的契约/类型检查测试。

### 15. HTTP Zod 检查是防止无效值的唯一保护吗？

**答案：** 不是。Zod 在传输边界拒绝格式错误的客户端输入，但领域解析器/提交验证也会重新检查冻结的标量范围。如果存储的数据来自旧迁移、手动操作、种子或其他非 HTTP 路径，这一点很重要。持久化的契约外值不能被视为完整评估或用于创建结果快照。

**证据：** `assessment.ts`、`submission.test.ts` 和 `database-invariants.test.ts`。

### 16. 如果 Zod 和领域验证已存在，为什么还要添加数据库 CHECK 约束？

**答案：** 它们保护不同的边界。Zod 保护 HTTP 输入，领域保护业务决策，而 CHECK 约束阻止直接、种子、遗留或未来的持久化路径存储结构上不可能的值。数据库现在支持标量边界、非负修订、生命周期时间戳一致性、支付键形状和基本结果合理性。目标/目标方向故意保留为领域规则，因为上游编辑允许将较旧目标保留为草稿数据。

### 17. 为什么高级字段是省略而不是返回并模糊？

**答案：** CSS 隐藏不是授权。FREE 投影构造一个包含 `{ locked: true }` 的不同 DTO，并且从不序列化卡路里/日期值。相同的存储快照仅在服务器端订阅状态变为 ACTIVE 后才完全投影。

**证据：** `result-projection.ts`、`free-result.test.ts` 序列化值断言。

### 18. 为什么测量和 BMI 使用 `Float` 而不是 Decimal？

**答案：** 这些值没有财务精确十进制要求。领域函数拥有显式显示舍入，而 PostgreSQL/Prisma Float 保持 TypeScript/JSON 边界简单。如果领域后来需要精确的定点测量语义，持久化类型可以独立于 API 形状进行更改。

### 19. 为什么只有两个 Playwright 测试？

**答案：** 浏览器测试证明两个最高价值的集成路径：FREE 和付费。边界排列、陈旧写入、并发和幂等性在针对真实 PostgreSQL 的领域/集成测试中更快且更具诊断性。这保持了 E2E 信号高，而不是在慢速浏览器矩阵中重复每个较低级别的情况。

### 20. 为什么使用真实 PostgreSQL 集成测试而不是模拟 Prisma？

**答案：** 本次挑战的难点在于数据库语义：乐观 CAS、唯一性、事务回滚、重试行为和状态恢复。模拟 Prisma 将测试我们的模拟而不是这些保证。可丢弃的 PostgreSQL 服务在集成套件之前应用已提交的迁移。

### 21. 为什么本地 Playwright 占用端口 3100？

**答案：** 最初本地 Playwright 可以重用端口 3000 上任何响应的开发进程，并意外验证陈旧代码。它现在在专用的 `127.0.0.1:3100` 服务器上启动当前结账，并禁用重用。当提供 `E2E_BASE_URL` 时，远程生产验证完全跳过本地应用/数据库引导。

### 22. 为什么 API 响应使用 `Cache-Control: private, no-store`？

**答案：** 每个 API 响应都是会话特定的，FREE/ACTIVE 有效负载可能对相同 URL 不同。正确性不应依赖于当前的 Cloudflare/Next 缓存默认值。一个共享辅助函数为成功和错误 JSON 应用显式的 private/no-store 策略。

### 23. 最重要的生产环境错误是什么？

**答案：** 首次公开并发 Playwright 运行耗尽了专用 PostgreSQL 角色，因为生产环境 `getPrismaClient()` 创建了重复的 Prisma/pg 池。生产模式回归测试被设置为首先失败，然后应用被更改为共享一个客户端并将其池限制为四个连接。相同的公开 FREE/付费流程在重新部署后通过。这是生产环境证据推翻本地绿色代码信心的有用示例。

### 24. AI 实际做了什么，你个人决定了什么？

**答案：** AI 加速了参考分析、测试枚举、重复实现、依赖审查和调试。开发者拥有需求解释和接受/拒绝决策。具体被拒绝/纠正的 AI 辅助建议包括持久化 `currentStep`、仅 CSS 高级隐藏、不支持的 ESLint/TypeScript 升级、每个请求的生产 Prisma 生命周期、缺少显式 no-store 缓存，以及持久化语义不一致的目标候选项。证据循环是需求→失败测试/重现→实现→独立门。

**证据：** `docs/07-ai-usage-log.md`、`docs/12-ai-retrospective.md`。

## 两分钟代码演练

评审者要求“展示重要代码”时，可以按照以下顺序进行：

1. `prisma/schema.prisma` — 所有权、修订、结果快照、支付唯一约束。
2. `src/modules/assessment/domain/assessment.ts` — 派生进度和跨字段有效性。
3. `src/modules/assessment/application/save-assessment-step.ts` — 无 Prisma/HTTP 的应用编排。
4. `src/modules/assessment/infrastructure/prisma-assessment-repository.ts` — 修订 CAS。
5. `src/modules/assessment/infrastructure/prisma-assessment-submission-repository.ts` — 原子完成/快照。
6. `src/modules/assessment/domain/result-projection.ts` — FREE 值在结构上缺失。
7. `src/modules/payment/infrastructure/prisma-payment-repository.ts` — 事务 + 唯一幂等键。
8. `src/test/integration/optimistic-concurrency.test.ts` 和 `payment.test.ts` — 可执行的数据库证据。
9. `src/test/e2e/*.spec.ts` — 完整的产品闭环。
10. `docs/12-ai-retrospective.md` — 判断力而非泛泛的“AI 辅助”声明。

## 应回避的答案

避免说：

- “我使用 DDD 因为它是最佳实践。”解释具体的边界/问题。
- “事务使一切线程安全。”准确命名它保护的不变式/行。
- “UUID 是安全认证。”它是演示匿名持有者会话。
- “卡路里公式在医学上是准确的。”它是确定性工程演示策略。
- “所有边缘情况都已覆盖。”命名有意排除的情况。
- “AI 编写了大部分内容但测试通过了。”解释哪些建议被拒绝以及原因。
- “最新依赖总是更好。”仓库故意拒绝不兼容的主版本升级。

## 正确答案是局限性的剩余问题

有力的答辩应该承认而不是隐藏这些边界：

- 没有账户身份、密码恢复、设备/会话撤销或完整的 CSRF 威胁模型工作；
- 没有真实支付提供商、webhook 签名、退款、到期、循环计费或计划生命周期；
- 没有多评估历史/重启模型；
- 没有为每个应用边界提供数据库 CHECK 约束；
- 没有广泛的负载/性能基准或多区域设计；
- 本次挑战中仅支持 Chromium 的 E2E；
- 计算策略是确定性演示逻辑而非临床指南。

预期的答案不是“我忘记了这些”，而是“我将它们保持在三天任务要求之外，如果需求出现，我会在那里添加它们。”