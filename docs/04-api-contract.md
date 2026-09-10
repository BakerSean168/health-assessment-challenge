# API contract v0.2

## 1. Conventions

Base path: `/api`

Authentication model: anonymous HttpOnly session cookie.

Content type: `application/json` for request/response bodies unless no body is required.

All mutating assessment requests use the current server session; callers do not select another session by sending an arbitrary identifier.

## 2. Error envelope

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

Initial stable error codes:

- `VALIDATION_ERROR`
- `SESSION_REQUIRED`
- `SESSION_NOT_FOUND`
- `ASSESSMENT_NOT_FOUND`
- `STEP_OUT_OF_ORDER`
- `ASSESSMENT_VERSION_CONFLICT`
- `ASSESSMENT_INCOMPLETE`
- `ASSESSMENT_ALREADY_COMPLETED`
- `RESULT_NOT_FOUND`
- `PAYMENT_INVALID`

## 3. `POST /api/session`

Create or reuse the anonymous browser session and ensure its single v1 assessment exists.

### Response `200` or `201`

```json
{
  "subscriptionStatus": "FREE",
  "assessment": {
    "status": "IN_PROGRESS",
    "nextRequiredStep": "GENDER",
    "revision": 0
  }
}
```

The raw session identifier is not exposed in the JSON body. The route issues `health_assessment_session` as a 30-day HttpOnly cookie with `SameSite=Lax`, `Path=/`, and `Secure` enabled in production. A missing, malformed, or unknown cookie does not let the client select an identity; the server creates and issues a new session instead.

## 4. `GET /api/assessment`

Restore current assessment state.

### Response `200`

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

The endpoint is the canonical recovery source after refresh/revisit. `nextRequiredStep` is a response projection derived from persisted answers; it is not a database column. If all required answers are valid, `nextRequiredStep` is `null` and the assessment is ready to submit.

## 5. `PATCH /api/assessment/steps/:stepKey`

Persist one assessment step.

Example:

```http
PATCH /api/assessment/steps/weight
```

### Request

```json
{
  "value": 72,
  "expectedRevision": 4
}
```

The Zod schema selected by `stepKey` validates the `value` type/range. The v1 route keys and current scalar contracts are:

| Route key | Accepted value |
|---|---|
| `gender` | `MALE`, `FEMALE`, `OTHER` |
| `goal` | `LOSE_WEIGHT`, `MAINTAIN`, `GAIN_WEIGHT` |
| `activity` | `SEDENTARY`, `LIGHT`, `MODERATE`, `ACTIVE`, `VERY_ACTIVE` |
| `height` | number, 120–230 cm inclusive |
| `weight` | number, 25–300 kg inclusive |
| `age` | integer, 18–100 inclusive |
| `target-weight` | number, 25–300 kg inclusive |

These numeric bounds are implementation choices for the challenge and are not claimed to be supplied by the source brief. Cross-field target-weight validity is handled by the domain step policy rather than by the scalar request schema.

### Response `200`

```json
{
  "saved": true,
  "revision": 5,
  "nextRequiredStep": "AGE"
}
```

If an earlier edit invalidates a dependent answer, `nextRequiredStep` can move backward to the first missing or context-invalid step. Existing later values are not automatically deleted. For v1, target-weight consistency follows a simple deterministic rule: lose requires target below current weight, gain requires target above current weight, and maintain requires an equal target. This is challenge product logic, not medical guidance.

A missing or malformed session cookie returns `401 SESSION_REQUIRED`. A syntactically valid but unknown session identity cannot select another assessment and returns `404 ASSESSMENT_NOT_FOUND`.

### Not found `404`

```json
{
  "error": {
    "code": "ASSESSMENT_NOT_FOUND",
    "message": "The assessment was not found.",
    "details": {}
  }
}
```

### Conflict `409`

```json
{
  "error": {
    "code": "ASSESSMENT_VERSION_CONFLICT",
    "message": "The assessment changed since this page loaded.",
    "details": {}
  }
}
```

### Out-of-order `409`

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

## 6. `POST /api/assessment/submit`

Finalize the assessment and generate the immutable result snapshot.

### Request

No client calculation values are accepted. The client includes only the aggregate revision it most recently observed so first-time submission cannot race with a newer answer mutation.

```json
{
  "expectedRevision": 7
}
```

### First successful response `200`

```json
{
  "status": "COMPLETED",
  "resultReady": true
}
```

The first successful submit creates the canonical result snapshot and changes the assessment from `IN_PROGRESS` to `COMPLETED` in the same database transaction. The aggregate revision increments once as part of that transition.

### Retry semantics

If the assessment is already completed and has its canonical result snapshot, return the existing successful state rather than recomputing a different result. This completed-result check takes precedence over a stale `expectedRevision`, allowing a network retry of the successful submit to remain idempotent.

If the assessment is still in progress and `expectedRevision` is stale, return `409 ASSESSMENT_VERSION_CONFLICT`.

### Incomplete `409`

```json
{
  "error": {
    "code": "ASSESSMENT_INCOMPLETE",
    "message": "Complete all required assessment steps before submitting.",
    "details": {
      "requiredSteps": ["AGE", "TARGET_WEIGHT"]
    }
  }
}
```

## 7. `GET /api/assessment/result`

Return a subscription-aware server projection of the stored result.

### Free response `200`

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

Important: premium values are absent from the JSON. They are not returned and blurred by the UI.

### Active response `200`

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

The example values are illustrative contract examples, not frozen calculation expectations.

## 8. `POST /api/pay`

Simulate successful payment and activate the current session subscription.

### Request

```json
{
  "idempotencyKey": "demo_01J_TEST"
}
```

### Response `200`

```json
{
  "status": "SUCCEEDED",
  "subscriptionStatus": "ACTIVE",
  "replayed": false
}
```

`idempotencyKey` is a caller-generated demo key of 1–128 characters using letters, digits, `.`, `_`, `:`, or `-`. It is unique only within the current anonymous session and is not presented as a real provider transaction identifier.

A replay of the same session-scoped `idempotencyKey` returns the already-applied outcome:

```json
{
  "status": "SUCCEEDED",
  "subscriptionStatus": "ACTIVE",
  "replayed": true
}
```

## 9. Contract testing priorities

API tests should assert stable behavior rather than incidental implementation details:

- status code;
- error code;
- response shape;
- omission of premium values;
- revision progression;
- persisted state after request;
- idempotency after retries;
- derived `nextRequiredStep` after recovery and cross-field edits;
- strict stale-write conflict behavior.
