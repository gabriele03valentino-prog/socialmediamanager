-- CreateEnum
CREATE TYPE "PostOutcome" AS ENUM ('OUTLIER_HIGH', 'ABOVE', 'NORMAL', 'BELOW', 'OUTLIER_LOW');

-- CreateTable
CREATE TABLE "PostMortem" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "contentType" TEXT NOT NULL,
    "outcome" "PostOutcome" NOT NULL,
    "metric" TEXT NOT NULL,
    "postValue" INTEGER NOT NULL,
    "baselineMed" INTEGER NOT NULL,
    "ratio" DOUBLE PRECISION NOT NULL,
    "caption" TEXT,
    "hashtags" TEXT[],
    "insightTags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostMortem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostMortem_postId_key" ON "PostMortem"("postId");

-- CreateIndex
CREATE INDEX "PostMortem_projectId_createdAt_idx" ON "PostMortem"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "PostMortem_projectId_outcome_idx" ON "PostMortem"("projectId", "outcome");

-- AddForeignKey
ALTER TABLE "PostMortem" ADD CONSTRAINT "PostMortem_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMortem" ADD CONSTRAINT "PostMortem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
