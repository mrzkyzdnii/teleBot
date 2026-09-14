import { sendInteractive, getOtpFooter } from "../lib/otpEngine.js";

let handler = async (m, { conn }) => {
  await sendInteractive(
    conn,
    m.chat,
    {
      text: "📨 *OTP VIA SMS*\n\nSilakan pilih menu di bawah untuk pemesanan nomor via SMS:",
      footer: getOtpFooter(),
      buttons: [
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🛒 Beli OTP SMS",
            id: ".buyotpsms",
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📋 Daftar Layanan",
            id: ".servicesms",
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🔙 Kembali",
            id: ".layanan",
          }),
        },
      ],
    },
    m,
  );
};

handler.help = ["otpviasms"];
handler.tags = ["otp"];
handler.command = /^otpviasms$/i;

export default handler;
