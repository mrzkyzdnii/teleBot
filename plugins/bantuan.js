import { sendInteractive, getOtpFooter } from "../lib/otpEngine.js";

let handler = async (m, { conn }) => {
  const bantuanText = [
    "✦ *BANTUAN & LAYANAN PENGGUNA* ✦",
    "",
    "Ada pertanyaan, kendala saldo, atau butuh bantuan order?",
    "Silakan hubungi customer service kami melalui kontak resmi berikut:",
    "",
    "👤 *Admin / Owner*: SIJELITA",
    "💬 *Telegram*: @sijelitaaaaaa",
    "📱 *WhatsApp*: 08136594533",
    "",
    "Silakan klik tombol di bawah untuk langsung menghubungi Admin via Telegram atau WhatsApp.",
  ].join("\n");

  await sendInteractive(
    conn,
    m.chat,
    {
      text: bantuanText,
      footer: getOtpFooter(),
      buttons: [
        {
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "💬 Chat Telegram (@sijelitaaaaaa)",
            url: "https://t.me/sijelitaaaaaa",
          }),
        },
        {
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "📱 Chat WhatsApp (08136594533)",
            url: "https://wa.me/628136594533",
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
    m,
  );
};

handler.help = ["bantuan", "cs"];
handler.tags = ["main"];
handler.command = /^(bantuan|cs|support)$/i;

export default handler;
