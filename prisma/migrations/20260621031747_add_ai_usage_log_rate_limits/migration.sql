-- AlterTable
ALTER TABLE "AiUsageLog" ADD COLUMN     "rateLimitLimit" INTEGER,
ADD COLUMN     "rateLimitRemaining" INTEGER,
ADD COLUMN     "rateLimitResetAt" TEXT,
ADD COLUMN     "rateLimitSource" TEXT;
