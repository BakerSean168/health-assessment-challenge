-- Promote subscription access state into its own 1:1 extension table.
-- Backfill first so existing anonymous sessions preserve FREE/ACTIVE access.
CREATE TABLE "subscriptions" (
    "session_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
    "activated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("session_id")
);

INSERT INTO "subscriptions" (
    "session_id",
    "status",
    "activated_at",
    "created_at",
    "updated_at"
)
SELECT
    "id",
    "subscription_status",
    CASE WHEN "subscription_status" = 'ACTIVE' THEN "updated_at" ELSE NULL END,
    "created_at",
    "updated_at"
FROM "anonymous_sessions";

ALTER TABLE "subscriptions"
ADD CONSTRAINT "subscriptions_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "anonymous_sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "anonymous_sessions" DROP COLUMN "subscription_status";
