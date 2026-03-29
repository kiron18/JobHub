-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('DREAM', 'TARGET', 'BACKUP');

-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "priority" "JobPriority";
