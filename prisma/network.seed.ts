import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Set it in your environment before running the seed."
  );
}

const adapter = new PrismaPg({ connectionString });

// PrismaClientOptions typings may not include `adapter`, cast to any to satisfy TS.
const prisma = new PrismaClient({ adapter } as any);


const NETWORKS = [
  {
    slug: "ethereum",
    name: "Ethereum Mainnet",
    type: "ERC20",
    chainId: "1",
    icon: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    description: "Ethereum blockchain with ERC-20 tokens",
  },
  {
    slug: "bsc",
    name: "Binance Smart Chain",
    type: "BEP20",
    chainId: "56",
    icon: "https://assets.coingecko.com/markets/images/52/small/binance-coin-logo.png",
    description: "Binance Smart Chain with BEP-20 tokens",
  },
  {
    slug: "polygon",
    name: "Polygon",
    type: "ERC20",
    chainId: "137",
    icon: "https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png",
    description: "Polygon (Matic) network",
  },
  {
    slug: "arbitrum",
    name: "Arbitrum",
    type: "ERC20",
    chainId: "42161",
    icon: "https://assets.coingecko.com/coins/images/24372/large/arbitrum.png",
    description: "Arbitrum L2 network",
  },
  {
    slug: "optimism",
    name: "Optimism",
    type: "ERC20",
    chainId: "10",
    icon: "https://assets.coingecko.com/coins/images/25244/large/optimism.png",
    description: "Optimism L2 network",
  },
  {
    slug: "avalanche",
    name: "Avalanche",
    type: "ERC20",
    chainId: "43114",
    icon: "https://assets.coingecko.com/coins/images/12559/large/avax.png",
    description: "Avalanche C-Chain",
  },
  {
    slug: "fantom",
    name: "Fantom",
    type: "ERC20",
    chainId: "250",
    icon: "https://assets.coingecko.com/coins/images/4001/large/Fantom.png",
    description: "Fantom Opera network",
  },
  {
    slug: "base",
    name: "Base",
    type: "ERC20",
    chainId: "8453",
    icon: "https://assets.coingecko.com/coins/images/32435/large/base.png",
    description: "Base network (Coinbase L2)",
  },
  {
    slug: "solana",
    name: "Solana",
    type: "SPL",
    icon: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    description: "Solana blockchain with SPL tokens",
  },
  {
    slug: "tron",
    name: "Tron",
    type: "TRC20",
    icon: "https://assets.coingecko.com/coins/images/1094/large/tron-logo.png",
    description: "Tron blockchain with TRC-20 tokens",
  },
  {
    slug: "bitcoin",
    name: "Bitcoin",
    type: "Native",
    icon: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    description: "Bitcoin native network",
  },
  {
    slug: "litecoin",
    name: "Litecoin",
    type: "Native",
    icon: "https://assets.coingecko.com/coins/images/2/large/litecoin.png",
    description: "Litecoin native network",
  },
  {
    slug: "ripple",
    name: "Ripple",
    type: "Native",
    icon: "https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png",
    description: "Ripple (XRP) native network",
  },
  {
    slug: "dogecoin",
    name: "Dogecoin",
    type: "Native",
    icon: "https://assets.coingecko.com/coins/images/5/large/dogecoin.png",
    description: "Dogecoin native network",
  },
];


async function main() {
  console.log("🌱 Seeding networks...");

  for (const network of NETWORKS) {
    await prisma.network.upsert({
      where: { slug: network.slug },
      update: {
        name: network.name,
        type: network.type,
        chainId: network.chainId,
        icon: network.icon,
        description: network.description,
      },
      create: network,
    });
  }

  console.log("✅ Networks seeded successfully");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });