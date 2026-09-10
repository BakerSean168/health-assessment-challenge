export const ASSESSMENT_INPUT_LIMITS = {
  age: { min: 18, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 25, max: 300 },
  targetWeightKg: { min: 25, max: 300 },
} as const;
