import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set to run seeds");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter } as any);

async function seedMarketPairs() {
  console.log("🌱 Seeding market pairs (network-aware)...");

  // 1️⃣ Get all USDT coin-networks
  const usdtNetworks = await prisma.coinNetwork.findMany({
    where: {
      isActive: true,
      coin: { symbol: "USDT" },
    },
    include: {
      coin: true,
      network: true,
    },
  });

  if (usdtNetworks.length === 0) {
    throw new Error("❌ No USDT coin-networks found. Seed CoinNetwork first.");
  }

  // 2️⃣ For each network, pair USDT with other coins on SAME network
  for (const usdtCN of usdtNetworks) {
    const baseCoinNetworks = await prisma.coinNetwork.findMany({
      where: {
        isActive: true,
        networkId: usdtCN.networkId,
        NOT: { coinId: usdtCN.coinId }, // exclude USDT itself
      },
      include: {
        coin: true,
      },
    });

    for (const baseCN of baseCoinNetworks) {
      const symbol = `${baseCN.coin.symbol}/${usdtCN.coin.symbol}`;
      const wsSymbol = `${baseCN.coin.symbol}${usdtCN.coin.symbol}`.toLowerCase();

      await prisma.marketPair.upsert({
        where: {
          symbol_networkId: {
            symbol,
            networkId: usdtCN.networkId,
          },
        },
        update: {
          isActive: true,
          wsSymbol,
        },
        create: {
          baseCoinId: baseCN.coinId,
          quoteCoinId: usdtCN.coinId,
          networkId: usdtCN.networkId,
          symbol,
          wsSymbol,
          isActive: true,
        },
      });

      console.log(
        `✅ ${symbol} on ${usdtCN.network.name} (${wsSymbol})`
      );
    }
  }

  console.log("✅ Market pair seeding completed.");
}

seedMarketPairs()
  .catch((err) => {
    console.error("❌ Seed error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
