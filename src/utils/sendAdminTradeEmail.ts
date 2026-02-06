import { Resend } from "resend";
import dotenv from "dotenv";
import { AdminTradePlacedEmail } from "../email/adminTradePlace";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY); // must be set in env
export const sendAdminTradeMail = async (
  order: any,
  seconds: number,
) => {
  const userName = `${order.user.fullName || ""}`.trim();

  const pairName = `${order.marketPair.baseCoin.symbol} / ${order.marketPair.quoteCoin.symbol}`;

  const periodLabel =
    seconds < 60 ? `${seconds}s` : `${seconds / 60}m`;

  await resend.emails.send({
    from: "Trading Engine <no-reply@tradovatefutures.com>",
    to: [process.env.ADMIN_EMAIL!],
    subject: "📊 New Trade Placed",
    html: AdminTradePlacedEmail({
      orderId: order.id,
      userName,
      userEmail: order.user.email,
      pair: pairName,
      network: order.marketPair.network?.name || "N/A",
      direction: order.direction,
      stake: order.stake,
      period: periodLabel,
      profitRate: order.tradeConfig.profitRate,
      expiresAt: order.expiresAt,
    }),
  });
};
