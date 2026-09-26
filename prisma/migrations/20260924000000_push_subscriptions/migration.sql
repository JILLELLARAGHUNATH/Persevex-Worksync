-- Migration: 20260924000000_push_subscriptions
-- Purpose: Add PushSubscription and PushReminderLog tables for punch-in reminder feature.
-- Run via: npx prisma migrate dev --name push_subscriptions
-- DO NOT run against production without approval.

-- PushSubscription: one row per browser/device Web Push subscription
CREATE TABLE "PushSubscription" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "endpoint"  TEXT         NOT NULL,
    "p256dh"    TEXT         NOT NULL,
    "auth"      TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- PushReminderLog: idempotency guard — one row per (userId, dateKey, endpoint)
CREATE TABLE "PushReminderLog" (
    "id"      TEXT         NOT NULL,
    "userId"  TEXT         NOT NULL,
    "dateKey" TEXT         NOT NULL,
    "endpoint" TEXT        NOT NULL,
    "sentAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushReminderLog_pkey" PRIMARY KEY ("id")
);

-- Indexes for PushSubscription
CREATE UNIQUE INDEX "PushSubscription_endpoint_key"   ON "PushSubscription"("endpoint");
CREATE        INDEX "PushSubscription_userId_idx"     ON "PushSubscription"("userId");
CREATE        INDEX "PushSubscription_endpoint_idx"   ON "PushSubscription"("endpoint");

-- Indexes for PushReminderLog
CREATE UNIQUE INDEX "PushReminderLog_userId_dateKey_endpoint_key" ON "PushReminderLog"("userId", "dateKey", "endpoint");
CREATE        INDEX "PushReminderLog_userId_dateKey_idx"          ON "PushReminderLog"("userId", "dateKey");
CREATE        INDEX "PushReminderLog_dateKey_idx"                 ON "PushReminderLog"("dateKey");

-- Foreign Keys (cascade delete with User)
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PushReminderLog" ADD CONSTRAINT "PushReminderLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
