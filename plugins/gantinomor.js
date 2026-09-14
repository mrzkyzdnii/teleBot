import OTP_AXIOS from "axios";
import crypto from "crypto";
import {
  otpResolve,
  otpUpdate,
  otpClean,
  otpAddOrder,
  otpCancel,
  otpBuyWa,
  otpBuySms,
  otpPollUnicorn,
  sendInteractive,
  otpRememberMsg,
  otpFormatPhone,
  otpApiError,
  getOtpFooter,
  getUnicornBase,
  otpHeadersUnicorn,
  OTP_STATE,
  otpGetUser,
  otpSaveUser,
} from "../lib/otpEngine.js";

const doGantiNomor = async (conn, m, order, isAuto = false) => {
  if (!order || !order.isActive) return;

  if (isAuto) {
    await conn.sendMessage(
      m.chat,
      {
        text: `⏳ Waktu tunggu selesai. Mengganti nomor *${String(order.platform).toUpperCase()}* secara otomatis...`,
      },
      { quoted: m },
    );
  }

  if (order.apiType === "unicorn") {
    try {
      const idempotencyKey = crypto.randomUUID();
      const r = await OTP_AXIOS.post(
        `${getUnicornBase()}/orders/${encodeURIComponent(order.orderId)}/change`,
        {},
        {
          headers: otpHeadersUnicorn(idempotencyKey),
          timeout: 20000,
        },
      );

      const newD = r.data?.data;
      if (!newD || !newD.id) {
        throw new Error("Gagal mengalokasikan nomor baru dari server.");
      }

      order.isActive = false;
      otpUpdate(order.userNumber, order.orderId, "cancelled");
      otpClean(order);

      const n = order.userNumber;
      const newCid = `${n}_${newD.id}`;
      const newOd = {
        chatId: newCid,
        orderId: newD.id,
        phone: newD.phone_number || "-",
        platform: newD.service_name || order.platform,
        serviceId: newD.service_id || order.serviceId,
        platformId: null,
        apiType: "unicorn",
        userNumber: n,
        price: order.price || 0,
        cost: order.cost || order.price || 0,
        refunded: false,
        createdAt: Date.now(),
        expiresAt: newD.expire_at ? Number(newD.expire_at) * 1000 : null,
        isActive: true,
        allowRetry: true,
        originalMsg: order.originalMsg || m,
      };

      otpAddOrder(n, newOd);
      OTP_STATE.active.set(newCid, newOd);

      const uLatestGanti = otpGetUser(n);
      const orderText = [
        "✦ *PESANAN NOMOR AKTIF* ✦",
        "",
        `📱 *Layanan*: ${String(newOd.platform).toUpperCase()}`,
        `📞 *Nomor Baru*: ${otpFormatPhone(newOd.phone)}`,
        newOd.price ? `💵 *Harga*: Rp ${Number(newOd.price).toLocaleString("id-ID")}` : null,
        `💳 *Sisa Saldo*: Rp ${Number(uLatestGanti.saldo || 0).toLocaleString("id-ID")}`,
        `⏱️ *Status*: Menunggu Kode OTP masuk...`,
        "",
        isAuto
          ? "Nomor lama berhasil otomatis diganti tanpa biaya tambahan."
          : "Nomor lama berhasil diganti tanpa biaya tambahan.",
      ].filter(Boolean).join("\n");

      const buttons = [
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🔄 Ganti Nomor",
            id: `.gantinomor_${newOd.chatId}`,
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📤 Minta Ulang",
            id: `.kirimulang_${newOd.chatId}`,
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "❌ Batalkan",
            id: `.cancel_${newOd.chatId}`,
          }),
        },
      ];

      const sent = await sendInteractive(
        conn,
        m.chat,
        {
          text: orderText,
          footer: getOtpFooter(),
          buttons,
        },
        m,
      );

      otpRememberMsg(m, newOd.chatId, sent);

      otpPollUnicorn(conn, m, newCid).catch(async (e) => {
        const current = OTP_STATE.active.get(newCid);
        if (!current || !current.isActive) return;
        current.isActive = false;
        OTP_STATE.active.delete(newCid);

        if (current.price && !current.refunded && current.userNumber) {
          current.refunded = true;
          const userObj = otpGetUser(current.userNumber);
          userObj.saldo = (userObj.saldo || 0) + current.price;
          otpSaveUser(current.userNumber, userObj);
          otpUpdate(current.userNumber, current.orderId, "cancelled", { refunded: true, price: current.price });
        }

        await conn.sendMessage(
          m.chat,
          {
            text: `❌ *OTP ERROR*\n\n${otpApiError(e, "EngineUnicorn")}\n💰 Saldo telah di-refund ke akunmu.`,
          },
          { quoted: m },
        );
      });

      return;
    } catch (e) {
      await conn.sendMessage(
        m.chat,
        { text: `❌ Gagal ganti nomor: ${otpApiError(e, "EngineUnicorn")}` },
        { quoted: m },
      );
      return;
    }
  }

  const released = await otpCancel(order);
  if (!released.ok) {
    await conn.sendMessage(
      m.chat,
      { text: `❌ Gagal melepas nomor lama: ${released.error}` },
      { quoted: m },
    );
    return;
  }
  if (order.apiType === "wahub") await otpBuyWa(conn, m, order.platform, 1);
  else await otpBuySms(conn, m, order.platform, 1);
};

let handler = async (m, { conn, args, command }) => {
  let targetHint = args[0];
  if (!targetHint && command.startsWith("gantinomor_")) {
    targetHint = command.replace("gantinomor_", "");
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

  const GANTI_TIME = 60000;
  const elapsed = Date.now() - order.createdAt;
  const remaining = Math.max(0, GANTI_TIME - elapsed);
  const seconds = Math.ceil(remaining / 1000);

  if (order.changeTimer) {
    await conn.sendMessage(
      m.chat,
      {
        text: `⏳ *AUTO GANTI NOMOR AKTIF*\n\n📱 *Layanan*: ${String(order.platform).toUpperCase()}\n⏱️ Menunggu jeda server *${seconds} detik* lagi...\nNomor akan otomatis diganti begitu jeda selesai tanpa perlu klik lagi.`,
      },
      { quoted: m },
    );
    return;
  }

  if (remaining <= 0) {
    await doGantiNomor(conn, m, order, false);
    return;
  }

  await conn.sendMessage(
    m.chat,
    {
      text:
        `⏳ *AUTO GANTI NOMOR DIAKTIFKAN*\n\n` +
        `📱 *Layanan*: ${String(order.platform).toUpperCase()}\n` +
        `📞 *Nomor*: ${otpFormatPhone(order.phone)}\n` +
        `⏱️ Menunggu *${seconds} detik* lagi jeda dari server.\n` +
        `Nomor akan otomatis diganti sendiri begitu jeda selesai!`,
    },
    { quoted: m },
  );

  order.changeTimer = setTimeout(async () => {
    try {
      if (!order.isActive) {
        order.changeTimer = null;
        return;
      }
      order.changeTimer = null;
      await doGantiNomor(conn, m, order, true);
    } catch (err) {
      order.changeTimer = null;
      await conn.sendMessage(
        m.chat,
        { text: `❌ *AUTO GANTI NOMOR GAGAL*\n\n⚠️ ${err.message}` },
        { quoted: m },
      );
    }
  }, remaining);
};

handler.help = ["gantinomor"];
handler.tags = ["otp"];
handler.command = /^(gantinomor|gantinomor_.*)$/i;

export default handler;
