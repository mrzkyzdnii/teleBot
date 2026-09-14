import { sendInteractive, getOtpFooter } from "../lib/otpEngine.js";

let handler = async (m, { conn, text }) => {
  const fromMenu = Boolean(text && text.toLowerCase().includes("menu"));
  const backTarget = fromMenu ? ".menu" : ".layanan";
  const s1Target = fromMenu ? ".buyotpwa menu" : ".buyotpwa";
  const s2Target = fromMenu ? ".buyotpwa2 menu" : ".buyotpwa2";

  const waText = [
    "✦ *OTP VIA WHATSAPP* ✦",
    "",
    "Pilih server nomor WhatsApp yang ingin kamu gunakan:",
  ].join("\n");

  await sendInteractive(
    conn,
    m.chat,
    {
      text: waText,
      footer: getOtpFooter(),
      buttons: [
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📱 WA Server 1",
            id: s1Target,
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📱 WA Server 2",
            id: s2Target,
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🔙 Kembali",
            id: backTarget,
          }),
        },
      ],
    },
    m,
  );
};

handler.help = ["otpviawa"];
handler.tags = ["otp"];
handler.command = /^otpviawa$/i;

export default handler;
