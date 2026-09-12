import type { AssessmentStepCommand } from "./assessment-step";

const validAgeCommand: AssessmentStepCommand = {
  step: "AGE",
  value: 24,
  expectedRevision: 3,
};

const invalidAgeCommand: AssessmentStepCommand = {
  step: "AGE",
  // @ts-expect-error AGE is coupled to a numeric value by the discriminated command type.
  value: "MALE",
  expectedRevision: 3,
};

void validAgeCommand;
void invalidAgeCommand;

import type { AssessmentStep } from "../domain/assessment";

type Exact<Left, Right> = [Left] extends [Right]
  ? [Right] extends [Left]
    ? true
    : false
  : false;
type AssertTrue<Value extends true> = Value;

type CommandStepCoverage = AssertTrue<
  Exact<AssessmentStepCommand["step"], AssessmentStep>
>;

const commandStepCoverage: CommandStepCoverage = true;
void commandStepCoverage;
