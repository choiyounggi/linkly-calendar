-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "meetupLat" DOUBLE PRECISION,
ADD COLUMN     "meetupLng" DOUBLE PRECISION,
ADD COLUMN     "meetupName" TEXT,
ADD COLUMN     "meetupNote" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "homeAddress" TEXT,
ADD COLUMN     "homeLat" DOUBLE PRECISION,
ADD COLUMN     "homeLng" DOUBLE PRECISION,
ADD COLUMN     "homeUpdatedAt" TIMESTAMP(3);
