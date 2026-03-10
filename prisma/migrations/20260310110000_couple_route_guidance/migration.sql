/*
  Warnings:

  - You are about to drop the column `allDay` on the `CalendarEvent` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `CalendarEvent` table. All the data in the column will be lost.
  - You are about to drop the column `endAt` on the `CalendarEvent` table. All the data in the column will be lost.
  - You are about to drop the column `expectedSchedule` on the `CalendarEvent` table. All the data in the column will be lost.
  - You are about to drop the column `meetupLat` on the `CalendarEvent` table. All the data in the column will be lost.
  - You are about to drop the column `meetupLng` on the `CalendarEvent` table. All the data in the column will be lost.
  - You are about to drop the column `meetupName` on the `CalendarEvent` table. All the data in the column will be lost.
  - You are about to drop the column `meetupNote` on the `CalendarEvent` table. All the data in the column will be lost.
  - You are about to drop the column `place` on the `CalendarEvent` table. All the data in the column will be lost.
  - You are about to drop the column `startAt` on the `CalendarEvent` table. All the data in the column will be lost.
*/

-- AlterTable
ALTER TABLE "CalendarEvent" DROP COLUMN "allDay",
DROP COLUMN "description",
DROP COLUMN "endAt",
DROP COLUMN "expectedSchedule",
DROP COLUMN "meetupLat",
DROP COLUMN "meetupLng",
DROP COLUMN "meetupName",
DROP COLUMN "meetupNote",
DROP COLUMN "place",
DROP COLUMN "startAt",
ADD COLUMN     "appointmentAt" TIMESTAMP(3),
ADD COLUMN     "placeAddress" TEXT,
ADD COLUMN     "placeLat" DOUBLE PRECISION,
ADD COLUMN     "placeLng" DOUBLE PRECISION,
ADD COLUMN     "placeName" TEXT;

-- CreateTable
CREATE TABLE "RouteCache" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "routeData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RouteCache_cacheKey_key" ON "RouteCache"("cacheKey");

-- CreateIndex
CREATE INDEX "RouteCache_eventId_userId_idx" ON "RouteCache"("eventId", "userId");

-- CreateIndex
CREATE INDEX "RouteCache_expiresAt_idx" ON "RouteCache"("expiresAt");

-- AddForeignKey
ALTER TABLE "RouteCache" ADD CONSTRAINT "RouteCache_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteCache" ADD CONSTRAINT "RouteCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
