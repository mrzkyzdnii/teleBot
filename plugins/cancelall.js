import {
  otpGetUser,
  otpNum,
  otpCancel,
  sendInteractive,
  getOtpFooter,
  OTP_STATE
} from "../lib/otpEngine.js";

let handler = async (m, { conn }) => {
  const senderNumber = otpNum(m.sender);
  const u = otpGetUser(senderNumber);
  const activeList = [];

  for (const [cid, od] of OTP_STATE.active) {
    if (od.userNumber === senderNumber && od.isActive) {
      activeList.push(od);
    }
  }

  if (activeList.length === 0 && Array.isArray(u.orders)) {
    const dbActives = u.orders.filter((x) => x.status === "active");
    for (const o of dbActives) {
      const od = {
        ...o,
        userNumber: senderNumber,
        isActive: true,
        createdAt: o.createdAt,
      };
      OTP_STATE.active.set(o.chatId, od);
      activeList.push(od);
    }
  }

  if (activeList.length === 0) {
    await conn.sendMessage(
      m.chat,
      { text: "❌ Tidak ada pesanan aktif yang dapat dibatalkan." },
      { quoted: m },
    );
    return;
  }

  const CANCEL_TIME = 120000;
  let immediateCount = 0;
  let waitingCount = 0;
  let maxWaitSeconds = 0;

  for (const od of activeList) {
    const elapsed = Date.now() - od.createdAt;
    const remaining = Math.max(0, CANCEL_TIME - elapsed);
    const seconds = Math.ceil(remaining / 1000);

    if (remaining <= 0) {
      immediateCount++;
      otpCancel(od).catch(() => {});
    } else {
      waitingCount++;
      if (seconds > maxWaitSeconds) maxWaitSeconds = seconds;

      if (!od.cancelTimer) {
        od.cancelTimer = setTimeout(async () => {
          if (!od.isActive) {
            od.cancelTimer = null;
            return;
          }
          await otpCancel(od);
          od.isActive = false;
          od.cancelTimer = null;
        }, remaining);
      }
    }
  }

  if (immediateCount > 0 && waitingCount === 0) {
    await sendInteractive(
      conn,
      m.chat,
      {
        text:
          `✅ *SEMUA PESANAN DIBATALKAN*\n\n` +
          `🔢 Total: *${immediateCount} nomor*\n` +
          `📋 Semua nomor berhasil dilepas dan saldo dikembalikan.`,
        footer: getOtpFooter(),
        buttons: [
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🔙 Menu Utama",
              id: ".menu",
            }),
          },
        ],
      },
      m,
    );
  } else if (waitingCount > 0) {
    await sendInteractive(
      conn,
      m.chat,
      {
        text:
          `⏳ *AUTO CANCEL ALL AKTIF*\n\n` +
          `🔢 Total Pesanan: *${activeList.length}*\n` +
          (immediateCount > 0 ? `✅ Langsung dibatalkan: *${immediateCount}*\n` : "") +
          `⏱️ Menunggu jeda server: *${waitingCount} nomor*\n` +
          `⏳ Maksimal tunggu: *${maxWaitSeconds} detik*\n\n` +
          `❌ Seluruh nomor akan otomatis dibatalkan begitu waktu sewa tercapai.`,
        footer: getOtpFooter(),
        buttons: [
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🔙 Menu Utama",
              id: ".menu",
            }),
          },
        ],
      },
      m,
    );

    setTimeout(async () => {
      await conn.sendMessage(
        m.chat,
        {
          text:
            `✅ *AUTO CANCEL SELESAI*\n\n` +
            `Semua ${activeList.length} nomor aktif telah otomatis dibatalkan dan saldo telah di-refund.`,
        },
        { quoted: m },
      );
    }, maxWaitSeconds * 1000 + 1500);
  }
};

handler.help = ["cancelall"];
handler.tags = ["otp"];
handler.command = /^cancelall$/i;

export default handler;
