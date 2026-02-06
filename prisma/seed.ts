import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set to run seeds");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
} as any);

async function main() {
  console.log("🌱 Start seeding...");

  /* ===========================
     1️⃣ Admin whitelist
  ============================ */
  const adminEmail = process.env.ADMIN_EMAIL || "brightawah94@gmail.com";
  await prisma.adminWhitelist.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail },
  });

  /* ===========================
     2️⃣ Networks (TYPE is the key)
  ============================ */
  const networks = [
    { name: "Ethereum", type: "ERC20" },
    { name: "Binance Smart Chain", type: "BEP20" },
    { name: "Tron", type: "TRC20" },
    { name: "Bitcoin", type: "BTC" },
  ];

  const networkMap = new Map<string, string>();

  for (const n of networks) {
    const net = await prisma.network.upsert({
      where: { type: n.type },
      update: { name: n.name },
      create: { name: n.name, type: n.type, isActive: true },
    });
    networkMap.set(n.type, net.id);
  }

  /* ===========================
     3️⃣ Coins
  ============================ */
  const coins = [
    { symbol: "BTC", name: "Bitcoin", networks: ["BTC", "BEP20"] },
    { symbol: "ETH", name: "Ethereum", networks: ["ERC20", "BEP20"] },
    { symbol: "USDT", name: "Tether", networks: ["ERC20", "BEP20", "TRC20"] },
  ];

  for (const c of coins) {
    const coin = await prisma.coin.upsert({
      where: { symbol: c.symbol },
      update: {},
      create: { symbol: c.symbol, name: c.name, isActive: true },
    });

    for (const netType of c.networks) {
      const networkId = networkMap.get(netType);
      if (!networkId) continue;

      await prisma.coinNetwork.upsert({
        where: {
          coinId_networkId: {
            coinId: coin.id,
            networkId,
          },
        },
        update: {},
        create: {
          coinId: coin.id,
          networkId,
          contractAddress: `0x${coin.symbol}_${netType}`,
        },
      });
    }
  }

  
  /* ===========================
     4️⃣ Market Pairs (CRITICAL)
  ============================ */
  const usdtNetworks = await prisma.coinNetwork.findMany({
    where: { coin: { symbol: "USDT" } },
    include: { coin: true },
  });

  for (const usdtCN of usdtNetworks) {
    const bases = await prisma.coinNetwork.findMany({
      where: {
        networkId: usdtCN.networkId,
        NOT: { coinId: usdtCN.coinId },
      },
      include: { coin: true },
    });

    for (const base of bases) {
      const symbol = `${base.coin.symbol}/USDT`;
      const wsSymbol = `${base.coin.symbol}USDT`.toLowerCase();

      await prisma.marketPair.upsert({
        where: {
          symbol_networkId: {
            symbol,
            networkId: usdtCN.networkId,
          },
        },
        update: {},
        create: {
          baseCoinId: base.coinId,
          quoteCoinId: usdtCN.coinId,
          networkId: usdtCN.networkId,
          symbol,
          wsSymbol,
          isActive: true,
        },
      });
    }
  }

  console.log("✅ Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
