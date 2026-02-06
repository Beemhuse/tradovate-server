/*
  Warnings:

  - A unique constraint covering the columns `[coinId,networkId,contractAddress]` on the table `CoinNetwork` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "CoinNetwork_coinId_networkId_key";

-- DropIndex
DROP INDEX "CoinNetwork_networkId_contractAddress_key";

-- CreateIndex
CREATE UNIQUE INDEX "CoinNetwork_coinId_networkId_contractAddress_key" ON "CoinNetwork"("coinId", "networkId", "contractAddress");
