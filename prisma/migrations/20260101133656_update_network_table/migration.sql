/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Network` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Network" ADD COLUMN     "chainId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Network_slug_key" ON "Network"("slug");
