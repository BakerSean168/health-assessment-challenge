-- CreateEnum
CREATE TYPE "BmiCategory" AS ENUM ('UNDERWEIGHT', 'NORMAL', 'OVERWEIGHT', 'OBESE');

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "completed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "assessment_results" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "bmi" DOUBLE PRECISION NOT NULL,
    "bmi_category" "BmiCategory" NOT NULL,
    "recommended_daily_calories" INTEGER NOT NULL,
    "estimated_goal_date" DATE NOT NULL,
    "calculation_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assessment_results_assessment_id_key" ON "assessment_results"("assessment_id");

-- AddForeignKey
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
