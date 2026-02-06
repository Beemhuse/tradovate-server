/*
  Warnings:

  - A unique constraint covering the columns `[baseCoinId,quoteCoinId,networkId]` on the table `MarketPair` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "MarketPair_symbol_networkId_key";

-- CreateIndex
CREATE UNIQUE INDEX "MarketPair_baseCoinId_quoteCoinId_networkId_key" ON "MarketPair"("baseCoinId", "quoteCoinId", "networkId");
