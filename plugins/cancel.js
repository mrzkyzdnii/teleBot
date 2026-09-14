import {
  otpResolve,
  otpCancel,
  sendInteractive,
  otpFormatPhone,
  getOtpFooter,
  otpGetUser
} from "../lib/otpEngine.js";

let handler = async (m, { conn, args, command }) => {
  let targetHint = args[0];
  if (!targetHint && command.startsWith("cancel_")) {
    targetHint = command.replace("cancel_", "");
  }

  const order = otpResolve(m, targetHint);

  if (!order || !order.isActive) {
    await conn.sendMessage(
      m.chat,
      { text: "❌ Pesanan tidak ditemukan atau sudah selesai." },
      { quoted: m },
    );
    return;
  }

  const CANCEL_TIME = 120000;
  const elapsed = Date.now() - order.createdAt;
  const remaining = Math.max(0, CANCEL_TIME - elapsed);
  const seconds = Math.ceil(remaining / 1000);

  if (order.cancelTimer) {
    await conn.sendMessage(
      m.chat,
      {
        text: `⏳ Auto cancel aktif.\n⏱️ Menunggu jeda server ${seconds} detik lagi...`,
      },
      { quoted: m },
    );
    return;
  }

  const buyAgainTarget =
    order.apiType === "wahub"
      ? `.buyotpwa ${order.platform}`
      : order.apiType === "unicorn"
        ? `.buyotpwa2 ${order.platform}`
        : `.buyotpsms ${order.platform}`;

  const menuTarget =
    String(order.apiType).includes("otpinstan") ? ".otpviasms" : ".otpviawa";

  if (remaining <= 0) {
    const result = await otpCancel(order);

    if (!result.ok) {
      await conn.sendMessage(
        m.chat,
        { text: `❌ Gagal membatalkan: ${result.error}` },
        { quoted: m },
      );
      return;
    }

    order.isActive = false;

    const uAfter = otpGetUser(order.userNumber || m.sender);
    const refundStr = order.price
      ? `\n💰 *Refund*: Rp ${Number(order.price).toLocaleString("id-ID")}\n💳 *Sisa Saldo*: Rp ${Number(uAfter.saldo || 0).toLocaleString("id-ID")}`
      : "";

    const cancelHeader = `✅ *PESANAN DIBATALKAN*\n\n📱 *Layanan*: ${String(order.platform).toUpperCase()}\n📋 Nomor berhasil dilepas & saldo telah dikembalikan.${refundStr}`;

    await sendInteractive(
      conn,
      m.chat,
      {
        text: cancelHeader,
        footer: getOtpFooter(),
        buttons: [
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🛒 Beli Lagi",
              id: buyAgainTarget,
            }),
          },
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🔙 Menu Utama",
              id: menuTarget,
            }),
          },
        ],
      },
      m,
    );

    return;
  }

  await conn.sendMessage(
    m.chat,
    {
      text:
        `⏳ *AUTO CANCEL AKTIF*\n\n` +
        `📱 *Layanan*: ${String(order.platform).toUpperCase()}\n` +
        `📞 *Nomor*: ${otpFormatPhone(order.phone)}\n` +
        `⏱️ Menunggu *${seconds} detik* lagi agar bisa dibatalkan otomatis tanpa biaya.`,
    },
    { quoted: m },
  );

  order.cancelTimer = setTimeout(async () => {
    try {
      if (!order.isActive) {
        order.cancelTimer = null;
        return;
      }

      const result = await otpCancel(order);

      if (!result.ok) {
        order.cancelTimer = null;
        await conn.sendMessage(
          m.chat,
          { text: `❌ *AUTO CANCEL GAGAL*\n\n⚠️ ${result.error}` },
          { quoted: m },
        );
        return;
      }

      order.isActive = false;
      order.cancelTimer = null;

      const uAfterAuto = otpGetUser(order.userNumber || m.sender);
      const refundStrAuto = order.price
        ? `\n💰 *Refund*: Rp ${Number(order.price).toLocaleString("id-ID")}\n💳 *Sisa Saldo*: Rp ${Number(uAfterAuto.saldo || 0).toLocaleString("id-ID")}`
        : "";

      const autoCancelSuccessText = `✅ *AUTO CANCEL BERHASIL*\n\n📱 *Layanan*: ${String(order.platform).toUpperCase()}\n📋 Nomor dilepas & saldo telah dikembalikan.${refundStrAuto}`;

      await sendInteractive(
        conn,
        m.chat,
        {
          text: autoCancelSuccessText,
          footer: getOtpFooter(),
          buttons: [
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "🛒 Beli Lagi",
                id: buyAgainTarget,
              }),
            },
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "🔙 Menu Utama",
                id: menuTarget,
              }),
            },
          ],
        },
        m,
      );
    } catch (err) {
      order.cancelTimer = null;
      await conn.sendMessage(
        m.chat,
        { text: `❌ *AUTO CANCEL ERROR*\n\n⚠️ ${err.message}` },
        { quoted: m },
      );
    }
  }, remaining);
};

handler.help = ["cancel"];
handler.tags = ["otp"];
handler.command = /^(cancel|cancel_.*)$/i;

export default handler;
