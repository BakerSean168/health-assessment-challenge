# 实施计划

## 1. 策略

实施采用纵向 TDD 切片的方式推进，而非"先完成数据库，再做后端，然后前端，最后补测试。"

架构首先被有意识地定义清楚，但只有在失败的行为需要时才添加代码。

## 2. 第 0 阶段 — 仓库与文档

### P0.1 公开仓库

**状态：** 已完成

验收条件：

- 仓库存在于开发者的 GitHub 账户下；
- 可见性为 public；
- `main` 是默认分支；
- 仓库描述传达了挑战的意图。

### P0.2 架构基线

**状态：** 已完成 — 领域模型 v0.2 在实施前已冻结

产出物：

- README；
- 范围/成功标准；
- 参考漏斗审计；
- 架构；
- 数据模型；
- API 契约；
- TDD 矩阵；
- 实施计划；
- AI 使用日志；
- 决策日志。

## 2.1 领域冻结门禁

**状态：** 已完成 — v0.2

在 T01 开始之前，实施必须遵守以下冻结约束：

- 一个 `AnonymousSession` 拥有一个 v1 `Assessment`；
- 不持久化 `currentStepKey`；进度从答案中派生；
- `ANALYZING`/profile/projection/paywall 是展示状态，而非答题步骤；
- 所有七个答案组（包括目标体重）在 v1 中均为必填；
- 对早期答案的编辑会重新验证后续依赖的答案；
- 过期的答案写入返回严格的 `409` 冲突，包括相同值的过期重试；
- 首次提交使用聚合修订控制，而成功完成后重试返回已有结果；
- 模拟支付使用会话范围的 `idempotencyKey`；
- 身体测量使用 `Float`，由领域控制舍入。

计算策略常量有意保留到 T09，届时 ADR + RED 测试在生产计算代码之前将其冻结。

## 3. 第 1 阶段 — 项目引导

### T01 初始化 Next.js/TypeScript 工具链

**状态：** 已完成 — 2026-09-10

RED/验证先行：

- 添加一个简单测试证明测试运行器可以执行；
- 添加 `typecheck`、`lint`、`test` 和 `build` 脚本。

实施内容：

- Next.js App Router 应用；
- 严格 TypeScript；
- Tailwind CSS；
- shadcn/ui 使用 Base UI 组件基座显式初始化；
- 仅添加引导/演示工作所需的最小初始 shadcn 原语集，而非批量安装注册表；
- ESLint；
- Vitest；
- Playwright 脚手架；
- 环境变量示例；
- 格式化约定；
- 锁定 Node/pnpm 工具链元数据。

验收条件：

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

以上全部从干净安装后成功执行。

已实施基线：

- Node.js `24.19.0` 和 pnpm `11.22.0` 在仓库元数据中锁定；
- Next.js `16.3.4`、React `19.2.8`、严格 TypeScript；
- Tailwind CSS v4；
- shadcn/ui 使用显式 `--base base` 和 `base-nova` 预设初始化；
- 首个共享 `Button` 原语从 shadcn 添加而非本地重新创建；
- Vitest `5.0.0` 和 Playwright `1.63.0` 搭建完成；
- `.env.example`、`.editorconfig`、`AGENTS.md`、lint/typecheck/test/build 脚本；
- 对齐 `@types/node` 与 Node 24 / Vitest 要求后，对等依赖检查干净。

T01 TDD 证据：引导测试在 Vitest 安装之前就已存在，`pnpm test` 因 `vitest: not found` 而失败（RED）。安装/配置运行器后，同一测试通过（GREEN），随后成功完成 typecheck、lint 和生产构建。

### T02 PostgreSQL + Prisma 测试基础

**状态：** 已完成 — 2026-09-10

RED：

- 集成冒烟测试需要持久化行的往返验证。

实施内容：

- Prisma schema 基础；
- 迁移策略；
- 本地/测试数据库配置；
- 确定性测试夹具清理。

验收条件：

- 迁移从空数据库成功应用；
- 集成测试连接真实数据库；
- 测试中不使用生产凭证。

已实施基线：

- Prisma ORM `7.10.0` 使用 v7 `prisma-client` 生成器；
- `@prisma/adapter-pg` + `pg` 用于 PostgreSQL 连接；
- `compose.test.yaml` 中的可丢弃 PostgreSQL 17 测试服务，本地端口 `55432`；
- 初始 `AnonymousSession` 表和 `SubscriptionStatus` 枚举迁移；
- `createPrismaClient(connectionString)` 测试/应用工厂加延迟开发单例访问；
- 生成的 Prisma 客户端被排除在 git 之外，通过 `postinstall` 在全新 `pnpm install` 时重新生成；
- 集成测试与单元/引导测试分离，串行运行并连接真实数据库；
- 测试运行器在集成执行前应用已提交的迁移；
- pnpm build-script 允许列表仅显式批准工具链所需的 Prisma/esbuild 生命周期脚本。

