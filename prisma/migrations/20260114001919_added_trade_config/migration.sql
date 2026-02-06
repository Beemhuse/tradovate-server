/*
  Warnings:

  - You are about to drop the column `direction` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `pairId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `period` on the `Order` table. All the data in the column will be lost.
  - You are about to alter the column `stake` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `entryPrice` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `profitRate` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - Added the required column `marketPairId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tradeConfigId` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_coinId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_networkId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_pairId_fkey";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "direction",
DROP COLUMN "pairId",
DROP COLUMN "period",
ADD COLUMN     "marketPairId" TEXT NOT NULL,
ADD COLUMN     "tradeConfigId" TEXT NOT NULL,
ALTER COLUMN "coinId" DROP NOT NULL,
ALTER COLUMN "networkId" DROP NOT NULL,
ALTER COLUMN "stake" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "entryPrice" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "profitRate" SET DATA TYPE DECIMAL(65,30);

-- CreateTable
CREATE TABLE "TradeConfig" (
    "id" TEXT NOT NULL,
    "marketPairId" TEXT NOT NULL,
    "period" "TradePeriod" NOT NULL,
    "direction" "TradeDirection" NOT NULL,
    "minStake" DECIMAL(65,30) NOT NULL,
    "maxStake" DECIMAL(65,30) NOT NULL,
    "profitRate" DECIMAL(65,30) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TradeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TradeConfig_marketPairId_period_direction_key" ON "TradeConfig"("marketPairId", "period", "direction");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_marketPairId_idx" ON "Order"("marketPairId");

-- CreateIndex
CREATE INDEX "Order_tradeConfigId_idx" ON "Order"("tradeConfigId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_marketPairId_fkey" FOREIGN KEY ("marketPairId") REFERENCES "MarketPair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tradeConfigId_fkey" FOREIGN KEY ("tradeConfigId") REFERENCES "TradeConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeConfig" ADD CONSTRAINT "TradeConfig_marketPairId_fkey" FOREIGN KEY ("marketPairId") REFERENCES "MarketPair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
