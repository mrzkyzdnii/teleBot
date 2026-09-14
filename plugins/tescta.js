import { sendInteractive, getOtpFooter, otpSleep } from "../lib/otpEngine.js";

let handler = async (m, { conn }) => {
  const sampleOtp = Math.floor(1000 + Math.random() * 9000).toString();

  const teks = [
    "✦ *OTP RECEIVED* ✦",
    "",
    "📱 *Layanan*: SLOT",
    "📞 *Nomor*: 82261212970",
    `🔑 *Kode OTP*: *${sampleOtp}*`,
    "",
    "Silakan salin kode OTP menggunakan tombol di bawah.",
  ].join("\n");

  await sendInteractive(
    conn,
    m.chat,
    {
      text: teks,
      footer: getOtpFooter(),
      buttons: [
        {
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: `📋 Salin: ${sampleOtp}`,
            copy_code: sampleOtp,
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🛒 Beli Lagi",
            id: ".buyotpwa slot",
          }),
        },
      ],
    },
    m,
  );

  await otpSleep(400);

  await conn.sendMessage(
    m.chat,
    { text: sampleOtp },
    { quoted: m },
  );
};

handler.help = ["tescta"];
handler.tags = ["otp"];
handler.command = /^tescta$/i;

export default handler;