T02 TDD 证据：`database.test.ts` 首先因持久化适配器不存在而失败（RED）。Prisma/PostgreSQL 设置完成后，同一测试通过真实 PostgreSQL 实例完成了 `AnonymousSession` 的往返（GREEN）。销毁并从空状态重建测试数据库后，已提交的迁移成功重新应用。

## 4. 第 2 阶段 — 会话与渐进持久化

### T03 匿名会话引导

**状态：** 已完成 — 2026-09-10

验收标准：

> 新浏览器获取一个服务器拥有的会话，使用相同 cookie 重新访问时复用该会话。

RED 之后的实施：

- T02 的 `AnonymousSession` 模型加上会话契约所需的最小 1:1 `Assessment` 外壳；
- 安全 cookie 辅助函数；
- `POST /api/session`；
- 会话仓储端口 + Prisma 适配器 + 应用用例；
- 查找前对客户端提供的 cookie 值进行 UUID 校验。

已实施行为：

- 新请求原子性地创建一个会话和一个 `IN_PROGRESS` 评估；
- 新会话响应 `201`，复用已有会话响应 `200`；
- 相同 cookie 复用同一已持久化的身份，不会创建重复评估；
- 未知/客户端选择的会话 ID 不被信任，替换为新创建的服务器会话；
- 原始会话 ID 仅通过 30 天 HttpOnly、`SameSite=Lax`、路径范围的 cookie 携带；生产环境启用 `Secure`；
- 响应仅暴露订阅/评估状态，不暴露原始会话 ID。

T03 TDD 证据：路由级集成测试在 `src/app/api/session/route.ts` 存在之前编写，因模块解析失败（RED）。会话用例/仓储/cookie 适配器和 `Assessment` 外壳迁移实现后，三个路由行为全部针对 PostgreSQL 通过（GREEN）。

### T04 首次评估与首个保存步骤

**状态：** 已完成 — 2026-09-10

验收标准：

> 保存 `GENDER` 持久化答案并递增修订号。

RED 之后的实施：

- `Gender` 枚举和可空 `Assessment.gender` 持久化字段；
- 语义化的 `getNextRequiredStep()` 领域解析器，从第一个可观测状态开始（`GENDER` -> `GOAL`）；
- 评估仓储端口 + Prisma 适配器；
- 专门的 `saveGenderStep` 应用用例；
- 严格的 gender Zod 请求契约；
- `PATCH /api/assessment/steps/:stepKey` 路由处理器，支持第一个步骤；
- 稳定的 API 错误信封，涵盖会话、校验、未找到和版本冲突边界。

已实施行为：

- 有效性别持久化并将 `revision` 从 0 递增到 1；
- 响应从领域状态派生 `nextRequiredStep: GOAL`，而非硬编码存储的进度指针；
- 无效枚举值在持久化前被拒绝，不递增修订号；
- 没有有效会话的请求以 `401 SESSION_REQUIRED` 被拒绝；
- 拥有有效 UUID 但不拥有评估时返回 `404 ASSESSMENT_NOT_FOUND`，而非误导性的版本冲突；
- 持久化结果区分 `saved`、`not_found` 和 `conflict`，将 HTTP 状态映射排除在 Prisma 适配器之外。

T04 TDD 证据：路由集成测试首先因步骤路由不存在而失败（RED）。随后一个单独的领域测试因 `getNextRequiredStep` 不存在而失败，阻止实现硬编码 `GOAL`。最后，一个所有权/错误测试暴露了缺失评估被错误地合并为 `409` 的问题；仓储结果被精炼，直到 API 返回预期的 `404`。所有 T04 用例随后通过（GREEN）。

### T05 恢复评估

**状态：** 已完成 — 2026-09-10

验收标准：

> 已保存的答案和语义化下一步在刷新/重新访问后仍然保留。

RED 之后的实施：

- `GET /api/assessment`；
- 应用恢复用例 + 仓储读取模型；
- 稳定的恢复 DTO；
- 派生的 `nextRequiredStep` 解析器（无持久化的当前步骤列）；
- 会话引导响应更新为在持久化答案存在后使用相同的派生进度语义。

已实施行为：

