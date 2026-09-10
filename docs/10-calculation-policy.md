# Calculation policy v1

## 1. Scope and safety boundary

The challenge requires BMI, recommended intake, and an estimated target date, but it does not prescribe the formulas. This document therefore freezes a **deterministic engineering-demo policy** before production calculation code is written.

The outputs are for demonstrating domain modeling, versioning, persistence, tests, and result gating. They are **not medical advice, diagnosis, or an individualized clinical/nutrition plan**.

Policy version persisted with results: `demo-v1`.

## 2. External references vs project choices

We deliberately separate externally recognizable reference formulas from constants chosen only to make the challenge deterministic.

External references:

- CDC adult BMI categories: <https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html>
- Mifflin–St Jeor RMR equation summary: <https://pmc.ncbi.nlm.nih.gov/articles/PMC5753973/>
- NIDDK Body Weight Planner (personalized calorie/weight-planning reference and 1000 kcal/day lower guard used by its planner): <https://www.niddk.nih.gov/bwp>
- CDC notes gradual weight loss around 1–2 lb/week; this is context only, not a claim that our static target-date model predicts physiology: <https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html>

Project choices:

- activity multipliers;
- ±300 kcal goal adjustment;
- 1000 kcal/day demo lower guard;
- 0.5 kg/week static projection rate;
- arithmetic midpoint fallback for `OTHER` in the sex-specific Mifflin constant;
- rounding rules.

## 3. BMI

Raw BMI:

```text
heightMeters = heightCm / 100
rawBmi = weightKg / (heightMeters ^ 2)
```

Stored/displayed BMI is rounded to one decimal place.

Classification uses the **unrounded** BMI so display rounding cannot move a value across a threshold:

| Raw BMI | `BmiCategory` |
|---:|---|
| `< 18.5` | `UNDERWEIGHT` |
| `>= 18.5 && < 25` | `NORMAL` |
| `>= 25 && < 30` | `OVERWEIGHT` |
| `>= 30` | `OBESE` |

BMI is a screening-style metric in the reference material, not a diagnosis.

## 4. Recommended daily calories (demo estimate)

### 4.1 Resting energy estimate

Mifflin–St Jeor is used as a recognizable deterministic base:

```text
common = 10 * weightKg + 6.25 * heightCm - 5 * age

MALE   => common + 5
FEMALE => common - 161
OTHER  => common - 78
```

`-78` is the arithmetic midpoint of the two published sex-specific constants (`(+5 + -161) / 2`). It exists only so the challenge's `OTHER` answer has deterministic behavior without pretending the source formula defines a third physiological category. This is a documented limitation.

### 4.2 Activity multiplier

| Activity | Multiplier |
|---|---:|
| `SEDENTARY` | 1.2 |
| `LIGHT` | 1.375 |
| `MODERATE` | 1.55 |
| `ACTIVE` | 1.725 |
| `VERY_ACTIVE` | 1.9 |

These multipliers are project constants for the demo policy.

```text
maintenanceEstimate = restingEstimate * activityMultiplier
```

### 4.3 Goal adjustment

| Goal | Adjustment |
|---|---:|
| `LOSE_WEIGHT` | -300 kcal/day |
| `MAINTAIN` | 0 |
| `GAIN_WEIGHT` | +300 kcal/day |

```text
adjusted = maintenanceEstimate + goalAdjustment
bounded = max(1000, adjusted)
recommendedDailyCalories = roundToNearest10(bounded)
```

The 1000 kcal floor is a defensive demo guard aligned with the lower bound enforced by the NIDDK Body Weight Planner. It must not be presented as a universally appropriate intake recommendation.

## 5. Estimated target date (demo projection)

This challenge does not implement a physiological body-weight simulation such as NIDDK's dynamic model. Instead it uses a deliberately simple static projection so behavior is explainable and testable.

```text
PROJECTED_CHANGE_KG_PER_WEEK = 0.5
```

For `LOSE_WEIGHT` and `GAIN_WEIGHT`:

```text
deltaKg = abs(weightKg - targetWeightKg)
weeks = ceil(deltaKg / 0.5)
targetDate = referenceDate + weeks * 7 days
```

For `MAINTAIN`, the step-policy invariant requires `targetWeightKg === weightKg`, so:

```text
targetDate = referenceDate
```

The 0.5 kg/week value is a project simplification. CDC's gradual weight-loss context is roughly 1–2 lb/week, but the same static constant for gain is **not** claimed to be a clinical recommendation. The result UI/README must describe the target date as an estimate/simulation.

## 6. Date semantics

`referenceDate` is injected by the application layer; domain code must not call `new Date()` to obtain the current time.

The policy treats target dates as calendar dates in UTC:

1. normalize `referenceDate` to UTC year/month/day;
2. add an integer number of days;
3. persist the resulting UTC date in the result snapshot;
4. serialize API dates as `YYYY-MM-DD`.

This prevents timezone and CI-clock drift in tests.

## 7. Rounding

- BMI: one decimal place for persisted/displayed value.
- BMI classification: unrounded value.
- resting/maintenance intermediate energy values: keep full JavaScript number precision inside the calculation.
- recommended calories: nearest 10 kcal/day after goal adjustment and lower guard.
- projection weeks: always round upward using `ceil` so a partial week does not produce a date before the static target could be reached under the model.

## 8. Required RED test vectors for T10

T10 production code must not be written until tests encode at least these behaviors:

### BMI

- `70 kg / 175 cm` -> `22.9`, `NORMAL`;
- exact category thresholds for 18.5, 25, and 30 using constructed weight/height inputs;
- classification uses raw BMI rather than rounded display BMI.

### Intake

- male/female/other constant branches;
- all five activity multipliers;
- lose/maintain/gain ±300 adjustments;
- lower guard at 1000;
- nearest-10 rounding.

### Projection

With `referenceDate = 2026-09-10T00:00:00Z`:

- `80 -> 72 kg` under lose goal: 16 weeks -> `2026-12-31`;
- `72 -> 80 kg` under gain goal: 16 weeks -> `2026-12-31`;
- `80 -> 80 kg` under maintain goal: `2026-09-10`;
- a 0.1 kg valid difference still consumes one projected week.

## 9. Known limitations

- The calorie estimate is not a measured energy expenditure.
- The `gender` questionnaire field is not equivalent to biological sex; the Mifflin fallback for `OTHER` is therefore an explicit demo compromise.
- The static 0.5 kg/week projection does not model metabolic adaptation, body composition, medications, pregnancy, disease, or other individual factors.
- The system is intentionally not a replacement for tools such as NIDDK's dynamic Body Weight Planner or professional clinical guidance.
