-- CreateEnum
CREATE TYPE "TrendKind" AS ENUM ('SOUND', 'FORMAT', 'TOPIC', 'HASHTAG', 'CHALLENGE');

-- CreateEnum
CREATE TYPE "TrendStatus" AS ENUM ('ACTIVE', 'WARMING', 'EXPIRED');

-- CreateTable
CREATE TABLE "Trend" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "TrendKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceUrl" TEXT,
    "platforms" "Platform"[],
    "status" "TrendStatus" NOT NULL DEFAULT 'ACTIVE',
    "notedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "generatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Trend_projectId_status_idx" ON "Trend"("projectId", "status");

-- CreateIndex
CREATE INDEX "Trend_projectId_kind_idx" ON "Trend"("projectId", "kind");

-- AddForeignKey
ALTER TABLE "Trend" ADD CONSTRAINT "Trend_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