- 已保存的性别在后续请求后仍然保留，并从数据库返回；
- 恢复返回 `revision` 并将 `GOAL` 派生为下一个必需步骤；
- 响应已预留完整的 v1 答案结构，尚未输入的值表示为 `null`；
- 使用现有 cookie 重试 `POST /api/session` 现在报告派生的持久化进度，而非将响应投影重置为 `GENDER`；
- 缺失/格式错误的会话身份返回 `401 SESSION_REQUIRED`；
- 未知但语法有效的会话身份返回 `404 ASSESSMENT_NOT_FOUND`。

T05 TDD 证据：恢复测试套件在 `GET /api/assessment` 存在之前编写，因模块解析失败（RED）。测试还指定了保存答案后重试会话引导必须报告 `GOAL`，阻止引导端点保留其早期硬编码的 `GENDER` 投影。四个恢复行为现在全部通过（GREEN）。

### T06 其余答案契约

**状态：** 已完成 — 2026-09-10

每次添加一个步骤，每个步骤带有 RED 验证/持久化用例：

- goal；
- activity；
- height；
- 当前体重；
- age；
- 目标体重。

验收条件：

- 每个步骤都有有效/边界/无效用例；
- 全部通过相同的用例模式持久化，不使用包含业务逻辑的巨大路由 switch。

已实施行为/设计：

- Prisma 现在持久化 `goal`、`activityLevel`、`heightCm`、`weightKg`、`age` 和 `targetWeightKg`，使用枚举支持的分类字段；
- 所有七个路由键通过一个隔离的运行时契约模块解析并转换为类型化的领域命令；
- 标量数值边界在可执行测试中冻结：年龄 18–100 整数，身高 120–230 cm，当前/目标体重 25–300 kg；
- HTTP 路由处理器不再包含按步骤的业务 switch；
- T04 的首个步骤专用应用/仓储路径在第二批行为证明抽象合理性后，被重构为通用的 `saveAssessmentStep` 用例和类型化持久化命令；
- 一个 Prisma 适配器将类型化步骤命令映射到显式列并递增聚合修订号；
- `getNextRequiredStep()` 现在覆盖完整的 v1 答案结构，全部七个答案存在后返回 `null`；
- 恢复和重复会话引导均读取完整的已持久化答案状态。

T06 TDD 证据：运行时契约测试套件首先因共享步骤解析器不存在而失败；当 `goal` 命中仅限性别的路由时，集成测试同时失败（RED）。引入通用契约/应用/持久化路径和其余 schema 字段后，边界测试和完整的七个答案往返通过（GREEN）。标量范围作为项目选择而非来源提供的医疗规则进行记录。

## 5. 第 3 阶段 — 状态一致性

### T07 步骤顺序策略

**状态：** 已完成 — 2026-09-10

验收条件：

- 下一个合法的未解析步骤可以成功写入；
- 已回答的较早步骤在进行中可以编辑；
- 较早编辑后，依赖的后续答案被重新验证；
- 跳过未解析步骤返回 `STEP_OUT_OF_ORDER`；
- `nextRequiredStep` 正确派生，无需持久化重复的进度状态。

已实施行为：

- 应用用例在变更前加载当前聚合状态并验证语义化步骤策略；
- 在 `IN_PROGRESS` 状态下，仅当前未解析步骤或已存在的答案可以被写入；
- 尝试跳过未解析的前提步骤返回 `409 STEP_OUT_OF_ORDER`，携带服务器派生的 `nextRequiredStep`，不改变修订号；
- 编辑较早已回答的步骤仍然合法，并保留不相关的后续答案；
- 目标体重的有效性现在是上下文化的：减重 `<` 当前体重，增重 `>` 当前体重，维持 `===` 当前体重；
- 更改较早的目标可能使现有目标体重失效，并将派生进度移回 `TARGET_WEIGHT`；
- 持久化仍在策略验证后执行修订条件更新，因此读取和写入之间的并发变更仍受仓储 CAS 边界保护。

T07 TDD 证据：单元测试首先因 `validateStepWrite()` 和上下文目标验证不存在而失败，而集成测试证明 API 错误地接受了跳过的 `HEIGHT`。在 GREEN 阶段，一个提出的单元测试夹具本身被发现是错误的：它声称测试跳过的身高，但 `heightCm` 已经被填充，根据冻结的策略这是合法编辑。夹具被修正，而非修改生产代码来满足无效测试。所有领域和集成行为随后通过。

### T08 乐观并发

**状态：** 已完成 — 2026-09-10

验收条件：

