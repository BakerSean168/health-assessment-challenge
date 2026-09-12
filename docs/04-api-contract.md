# API 契约 v1

## 1. 约定

基础路径：`/api`

认证模型：匿名 HttpOnly 会话 cookie。

内容类型：请求/响应体使用 `application/json`，除非不需要请求体。

所有会话作用域的 API 响应（包括错误响应）均发送 `Cache-Control: private, no-store`，以确保个性化的评估/结果数据不被共享缓存复用。

所有修改评估状态的请求均使用当前服务器会话；调用方不得通过发送任意标识符来选择另一个会话。

所有具有 JSON 请求体的端点均要求 `Content-Type: application/json`（允许 `charset=UTF-8` 等参数）。以 `text/plain` 或其他媒体类型发送的 JSON 格式字节流将在请求体解析前被拒绝，返回 `415 UNSUPPORTED_MEDIA_TYPE`。除了使 HTTP 契约更加明确外，这还可防止状态变更的 JSON 路由接受 CORS 安全列表中的 `text/plain` 请求作为替代的浏览器写入路径。

## 2. 错误信封

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "details": {
      "field": "weightKg"
    }
  }
}
```

初始稳定错误码：

- `VALIDATION_ERROR`
- `SESSION_REQUIRED`
- `SESSION_NOT_FOUND`
- `UNSUPPORTED_MEDIA_TYPE`
- `ASSESSMENT_NOT_FOUND`
- `STEP_OUT_OF_ORDER`
- `STEP_VALUE_INCONSISTENT`
- `ASSESSMENT_VERSION_CONFLICT`
- `ASSESSMENT_INCOMPLETE`
- `ASSESSMENT_ALREADY_COMPLETED`
- `RESULT_NOT_FOUND`
- `PAYMENT_INVALID`

## 3. `POST /api/session`

创建或复用匿名浏览器会话，并确保其唯一的 v1 评估存在。

### 响应 `200` 或 `201`

```json
{
  "orderId": "9f27be8a-ec0b-4ba6-8e9f-8996e0c60a1b",
  "subscriptionStatus": "FREE",
  "assessment": {
    "status": "IN_PROGRESS",
    "nextRequiredStep": "GENDER",
    "revision": 0,
    "answers": {
      "gender": null,
      "goal": null,
      "activityLevel": null,
      "heightCm": null,
      "weightKg": null,
      "age": null,
      "targetWeightKg": null
    }
  }
}
```

`orderId` 是作为关联标识符暴露在 `/assessment?order=...` 和 `/result?order=...` 中的不透明评估 UUID。它**不是**授权凭证：API 读取/写入操作始终仅通过服务器签发的会话 cookie 来解析所有权，没有匹配 cookie 的 `order` 查询参数无法恢复另一个评估。

原始会话标识符不会在 JSON 响应体中暴露。该路由签发名为 `health_assessment_session` 的 30 天 HttpOnly cookie，设置 `SameSite=Lax`、`Path=/`，并在生产环境中启用 `Secure`。缺失、格式错误或未知的 cookie 不允许客户端选择身份；服务器会创建并签发新的会话。引导响应包含当前答案，以便预取的着陆页引导数据可直接供评估页面使用，无需立即发送二次恢复请求。

## 4. `GET /api/assessment`

恢复当前评估状态。

### 响应 `200`

```json
{
  "status": "IN_PROGRESS",
  "nextRequiredStep": "WEIGHT",
  "revision": 4,
  "answers": {
    "gender": "MALE",
    "goal": "LOSE_WEIGHT",
    "activityLevel": "MODERATE",
    "heightCm": 175,
    "weightKg": null,
    "age": null,
    "targetWeightKg": null
  }
}
```

该端点是刷新/重新访问后的标准恢复来源。`nextRequiredStep` 是根据已持久化的答案派生的响应投影，并非数据库列。如果所有必需答案均已有效填写，`nextRequiredStep` 为 `null`，表示评估已可提交。

## 5. `PATCH /api/assessment/steps/:stepKey`

持久化单个评估步骤。

示例：

```http
PATCH /api/assessment/steps/weight
```

### 请求

```json
{
  "value": 72,
  "expectedRevision": 4
}
```

由 `stepKey` 选择的 Zod 模式验证 `value` 的类型/范围。v1 路由键及当前标量契约如下：

| 路由键 | 接受的值 |
|---|---|
| `gender` | `MALE`、`FEMALE`、`OTHER` |
| `goal` | `LOSE_WEIGHT`、`MAINTAIN`、`GAIN_WEIGHT` |
| `activity` | `SEDENTARY`、`LIGHT`、`MODERATE`、`ACTIVE`、`VERY_ACTIVE` |
| `height` | 数值，120–230 cm（含） |
| `weight` | 数值，25–300 kg（含） |
| `age` | 整数，18–100（含） |
| `target-weight` | 数值，25–300 kg（含） |

这些数值边界是本挑战赛的实现选择，并非声称由源需求文档提供。跨字段的 target-weight 有效性由领域步骤策略处理，而非由标量请求模式处理。

### 响应 `200`

```json
{
  "saved": true,
  "revision": 5,
  "nextRequiredStep": "AGE"
}
```

如果早期编辑使依赖答案失效，`nextRequiredStep` 可能向后回退到第一个缺失或上下文无效的步骤。已有的后续值不会被自动删除。在 v1 中，target-weight 一致性遵循简单的确定性规则：减重要求目标体重低于当前体重，增重要求目标体重高于当前体重，维持要求目标体重等于当前体重。这是挑战赛的产品逻辑，而非医疗指导。

缺失或格式错误的会话 cookie 返回 `401 SESSION_REQUIRED`。语法有效但未知的会话身份无法选择其他评估，返回 `404 ASSESSMENT_NOT_FOUND`。

### 未找到 `404`

```json
{
  "error": {
    "code": "ASSESSMENT_NOT_FOUND",
    "message": "The assessment was not found.",
    "details": {}
  }
}
```

### 版本冲突 `409`

```json
{
  "error": {
    "code": "ASSESSMENT_VERSION_CONFLICT",
    "message": "The assessment changed since this page loaded.",
    "details": {}
  }
}
```

### 乱序提交 `409`

```json
{
  "error": {
    "code": "STEP_OUT_OF_ORDER",
    "message": "This assessment step cannot be submitted yet.",
    "details": {
      "nextRequiredStep": "HEIGHT"
    }
  }
}
```

### 语义不一致的值 `422`

即使通过标量验证的目标体重，如果与已选择的目标/当前体重相矛盾，仍会被拒绝。无效候选项不会被持久化，聚合版本号不会递增。

```json
{
  "error": {
    "code": "STEP_VALUE_INCONSISTENT",
    "message": "The target weight does not match the selected goal.",
    "details": {
      "nextRequiredStep": "TARGET_WEIGHT"
    }
  }
}
```

## 6. `POST /api/assessment/submit`

完成评估并生成不可变的结果快照。

### 请求

不接受任何客户端计算值。客户端仅包含其最近观察到的聚合版本号，以确保首次提交不会与较新的答案变更产生竞争。

```json
{
  "expectedRevision": 7
}
```

### 首次成功响应 `200`

```json
{
  "status": "COMPLETED",
  "resultReady": true
}
```

首次成功提交会创建标准结果快照，并在同一数据库事务中将评估状态从 `IN_PROGRESS` 变更为 `COMPLETED`。聚合版本号作为该转换的一部分递增一次。

### 重试语义

如果评估已完成并已生成标准结果快照，则返回已有的成功状态，而非重新计算不同的结果。该已完成结果检查优先于过时的 `expectedRevision`，从而允许对成功提交进行网络重试时保持幂等性。

如果评估仍在进行中且 `expectedRevision` 已过时，则返回 `409 ASSESSMENT_VERSION_CONFLICT`。

### 未完成 `409`

```json
{
  "error": {
    "code": "ASSESSMENT_INCOMPLETE",
    "message": "Complete all required assessment steps before submitting.",
    "details": {
      "missingSteps": ["AGE", "TARGET_WEIGHT"]
    }
  }
}
```

## 7. `GET /api/assessment/result`

返回基于订阅状态的存储结果服务器投影。

### 免费版响应 `200`

```json
{
  "access": "FREE",
  "bmi": {
    "value": 23.5,
    "category": "NORMAL"
  },
  "recommendedDailyCalories": {
    "locked": true
  },
  "estimatedGoalDate": {
    "locked": true
  }
}
```

重要提示：付费值不在 JSON 中返回。它们不会被返回，也不会被 UI 模糊处理。

### 付费版响应 `200`

```json
{
  "access": "ACTIVE",
  "bmi": {
    "value": 23.5,
    "category": "NORMAL"
  },
  "recommendedDailyCalories": {
    "locked": false,
    "value": 2050
  },
  "estimatedGoalDate": {
    "locked": false,
    "value": "2026-12-04"
  }
}
```

示例值仅为契约说明用途，不代表固定的计算预期。

## 8. `POST /api/pay`

模拟支付成功并激活当前会话订阅。

### 请求

```json
{
  "idempotencyKey": "demo_01J_TEST"
}
```

### 响应 `200`

```json
{
  "status": "SUCCEEDED",
  "subscriptionStatus": "ACTIVE",
  "replayed": false
}
```

`idempotencyKey` 是由调用方生成的演示密钥，长度为 1–128 个字符，可使用字母、数字、`.`、`_`、`:` 或 `-`。它仅在当前匿名会话内唯一，不作为真实的支付提供商事务标识符。

### 可重现的 cURL

该端点通过服务器签发的匿名会话 cookie 进行授权。以下两条命令示例创建一个一次性会话 cookie 文件并调用 `/api/pay`，无需浏览器工具：

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

使用相同的 cookie 文件和密钥重复第二个请求将返回 `replayed: true`。

对同一会话作用域的 `idempotencyKey` 进行重放将返回已应用的结果：

```json
{
  "status": "SUCCEEDED",
  "subscriptionStatus": "ACTIVE",
  "replayed": true
}
```

## 9. 契约测试优先级

API 测试应断言稳定的行为，而非偶然的实现细节：

- 状态码；
- 错误码；
- 响应结构；
- 付费值的缺失；
- 版本号递增；
- 请求后的持久化状态；
- 重试后的幂等性；
- 恢复和跨字段编辑后的派生 `nextRequiredStep`；
- 严格的过时写入冲突行为。
