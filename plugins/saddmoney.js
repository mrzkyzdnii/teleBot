import { otpGetUser, otpSaveUser } from "../lib/otpEngine.js";

let handler = async (m, { conn, args, usedPrefix, command }) => {
  const targetId = args[0] ? String(args[0]).trim().replace(/[@\s]/g, "") : null;
  const rawAmount = args[1] ? String(args[1]).replace(/[^0-9]/g, "") : null;
  const amount = rawAmount ? parseInt(rawAmount, 10) : NaN;

  if (!targetId || isNaN(amount) || amount <= 0) {
    await conn.reply(
      m.chat,
      `📌 *Format*: /saddmoney <telegramid> <jumlahmoney>\n\n*Contoh*:\n• /saddmoney 1577396317 20000`,
      m
    );
    return;
  }

  const u = otpGetUser(targetId);
  if (!u.deposits) u.deposits = [];
  u.deposits.push({
    amount,
    date: Date.now(),
    addedBy: m.sender,
    type: "secret",
  });
  u.saldo = (u.saldo || 0) + amount;
  u.totalDeposit = (u.totalDeposit || 0) + amount;
  otpSaveUser(targetId, u);

  const formattedAmount = amount.toLocaleString("id-ID");
  const formattedSaldo = u.saldo.toLocaleString("id-ID");
  const formattedTotal = u.totalDeposit.toLocaleString("id-ID");

  await conn.reply(
    m.chat,
    `✅ *SECRET SALDO DITAMBAHKAN*\n\n👤 *User Target*: \`${targetId}\`\n➕ *Nominal*: Rp ${formattedAmount}\n💰 *Saldo Aktif*: Rp ${formattedSaldo}\n💳 *Total Deposit*: Rp ${formattedTotal}`,
    m
  );

  // Kirim notifikasi ke user target jika berbeda chat
  if (String(m.chat) !== String(targetId)) {
    try {
      await conn.sendMessage(targetId, {
        text: `🎉 *SALDO DITAMBAHKAN*\n\nSaldo sebesar *Rp ${formattedAmount}* telah berhasil ditambahkan ke akunmu.\n💰 *Saldo Kamu*: Rp ${formattedSaldo}\n\nKetik .profile untuk cek status akun.`,
      });
    } catch {}
  }
};

handler.help = ["saddmoney <telegramid> <jumlahmoney>"];
handler.tags = ["owner"];
handler.command = /^(saddmoney|secretaddmoney)$/i;

export default handler;