- 过期的 `expectedRevision` 返回 `409`，包括相同值的过期重试；
- 更新的已持久化值保持不变；
- 成功写入恰好递增一次。

验证结果：

- 两个使用修订号 `0` 的请求并发地针对同一 PostgreSQL 评估执行；
- 恰好一个返回 `200`，恰好一个返回 `409 ASSESSMENT_VERSION_CONFLICT`；
- 持久化修订号恰好递增到 `1`，且仅保留获胜的值；
- 使用过期修订号 `0` 重放相同值仍被拒绝并返回 `409`，保留显式的过期客户端契约。

T08 不需要新的生产逻辑：验收测试立即通过，因为 T04/T06 中引入的修订条件 Prisma 更新加上 T07 的应用级修订检查已经满足了行为要求。我们保留此显式可执行验证，而非制造人工 RED 状态或重写工作中的并发代码以声称 RED/GREEN 循环。

## 6. 第 4 阶段 — 计算与提交

### T09 冻结计算策略

**状态：** 已完成 — 2026-09-10

在编写生产计算代码之前：

- 创建摄入量和目标日期公式的 ADR；
- 定义接受的测量范围；
- 定义舍入规则；
- 定义 BMI 分类阈值；
- 明确声明非医疗意图。

在 `10-calculation-policy.md` 中冻结为 `demo-v1`：

- BMI 公制公式；一位小数显示/存储；在 18.5/25/30 处进行原始值分类；
- Mifflin–St Jeor 静息估算，`OTHER` 有显式的中点回退；
- 项目定义的活动乘数 1.2 / 1.375 / 1.55 / 1.725 / 1.9；
- 减重/维持/增重调整 -300 / 0 / +300 kcal/天；
- 防御性 1000 kcal/天下限和最近 10 舍入；
- 静态 0.5 kg/周目标日期投影，用于减重/增重；维持返回 `referenceDate`；
- UTC 日历日期语义和注入的时间；
- 必需的 RED 向量和限制；
- 外部引用与项目常量分开，以便 README 不暗示挑战提供了医疗算法。

### T10 计算单元测试

**状态：** 已完成 — 2026-09-10

RED 先行，覆盖：

- BMI；
- BMI 分类边界；
- 摄入策略；
- 减重/维持/增重差异（如支持）；
- 目标日期；
- 已达目标的情况；
- 确定性参考日期。

已实施的纯领域函数：

- `calculateBmi()` 计算公制 BMI，存储/显示一位小数，并从未舍入值进行分类；
- `calculateRecommendedDailyCalories()` 实现冻结的 Mifflin/活动/目标/守卫/最近 10 `demo-v1` 策略；
- `estimateTargetDate()` 将注入的参考时间规范化为 UTC 日历日期并应用静态投影；
- 没有函数导入 Prisma/Next.js/环境/cookie 或读取系统时钟。

T10 TDD 证据：`calculation.test.ts` 首先从已冻结的策略编写，因 `calculation.ts` 不存在而失败（RED）。随后添加生产模块，直到全部 22 个表驱动和边界用例通过（GREEN），包括原始值与舍入 BMI 阈值行为、所有性别/活动/目标分支、下限卡路里守卫、部分周舍入和 UTC 日期规范化。

### T11 提交 + 结果快照

**状态：** 已完成 — 2026-09-11

验收条件：

- 不完整评估因缺少/无效步骤被拒绝；
- 首次过期提交使用 `expectedRevision` 被拒绝；
- 完整评估原子性地创建一个结果快照并完成聚合；
- 首次成功提交时聚合修订号递增；
- 计算版本被持久化；
- 成功完成后重试返回已有结果，即使聚合修订号已经前进。

已实施行为：

- `validateAssessmentReadyForSubmission()` 派生完整的缺失/无效语义步骤列表，仅在草稿有效时返回类型化的完整答案集；
- 严格的提交输入仅接受 `expectedRevision`，永远不接受客户端计算的结果值；
- 首次提交在调用 `calculateAssessmentResult()` 之前验证所有权、修订号和完整性；
- `AssessmentResult` 持久化 BMI、分类、推荐卡路里、估计日历日期、计算版本和创建时间戳；
- 评估完成、修订号递增、`completedAt` 和结果创建在一个 Prisma 事务中发生；
- 唯一的 `AssessmentResult.assessmentId` 确保每个评估只有一个规范结果；
- 完成状态后重试在不重新计算或不产生重复行的情况下返回成功，即使调用者携带完成前的修订号；
- 首次过期提交仍返回 `409 ASSESSMENT_VERSION_CONFLICT` 且不创建结果。

