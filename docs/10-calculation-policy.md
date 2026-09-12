# 计算策略 v1

## 1. 范围与安全边界

挑战要求计算 BMI、推荐摄入量和预估目标日期，但并未规定具体公式。因此，本文档在生产计算代码编写之前，先固化了一套**确定性的工程演示策略**。

输出结果仅用于演示领域建模、版本控制、持久化、测试和结果门控，**不构成医疗建议、诊断或个性化临床/营养方案**。

随结果持久化的策略版本：`demo-v1`。

## 2. 外部引用与项目选择

我们刻意将外部可识别的参考公式与仅为确保挑战确定性而选取的常量分离开来。

外部引用：

- CDC 成人 BMI 分类：<https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html>
- Mifflin–St Jeor 静息代谢率（RMR）公式汇总：<https://pmc.ncbi.nlm.nih.gov/articles/PMC5753973/>
- NIDDK 体重规划器（个性化热量/体重规划参考，其规划器使用的 1000 kcal/day 下限保护值）：<https://www.niddk.nih.gov/bwp>
- CDC 关于每周 1–2 磅渐进式减重的说明；此处仅作为背景信息，不代表我们的静态目标日期模型能预测生理变化：<https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html>

项目选择：

- 活动系数；
- ±300 kcal 目标调整；
- 1000 kcal/day 演示下限保护值；
- 0.5 kg/week 静态预测速率；
- 性别特定 Mifflin 常量中 `OTHER` 的算术中点回退；
- 舍入规则。

## 3. BMI

原始 BMI：

```text
heightMeters = heightCm / 100
rawBmi = weightKg / (heightMeters ^ 2)
```

存储/展示的 BMI 四舍五入至一位小数。

分类使用**未舍入**的 BMI 值，因此展示舍入不会导致数值跨越阈值：

| 原始 BMI | `BmiCategory` |
|---:|---|
| `< 18.5` | `UNDERWEIGHT` |
| `>= 18.5 && < 25` | `NORMAL` |
| `>= 25 && < 30` | `OVERWEIGHT` |
| `>= 30` | `OBESE` |

BMI 在参考资料中属于筛查性指标，而非诊断依据。

## 4. 推荐每日热量（演示估算值）

### 4.1 静息能量估算

采用 Mifflin–St Jeor 公式作为可识别的确定性基础：

```text
common = 10 * weightKg + 6.25 * heightCm - 5 * age

MALE   => common + 5
FEMALE => common - 161
OTHER  => common - 78
```

`-78` 是已发布的两个性别特定常量（`(+5 + -161) / 2`）的算术中点。它仅用于确保挑战中 `OTHER` 选项具有确定性行为，而并不意味着原始公式定义了第三种生理类别。这是已记录的局限性。

### 4.2 活动系数

| 活动水平 | 系数 |
|---|---:|
| `SEDENTARY` | 1.2 |
| `LIGHT` | 1.375 |
| `MODERATE` | 1.55 |
| `ACTIVE` | 1.725 |
| `VERY_ACTIVE` | 1.9 |

这些系数是本演示策略的项目常量。

```text
maintenanceEstimate = restingEstimate * activityMultiplier
```

### 4.3 目标调整

| 目标 | 调整量 |
|---|---:|
| `LOSE_WEIGHT` | -300 kcal/day |
| `MAINTAIN` | 0 |
| `GAIN_WEIGHT` | +300 kcal/day |

```text
adjusted = maintenanceEstimate + goalAdjustment
bounded = max(1000, adjusted)
recommendedDailyCalories = roundToNearest10(bounded)
```

1000 kcal 下限是一项防御性演示保护值，与 NIDDK 体重规划器所强制执行的下限一致。不应将其作为普适性的摄入量推荐。

## 5. 预估目标日期（演示预测）

本挑战不实现生理性体重模拟（如 NIDDK 的动态模型），而是采用刻意简化的静态预测，以确保行为可解释、可测试。

```text
PROJECTED_CHANGE_KG_PER_WEEK = 0.5
```

对于 `LOSE_WEIGHT` 和 `GAIN_WEIGHT`：

```text
deltaKg = abs(weightKg - targetWeightKg)
weeks = ceil(deltaKg / 0.5)
targetDate = referenceDate + weeks * 7 days
```

对于 `MAINTAIN`，步骤策略不变量要求 `targetWeightKg === weightKg`，因此：

```text
targetDate = referenceDate
```

0.5 kg/week 是项目的简化值。CDC 的渐进式减重背景大约为每周 1–2 磅，但相同的静态常量用于增重时**不代表**是临床推荐。结果界面/README 必须将目标日期描述为估算值/模拟值。

## 6. 日期语义

`referenceDate` 由应用层注入；领域代码不得调用 `new Date()` 来获取当前时间。

策略将目标日期视为 UTC 时区的日历日期：

1. 将 `referenceDate` 标准化为 UTC 年/月/日；
2. 加上整数天数；
3. 将得到的 UTC 日期持久化到结果快照中；
4. API 日期序列化格式为 `YYYY-MM-DD`。

这防止了测试中的时区和 CI 时钟漂移问题。

## 7. 舍入规则

- BMI：存储/展示值四舍五入至一位小数。
- BMI 分类：使用未舍入值。
- 静息/维持中间能量值：计算过程中保留完整的 JavaScript 数值精度。
- 推荐热量：目标调整和下限保护后四舍五入至最接近的 10 kcal/day。
- 预测周数：始终使用 `ceil` 向上取整，以确保部分周不会产生早于模型下静态预测可达的目标日期的日期。

## 8. T10 所需的 RED 测试向量

在测试编码出至少以下行为之前，不得编写 T10 生产代码：

### BMI

- `70 kg / 175 cm` -> `22.9`，`NORMAL`；
- 使用构造的体重/身高输入测试 18.5、25 和 30 的精确分类阈值；
- 分类使用原始 BMI 而非舍入后的展示 BMI。

### 摄入量

- male/female/other 常量分支；
- 全部五个活动系数；
- lose/maintain/gain ±300 调整；
- 1000 下限保护；
- 最接近 10 的舍入。

### 预测

`referenceDate = 2026-09-10T00:00:00Z` 时：

- `80 -> 72 kg`，减重目标：16 周 -> `2026-12-31`；
- `72 -> 80 kg`，增重目标：16 周 -> `2026-12-31`；
- `80 -> 80 kg`，维持目标：`2026-09-10`；
- 0.1 kg 有效差异仍消耗一个预测周。

## 9. 已知局限性

- 热量估算并非实测能量消耗。
- `gender` 问卷字段不等同于生理性别；因此 `OTHER` 的 Mifflin 回退是一种明确的演示妥协。
- 静态 0.5 kg/week 预测未建模代谢适应、体成分、药物、妊娠、疾病或其他个体因素。
- 该系统有意不替代 NIDDK 动态体重规划器等工具或专业临床指导。
