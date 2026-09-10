-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCEEDED');

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_session_id_idempotency_key_key" ON "payment_events"("session_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "anonymous_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
