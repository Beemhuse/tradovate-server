/*
  Warnings:

  - You are about to drop the column `direction` on the `TradeConfig` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[marketPairId,period]` on the table `TradeConfig` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `direction` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "TradeConfig_marketPairId_period_direction_key";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "direction" "TradeDirection" NOT NULL;

-- AlterTable
ALTER TABLE "TradeConfig" DROP COLUMN "direction";

-- CreateIndex
CREATE UNIQUE INDEX "TradeConfig_marketPairId_period_key" ON "TradeConfig"("marketPairId", "period");
