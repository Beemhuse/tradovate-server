// jobs/settleExpiredTrades.ts

import { prisma } from "../utils/prisma";

export const settleExpiredTrades = async () => {
  const now = new Date();

  const expiredOrders = await prisma.order.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
    },
  });

  if (!expiredOrders.length) return;

  await prisma.order.updateMany({
    where: {
      id: { in: expiredOrders.map((o) => o.id) },
    },
    data: {
      status: "SETTLED",
      result: 'LOSS',
      settledAt: now,
    },
  });

  console.log(`Settled ${expiredOrders.length} expired trades as LOSS`);
};