T11 TDD 证据：领域就绪测试和路由集成测试套件均在提交模块存在之前编写，因模块解析失败（RED）。在 GREEN 阶段，一个不完整的 schema 编辑意外生成了新的 BMI 枚举但遗漏了 `AssessmentResult` 模型；集成测试立即失败，因为 `prisma.assessmentResult` 不存在。该错误的未提交迁移被丢弃，可丢弃数据库从四个已提交的迁移重建，修正后的结果快照迁移生成并验证后测试通过。这正是真实数据库集成套件旨在暴露的持久化连接缺陷。

## 7. 第 5 阶段 — 结果访问与支付

### T12 免费结果策略

**状态：** 已完成 — 2026-09-11

验收条件：

- BMI/公开摘要可用；
- 高级字段表示为锁定状态；
- 实际高级值不出现在序列化响应中。

已实施行为：

- `projectFreeResult()` 从存储的结果快照构建专用 DTO；
- BMI 值/分类是公开的；
- 卡路里和目标日期部分仅暴露 `{ locked: true }`，永远不携带底层值；
- `GET /api/assessment/result` 在服务器端解析当前会话并通过仓储端口查询结果；
- 缺失/格式错误的会话身份返回 `401 SESSION_REQUIRED`；
- 没有结果快照的有效会话返回 `404 RESULT_NOT_FOUND`；
- 序列化断言验证实际的卡路里/日期值不存在于免费 JSON 中，而非仅通过 CSS 隐藏。

T12 TDD 证据：领域投影和路由集成测试套件在投影模块/路由存在之前创建，两者均因模块解析失败（RED）。添加最小的免费结果投影、仓储、用例和路由后，两个投影用例加三个 PostgreSQL 支持的路由用例通过（GREEN）。

### T13 模拟支付

**状态：** 已完成 — 2026-09-11

验收条件：

- 有效支付将 `FREE -> ACTIVE`；
- 支付事件被持久化；
- 相同会话范围的 `idempotencyKey` 可以重放而不重复副作用。

已实施行为：

- `PaymentEvent` 仅存储模拟的 `idempotencyKey`、会话所有权、`SUCCEEDED` 状态和时间戳；
- PostgreSQL 对 `(sessionId, idempotencyKey)` 施加复合唯一性约束，因此相同键可被不同会话有意复用；
- `/api/pay` 仅从 HttpOnly 会话 cookie 读取所有权，不接受客户端 `sessionId` 字段；
- 严格支付契约将键限定为 1–128 个安全标识符字符；
- 一个事务使用 `createMany(..., skipDuplicates: true)` 加上订阅更新，使重复键合并而不产生重复副作用；
- 重复相同键请求返回 `replayed: true`，而首次应用返回 `false`；
- 并发相同键请求被测试，恰好产生一个事件，一个 applied/一个 replay 响应；
- 无效请求体返回 `400 PAYMENT_INVALID`；缺失身份返回 `401 SESSION_REQUIRED`；未知身份返回 `404 SESSION_NOT_FOUND`。

T13 TDD 证据：契约和路由集成测试在支付契约/路由存在之前编写，因模块解析失败（RED）。最终的 PostgreSQL 集成测试套件包含顺序重放、并发重放、会话范围唯一性、激活、无效输入和身份边界用例（GREEN）。

### T14 激活结果策略

**状态：** 已完成 — 2026-09-11

验收条件：

- 相同的结果端点在激活后返回完整结果；
- 不发生第二次"仅高级"计算。

已实施行为：

- `projectResult(snapshot, access)` 是唯一的订阅感知领域投影；
- FREE 保留 T12 的锁定 DTO 并继续省略高级值；
- ACTIVE 暴露存储的卡路里值并将存储的目标日期序列化为 `YYYY-MM-DD`；
- 相同的 `GET /api/assessment/result` 端点根据服务器拥有的订阅状态切换投影；
- 支付仅更改订阅/访问状态，永远不调用计算策略；
- 集成测试有意播种与评估输入会计算出的不同结果值，然后支付并验证返回的恰好是这些存储值。结果行 ID 和 `createdAt` 保持不变，证明解锁使用的是已有快照而非重新计算。

T14 TDD 证据：领域测试因 `projectResult` 不存在而失败，API 集成测试因 ACTIVE 会话仍收到 FREE 投影而失败（RED）。添加激活 DTO 并从存储的订阅状态选择后，两个套件通过（GREEN）。

## 8. 第 6 阶段 — 产品 UI

### T15 评估外壳

