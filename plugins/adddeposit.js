import { otpGetUser, otpSaveUser } from "../lib/otpEngine.js";

let handler = async (m, { conn, args, usedPrefix, command }) => {
  const isOwner = (global.owner || []).some(
    (o) => String(o).includes(m.sender) || (Array.isArray(o) && String(o[0]) === String(m.sender))
  );

  if (!isOwner) {
    await conn.reply(m.chat, "❌ Perintah ini khusus untuk Owner/Admin bot.", m);
    return;
  }

  const targetId = args[0];
  const amount = parseInt(args[1], 10);

  if (!targetId || isNaN(amount) || amount <= 0) {
    await conn.reply(
      m.chat,
      `📌 *Format*: ${usedPrefix + command} <ID_USER> <JUMLAH>\n\n*Contoh*:\n• ${usedPrefix + command} 123456789 50000`,
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
  });
  u.saldo = (u.saldo || 0) + amount;
  u.totalDeposit = (u.totalDeposit || 0) + amount;
  otpSaveUser(targetId, u);

  const formattedAmount = amount.toLocaleString("id-ID");
  const formattedSaldo = u.saldo.toLocaleString("id-ID");
  const formattedTotal = u.totalDeposit.toLocaleString("id-ID");

  await conn.reply(
    m.chat,
    `✅ *DEPOSIT BERHASIL DITAMBAHKAN*\n\n👤 *User Target*: \`${targetId}\`\n➕ *Nominal*: Rp ${formattedAmount}\n💰 *Saldo Aktif*: Rp ${formattedSaldo}\n💳 *Total Deposit*: Rp ${formattedTotal}`,
    m
  );

  // Coba kirim notifikasi langsung ke user target
  try {
    await conn.sendMessage(targetId, {
      text: `🎉 *DEPOSIT MASUK*\n\nSaldo deposit sebesar *Rp ${formattedAmount}* telah ditambahkan ke akunmu oleh Admin.\n💰 *Total Deposit Kamu*: Rp ${formattedTotal}\n\nKetik .profile untuk cek saldo.`,
    });
  } catch {}
};

handler.help = ["adddeposit <id> <jumlah>"];
handler.tags = ["owner"];
handler.command = /^(adddeposit|tambahsaldo|topupsaldo|addsaldo)$/i;

export default handler;
