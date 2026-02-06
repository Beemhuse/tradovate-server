type Props = {
  orderId: string;
  userName: string;
  userEmail: string;
  pair: string;
  network: string;
  direction: string;
  stake: number;
  period: string;
  profitRate: number;
  expiresAt: Date;
};

export const AdminTradePlacedEmail = ({
  orderId,
  userName,
  userEmail,
  pair,
  network,
  direction,
  stake,
  period,
  profitRate,
  expiresAt,
}: Props) => `
<div style="font-family: Arial, sans-serif; background:#0f172a; padding:24px; color:#e5e7eb;">
  <div style="max-width:600px; margin:auto; background:#020617; border-radius:8px; padding:24px;">
    <h2 style="color:#38bdf8;">📈 New Trade Placed</h2>

    <table style="width:100%; margin-top:16px;">
      <tr><td>User</td><td>${userName}</td></tr>
      <tr><td>Email</td><td>${userEmail}</td></tr>
      <tr><td>Pair</td><td>${pair}</td></tr>
      <tr><td>Network</td><td>${network}</td></tr>
      <tr><td>Direction</td><td><b>${direction}</b></td></tr>
      <tr><td>Stake</td><td>${stake} USDT</td></tr>
      <tr><td>Period</td><td>${period}</td></tr>
      <tr><td>Profit Rate</td><td>${profitRate}%</td></tr>
      <tr><td>Expires At</td><td>${expiresAt.toUTCString()}</td></tr>
      <tr><td>Order ID</td><td style="font-size:12px;">${orderId}</td></tr>
    </table>

    <p style="margin-top:24px; font-size:12px; color:#94a3b8;">
      Trading Engine · Automated Notification
    </p>
  </div>
</div>
`;
