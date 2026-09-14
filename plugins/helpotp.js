import { sendInteractive, getOtpFooter } from "../lib/otpEngine.js";

let handler = async (m, { conn }) => {
  const teks = [
    "✦ *PANDUAN LENGKAP BOT OTP* ✦",
    "",
    "📱 *WhatsApp Server 1*",
    "• `.buyotpwa` ⇢ Pilih aplikasi dari list",
    "• `.buyotpwa <nama> [jumlah]` ⇢ Order instan",
    "",
    "📱 *WhatsApp Server 2*",
    "• `.buyotpwa2` ⇢ Pilih aplikasi dari list",
    "• `.buyotpwa2 <nama> [jumlah]` ⇢ Order instan",
    "• `.balancewa2` ⇢ Cek saldo Server 2",
    "",
    "📨 *SMS OTP*",
    "• `.buyotpsms` ⇢ Pilih aplikasi dari list",
    "• `.buyotpsms <nama> [jumlah]` ⇢ Order instan",
    "",
    "⚙️ *Aksi Order Aktif*",
    "• `.cancel` ⇢ Batalkan pesanan aktif terakhir",
    "• `.cancelall` ⇢ Batalkan seluruh pesanan aktif",
    "• `.gantinomor` ⇢ Tukar ke nomor baru",
    "• `.kirimulang` ⇢ Minta kirim ulang kode OTP",
  ].join("\n");

  await sendInteractive(
    conn,
    m.chat,
    {
      text: teks,
      footer: getOtpFooter(),
      buttons: [
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📱 WA Server 1",
            id: ".buyotpwa",
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📱 WA Server 2",
            id: ".buyotpwa2",
          }),
        },
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
};

handler.help = ["helpotp"];
handler.tags = ["otp"];
handler.command = /^helpotp$/i;

export default handler;
