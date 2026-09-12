-- Backstop invariants that must hold even when writes bypass the HTTP layer.
-- Cross-field target/goal compatibility intentionally stays in the domain: an
-- upstream edit may retain an old target as draft data and move progress back
-- to TARGET_WEIGHT without destructively clearing it.

ALTER TABLE "assessments"
  ADD CONSTRAINT "assessments_revision_nonnegative"
    CHECK ("revision" >= 0) NOT VALID,
  ADD CONSTRAINT "assessments_height_cm_bounds"
    CHECK ("height_cm" IS NULL OR ("height_cm" >= 120 AND "height_cm" <= 230)) NOT VALID,
  ADD CONSTRAINT "assessments_weight_kg_bounds"
    CHECK ("weight_kg" IS NULL OR ("weight_kg" >= 25 AND "weight_kg" <= 300)) NOT VALID,
  ADD CONSTRAINT "assessments_target_weight_kg_bounds"
    CHECK ("target_weight_kg" IS NULL OR ("target_weight_kg" >= 25 AND "target_weight_kg" <= 300)) NOT VALID,
  ADD CONSTRAINT "assessments_age_bounds"
    CHECK ("age" IS NULL OR ("age" >= 18 AND "age" <= 100)) NOT VALID,
  ADD CONSTRAINT "assessments_completion_timestamp_consistency"
    CHECK (
      ("status" = 'IN_PROGRESS' AND "completed_at" IS NULL)
      OR ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL)
    ) NOT VALID;

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_activation_consistency"
    CHECK (
      ("status" = 'FREE' AND "activated_at" IS NULL)
      OR ("status" = 'ACTIVE' AND "activated_at" IS NOT NULL)
    ) NOT VALID;

ALTER TABLE "payment_events"
  ADD CONSTRAINT "payment_events_idempotency_key_format"
    CHECK (
      char_length("idempotency_key") BETWEEN 1 AND 128
      AND "idempotency_key" ~ '^[A-Za-z0-9._:-]+$'
    ) NOT VALID;

ALTER TABLE "assessment_results"
  ADD CONSTRAINT "assessment_results_positive_bmi"
    CHECK ("bmi" > 0) NOT VALID,
  ADD CONSTRAINT "assessment_results_positive_calories"
    CHECK ("recommended_daily_calories" > 0) NOT VALID,
  ADD CONSTRAINT "assessment_results_calculation_version_nonempty"
    CHECK (char_length("calculation_version") > 0) NOT VALID;

ALTER TABLE "assessments" VALIDATE CONSTRAINT "assessments_revision_nonnegative";
ALTER TABLE "assessments" VALIDATE CONSTRAINT "assessments_height_cm_bounds";
ALTER TABLE "assessments" VALIDATE CONSTRAINT "assessments_weight_kg_bounds";
ALTER TABLE "assessments" VALIDATE CONSTRAINT "assessments_target_weight_kg_bounds";
ALTER TABLE "assessments" VALIDATE CONSTRAINT "assessments_age_bounds";
ALTER TABLE "assessments" VALIDATE CONSTRAINT "assessments_completion_timestamp_consistency";
ALTER TABLE "subscriptions" VALIDATE CONSTRAINT "subscriptions_activation_consistency";
ALTER TABLE "payment_events" VALIDATE CONSTRAINT "payment_events_idempotency_key_format";
ALTER TABLE "assessment_results" VALIDATE CONSTRAINT "assessment_results_positive_bmi";
ALTER TABLE "assessment_results" VALIDATE CONSTRAINT "assessment_results_positive_calories";
ALTER TABLE "assessment_results" VALIDATE CONSTRAINT "assessment_results_calculation_version_nonempty";