**状态：** 已完成 — 2026-09-11

使用 `09-ui-component-policy.md` 中的 UI 组件策略实现可复用的漏斗布局：

- 在本地构建等效组件之前，先添加合适的 shadcn/ui Base UI 支持的原语；
- 进度指示器；
- 问题标题/辅助文案；
- 答案控件；
- 继续/返回行为；
- 保存/加载/错误反馈；
- 响应式布局；
- 产品特定的组合和变体可以扩展本地 shadcn 源，但不得创建并行的通用组件系统。

已实施基线：

- 仅添加 T15–T17 预期的 shadcn/Base UI 原语（`Progress`、`RadioGroup`、`Input`、`Card`、`Alert`、`Skeleton`、`Separator`、`Dialog`、`Label`），同时保留现有库的 `Button`；
- 创建 `AssessmentShell` 作为产品组合而非替代原语；
- shell 组合 shadcn `Card`、`Progress` 和 `Button`，提供响应式宽度/间距、语义化标题、步骤计数、无障碍进度条、可选辅助文案、可选返回操作和底部插槽；
- 添加 React Testing Library + jsdom 用于行为聚焦的组件测试；测试断言无障碍角色/标签和交互，而非 Tailwind 类快照。

T15 TDD 证据：`assessment-shell.test.tsx` 在产品组件存在之前编写，因导入解析失败（RED）。随后在已安装的 shadcn 原语之上实现外壳，直到进度语义和条件返回行为通过（GREEN）。

### T16 连接已持久化步骤

**状态：** 已完成 — 2026-09-11

验收条件：

- 每个继续操作在导航前保存；
- 服务器错误正确表示；
- 刷新恢复页面和值；
- 过期冲突行为提供安全恢复路径。

已实施行为：

- `/assessment` 现在挂载一个客户端漏斗，引导匿名会话并从 `GET /api/assessment` 恢复权威评估状态；
- 分类问题组合 shadcn/Base UI `RadioGroup`；数值问题组合 shadcn `Input` + `Label`；操作/错误/加载使用共享的 `Button`、`Alert`、`Card` 和 `Skeleton` 原语；
- 所有七个步骤由一个语义化的 `STEP_ORDER` 驱动，而实际的前进目标始终来自服务器返回的 `nextRequiredStep`；
- Continue 在导航前等待 `PATCH` 并携带当前的乐观 `revision`；
- 最后一步保存使用新返回的修订号进行 `POST /submit`，避免过期的最终提交；
- 返回导航恢复已持久化的值，不创建第二个通用表单控件系统；
- 刷新/重新访问从服务器派生的未解析步骤开始；已完成的评估重定向到结果；
- 服务器保存失败保持当前问题可见并在无障碍 alert 中显示 API 消息；
- 客户端数值提示复用与服务器 Zod 验证相同的导出领域输入限制常量，而非重复边界数字；
- 添加了一个共享的条件 Testing Library 清理钩子，使 jsdom 组件测试保持隔离而不影响 Node 领域测试。

T16 TDD 证据：漏斗测试在浏览器 API 适配器/产品组件存在之前编写，因模块解析失败（RED）。首次 GREEN 尝试暴露了两个 UI 测试/运行时问题：jsdom 渲染在测试间累积，Base UI 警告 RadioGroup 从非受控切换到受控。条件全局清理钩子和一致受控的 `value` 修复了两者。Lint 随后捕获了两个未转义的 JSX 撇号，文案在验收前被修正。四个漏斗行为现在通过，随后通过完整的单元/组件、PostgreSQL 集成、typecheck、lint 和生产构建门禁。

### T17 派生反馈页面

**状态：** 已完成 — 2026-09-11

实现紧凑的参考启发式价值时刻：

- 分析过渡；
- 健康/BMI 概况；
- 目标投影；
- 免费结果预览；
- 付费墙/完整结果过渡。

不使用虚假的长时间分析延迟。

已实施行为：

- 最后的评估保存立即过渡到 T16 的提交状态，然后在不可变结果快照存在后导航到 `/result`；
- `/result` 使用专用的浏览器结果适配器，而共享的 JSON/错误处理位于 `src/lib/browser-api.ts`，避免评估和结果客户端之间重复的 fetch/错误管道；
- 结果体验将 BMI/分类渲染为有用的免费反馈，并在 FREE 响应中保持卡路里/日期值结构缺失，匹配 T12 服务器投影而非依赖视觉模糊；
- 结果和付费墙面复用 shadcn/Base UI `Card`、`Dialog`、`Alert`、`Button`、`Separator` 和 `Skeleton` 原语，而非创建并行的通用控件；
- 付费墙明确声明支付为模拟，仅发送会话范围的幂等键；不涉及真实银行卡信息或资金；
- 一个幂等键在支付重试失败时保留，使响应中断不会意外产生第二次逻辑支付尝试；
- 成功支付后，客户端再次调用相同的结果端点，ACTIVE 渲染暴露已存储的快照值而不重新计算；
- 加载和重试状态保持无障碍并保留相同的结果页面，而非引入单独的高级路由。

