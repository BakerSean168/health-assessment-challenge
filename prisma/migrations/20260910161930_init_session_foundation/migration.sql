-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('FREE', 'ACTIVE');

-- CreateTable
CREATE TABLE "anonymous_sessions" (
    "id" UUID NOT NULL,
    "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anonymous_sessions_pkey" PRIMARY KEY ("id")
);
