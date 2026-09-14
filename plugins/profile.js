import { otpGetUser, otpSaveUser, getOtpFooter, sendInteractive } from "../lib/otpEngine.js";

let handler = async (m, { conn }) => {
  const u = otpGetUser(m.sender);
  if (!u.name && m.pushName) {
    u.name = m.pushName;
    otpSaveUser(m.sender, u);
  }

  const regDate = new Date(u.registeredAt || Date.now()).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const saldoUser = Number(u.saldo || 0).toLocaleString("id-ID");
  const totalDepo = Number(u.totalDeposit || 0).toLocaleString("id-ID");
  const totalOrders = Number(u.totalOrders || (u.orders ? u.orders.length : 0));

  const text = [
    "✦ *PROFIL PENGGUNA* ✦",
    "",
    `👤 *Nama*: ${m.pushName || u.name || "User"}`,
    `🆔 *ID Telegram*: \`${m.sender}\``,
    `💰 *Saldo Aktif*: Rp ${saldoUser}`,
    `💳 *Total Deposit*: Rp ${totalDepo}`,
    `📦 *Total Pesanan OTP*: ${totalOrders} kali`,
    `📅 *Bergabung Sejak*: ${regDate}`,
    "",
    "Gunakan tombol di bawah untuk melihat riwayat atau melakukan deposit saldo.",
  ].join("\n");

  await sendInteractive(
    conn,
    m.chat,
    {
      text,
      footer: getOtpFooter(),
      buttons: [
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💳 Deposit Saldo",
            id: ".deposit",
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📜 Riwayat Transaksi",
            id: ".riwayat",
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🔙 Kembali ke Menu",
            id: ".menu",
          }),
        },
      ],
    },
    m
  );
};

handler.help = ["profile", "profil"];
handler.tags = ["main"];
handler.command = /^(profile|profil|me)$/i;

export default handler;