T17 TDD 证据：`result-experience.test.tsx` 在结果客户端/产品组件存在之前编写，因模块解析失败（RED）。随后添加实现，直到 FREE 反馈、shadcn/Base UI 付费墙、同端点解锁和稳定支付重试幂等行为通过。完整的单元/组件套件、PostgreSQL 集成套件、lint、typecheck 和生产构建在关闭切片前重新运行 GREEN。

## 9. 第 7 阶段 — E2E、CI、部署

### T18 浏览器流程：免费用户

**状态：** 已完成 — 2026-09-11

新浏览器 -> 完成漏斗 -> 提交 -> 免费结果。

断言高级值被可见锁定，且流程可以在不手动修改数据库状态的情况下完成。

已实施行为和证据：

- 添加了首个真实的 Chromium Playwright 路径，覆盖全部七个评估输入和服务器端提交/结果过渡；
- 浏览器在当前体重后有意重新加载，必须从 `AGE` 恢复，证明用户面对的恢复路径在真实 API/数据库上运行而非模拟组件适配器；
- FREE 结果断言 BMI/分类可见、两个高级指标可见锁定且解锁 CTA 可用；
- `/result` 上的第二次重新加载验证存储的快照仍然可用且会话保持 FREE；
- `scripts/e2e.mjs` 通过启动可丢弃 PostgreSQL 17 Compose 服务、应用已提交的迁移并将相同的测试数据库 URL 传递给 Next.js web 服务器使浏览器测试可重现；
- 本地 Playwright 现在拥有专用的 `127.0.0.1:3100` web 服务器端口，`reuseExistingServer: false`，因此 `pnpm test:e2e` 不会对端口 3000 上的过期开发者服务器静默通过。远程验证仍通过 `E2E_BASE_URL` 绕过本地服务器。

T18 TDD 证据：浏览器规范在 E2E 数据库/环境连接之前添加，最初因首个评估标题失败（RED）。添加自包含的 E2E 运行器和一致的 origin 后，同一规范完成真实漏斗并在 Chromium 中通过（GREEN）。

### T19 浏览器流程：付费用户

**状态：** 已完成 — 2026-09-11

新浏览器 -> 完成漏斗 -> 免费结果 -> 模拟支付 -> 同一结果页面解锁。

已实施行为和证据：

- 提取了一个小型 Playwright 流程辅助函数用于重复的七步问卷路径，而非在 FREE 和付费场景间复制选择器；
- 付费浏览器以 FREE 身份开始，打开 shadcn/Base UI 付费墙对话框，确认显式的模拟支付文案，并通过真实的浏览器/API/数据库栈完成 `/pay`；
- 激活后，相同的 `/result` 页面暴露确定性测试夹具存储的 `2,380 kcal/day` 值，并移除两个锁定占位符；
- 重新加载 `/result` 保持会话 ACTIVE 并保留解锁的值，证明访问是服务器持久化的而非本地 UI 状态；
- FREE 和付费 Chromium 路径在独立浏览器上下文中针对同一 PostgreSQL 服务全部通过。

### T20 GitHub Actions

**状态：** 已完成 — 2026-09-11

必需的作业/检查：

- 安装/缓存；
- lint；
- typecheck；
- 单元 + 集成测试；
- 构建；
- Playwright（在环境足够稳定时）。

已实施流水线：

- `Quality`：ESLint、Next 路由类型生成 + TypeScript、83 个单元/组件测试和生产 `next build`；
- `PostgreSQL integration`：从干净运行器启动可丢弃 PostgreSQL 17 Compose 服务，应用所有已提交迁移，重置聚合测试数据，然后运行 49 个集成测试；
- `Chromium E2E`：安装 Playwright Chromium 并针对真实的 Next/API/PostgreSQL 栈练习 FREE 和付费浏览器流程；
- CI 使用 Node 24.21.0 和仓库锁定的 pnpm 11.22.0、只读仓库权限、按 ref 并发取消和失败运行的 Playwright 报告产物；
- 数据库支持的命令是自包含的：`pnpm test:integration` 和 `pnpm test:e2e` 可以启动其默认本地测试数据库，而非依赖未记录的已有容器。

