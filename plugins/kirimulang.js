import OTP_AXIOS from "axios";
import {
  otpResolve,
  otpUpdate,
  sendInteractive,
  otpPollWa,
  otpPollUnicorn,
  otpPollSms,
  otpApiError,
  getOtpFooter,
  getWahubBase,
  getInstanBase,
  getUnicornBase,
  otpHeadersWa,
  otpHeadersSms,
  otpHeadersUnicorn,
  OTP_STATE
} from "../lib/otpEngine.js";

let handler = async (m, { conn, args, command }) => {
  let targetHint = args[0];
  if (!targetHint && command.startsWith("kirimulang_")) {
    targetHint = command.replace("kirimulang_", "");
  }

  const order = otpResolve(m, targetHint);
  if (!order) {
    await conn.sendMessage(
      m.chat,
      { text: "❌ Pesanan tidak ditemukan." },
      { quoted: m },
    );
    return;
  }
  if (Date.now() - order.createdAt < 30000) {
    await conn.sendMessage(
      m.chat,
      {
        text: `⏳ Tunggu ${Math.ceil((30000 - (Date.now() - order.createdAt)) / 1000)} detik lagi untuk minta ulang OTP.`,
      },
      { quoted: m },
    );
    return;
  }
  if (order.apiType === "wahub" && order.allowRetry === false) {
    await conn.sendMessage(
      m.chat,
      {
        text: "❌ Layanan ini tidak mendukung Re-OTP. Silakan gunakan tombol Ganti Nomor.",
      },
      { quoted: m },
    );
    return;
  }
  try {
    if (order.apiType === "unicorn") {
      await OTP_AXIOS.post(
        `${getUnicornBase()}/orders/${encodeURIComponent(order.orderId)}/resend`,
        {},
        { headers: otpHeadersUnicorn(), timeout: 15000 },
      );

      order.isActive = true;
      OTP_STATE.active.set(order.chatId, order);

      const buttons = [
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🔄 Ganti Nomor",
            id: `.gantinomor_${order.chatId}`,
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "❌ Batalkan",
            id: `.cancel_${order.chatId}`,
          }),
        },
      ];

      await sendInteractive(
        conn,
        m.chat,
        {
          text: "✅ Permintaan ulang OTP berhasil dikirim! Menunggu kode baru masuk...",
          footer: getOtpFooter(),
          buttons,
        },
        m,
      );

      otpPollUnicorn(conn, m, order.chatId);
      return;
    }

    let data;
    if (order.apiType === "wahub") {
      data =
        (
          await OTP_AXIOS.post(
            `${getWahubBase()}/rent/${encodeURIComponent(order.token)}/retry`,
            {},
            { headers: otpHeadersWa(), timeout: 15000 },
          )
        ).data || {};
    } else if (order.apiType === "otpinstan_reseller") {
      data =
        (
          await OTP_AXIOS.post(
            `${getInstanBase()}/resend.php`,
            new URLSearchParams({
              order_id: String(order.orderId),
            }).toString(),
            {
              headers: {
                ...otpHeadersSms(),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              timeout: 15000,
            },
          )
        ).data || {};
    } else if (order.apiType === "otpinstan_s9") {
      data =
        (
          await OTP_AXIOS.post(
            `${getInstanBase()}/s9/resend.php`,
            new URLSearchParams({
              order_id: String(order.orderId),
            }).toString(),
            {
              headers: {
                ...otpHeadersSms(),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              timeout: 15000,
            },
          )
        ).data || {};
    } else {
      data =
        (
          await OTP_AXIOS.post(
            `${getInstanBase()}/s1/resend.php`,
            new URLSearchParams({
              order_id: String(order.orderId),
            }).toString(),
            {
              headers: {
                ...otpHeadersSms(),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              timeout: 15000,
            },
          )
        ).data || {};
    }

    order.token = data.token || order.token;
    order.phone = data.phone || data.number || order.phone;
    order.expiresAt = data.expires_at
      ? Number(data.expires_at) * 1000
      : order.expiresAt;
    order.createdAt = Date.now();
    order.isActive = true;
    OTP_STATE.active.set(order.chatId, order);
    otpUpdate(order.userNumber, order.orderId, "active", {
      token: order.token,
      phone: order.phone,
      expiresAt: order.expiresAt,
    });

    const buttons = [
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔄 Ganti Nomor",
          id: `.gantinomor_${order.chatId}`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "❌ Batalkan",
          id: `.cancel_${order.chatId}`,
        }),
      },
    ];

    await sendInteractive(
      conn,
      m.chat,
      {
        text: "✅ Permintaan ulang OTP berhasil! Menunggu kode baru masuk...",
        footer: getOtpFooter(),
        buttons,
      },
      m,
    );

    if (order.apiType === "wahub") await otpPollWa(conn, m, order.chatId);
    else await otpPollSms(conn, m, order.chatId);
  } catch (e) {
    await conn.sendMessage(
      m.chat,
      {
        text: `❌ Gagal minta ulang OTP:\n\n${otpApiError(
          e,
          order.apiType === "wahub"
            ? "WAHub"
            : order.apiType === "unicorn"
              ? "EngineUnicorn"
              : "OTPINSTAN",
        )}`,
      },
      { quoted: m },
    );
  }
};

handler.help = ["kirimulang"];
handler.tags = ["otp"];
handler.command = /^(kirimulang|kirimulang_.*)$/i;

export default handler;
