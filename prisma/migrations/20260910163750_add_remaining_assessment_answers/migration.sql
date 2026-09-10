-- CreateEnum
CREATE TYPE "Goal" AS ENUM ('LOSE_WEIGHT', 'MAINTAIN', 'GAIN_WEIGHT');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE');

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "activity_level" "ActivityLevel",
ADD COLUMN     "age" INTEGER,
ADD COLUMN     "goal" "Goal",
ADD COLUMN     "height_cm" DOUBLE PRECISION,
ADD COLUMN     "target_weight_kg" DOUBLE PRECISION,
ADD COLUMN     "weight_kg" DOUBLE PRECISION;