首个干净的 GitHub 运行器暴露了一个真实的可复现缺陷：`tsc --noEmit` 依赖于先前本地 `next dev/build` 运行留下的 `.next/types`，因为根布局使用了 Next 的类型化 `LayoutProps`。修复保留了更强的类型化 API，并将 `pnpm typecheck` 改为 `next typegen && tsc --noEmit`。下一次 CI 运行（`34551951733`）三个作业全部绿色完成。

### T21 公开部署

**状态：** 已完成 — 2026-09-11

验收条件：

- 公开 URL 可加载；
- 迁移/数据库已配置；
- 生产安全 cookie 行为正常工作；
- 完整的评估/支付演示在部署环境中正常工作。

仓库侧准备工作已完成：

- `/` 现在有真实的基于 shadcn 的产品落地体验，而非引导占位符；
- 生产会话 cookie 在 `NODE_ENV=production` 下已变为 `Secure`；
- `pnpm db:migrate:deploy` 提供显式的已提交迁移部署命令；
- `pnpm seed:evaluator-demo` 创建/复用一对数据完全相同的固定 FREE / ACTIVE 评审会话，并打印直接 API 对比所需的会话 cookie 值；
- 付费种子针对可丢弃 PostgreSQL 执行了两次，使用相同 UUID，产生一个结果快照加一个支付事件，证明重试安全的种子；
- `docs/11-deployment.md` 记录环境、迁移、付费会话、cURL 和公开冒烟流程；
- 部署预检发现本地测试 PostgreSQL 端口绑定到所有主机接口；Compose 现在仅绑定 `127.0.0.1:55432`，所有集成测试保持绿色。

当前生产状态：发布流水线将不可变的应用/迁移镜像发布到 GHCR；成都阿里云主机拥有隔离的 `health_assessment` 数据库/角色，全部八个 Prisma 迁移已应用，健康的 Next.js standalone 容器通过现有的私有 Docker 网络连接。`assessment.bakersean.top` 通过 Cloudflare 解析到现有的 Caddy 边缘，Caddy 持有有效证书，FREE 和付费浏览器路径在公开 HTTPS 部署上全部通过。播种了一对数据完全相同、仅订阅状态不同的 FREE / ACTIVE 固定评审会话，供评审者直接比较服务端结果投影。

## 10. 第 8 阶段 — 交付打磨

### T22 文档对账

**状态：** 已完成 — 2026-09-11

已对账的交付文档包括：

- 实际 schema 图；
- 实际端点示例；
- 实际测试数量；
- 实际部署 URL；
- 实际权衡/已知限制；
- 计算策略；
- 设置命令。

### T23 AI 使用回顾

**状态：** 已完成 — 2026-09-11

持续的日志被转换为 `docs/12-ai-retrospective.md`，涵盖：

- AI 在哪些方面节省了时间；
- AI 提出了什么；
- 开发者拒绝的一个或多个提案；
- 拒绝的原因；
- 测试/审查如何捕获了错误。

## 11. 提交策略

优先使用与行为切片对齐的、小型、可审查的提交，例如：

```text
test(session): define anonymous session reuse behavior
feat(session): implement anonymous session bootstrap
refactor(session): isolate cookie adapter

test(assessment): define stale revision conflict
feat(assessment): add optimistic revision update
```

不要在过度拖慢交付时强制分离 RED/GREEN 提交，但在实际可行时在 diff/历史中保留测试先行的证据。

## 12. 三天计划

### 第 1 天

- 引导；
- 数据库/测试基础；
- 会话；
- 渐进持久化；
- 恢复；
- 步骤顺序和修订行为；
- 最小评估 UI 外壳。

### 第 2 天

- 冻结计算 ADR；
- 计算；
- 提交/结果快照；
- 免费结果投影；
- 模拟支付；
- 激活结果；
- 完成核心 UI 流程。

### 第 3 天

- E2E；
- CI；
- 部署；
- 边界情况加固；
- 文档对账；
- AI 回顾；
- 从 README 说明进行最终干净运行。

## 13. 停线条件

如果以下任何一项变为红色，不要继续堆叠功能：

- 迁移无法从空数据库重建 DB；
- 集成测试隔离不可靠；
- 免费结果泄露高级值；
- 刷新丢失权威进度；
- 过期写入可以静默覆盖更新状态；
- 提交或支付重试重复副作用；
- CI 与文档化的本地命令存在实质性差异。
