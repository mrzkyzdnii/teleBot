import fs from "fs";
import path from "path";
import { sendInteractive, getOtpFooter } from "../lib/otpEngine.js";

let handler = async (m, { conn }) => {
  const menuText = [
    "✦ *LAYANAN OTP ONLINE* ✦",
    "",
    "Silahkan pilih layanan dibawah ini",
  ].join("\n");

  const jelitaPath = path.resolve("./jelita.jpg");
  const image = fs.existsSync(jelitaPath) ? jelitaPath : null;

  await sendInteractive(
    conn,
    m.chat,
    {
      text: menuText,
      footer: getOtpFooter(),
      image,
      buttons: [
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📱 OTP via WA",
            id: ".otpviawa menu",
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📨 OTP via SMS",
            id: ".buyotpsms menu",
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💳 Pembayaran",
            id: ".qris",
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "❓ Help OTP",
            id: ".helpotp",
          }),
        },
        {
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "💬 Chat Owner",
            url: "https://t.me/sijelitaaaaaa",
          }),
        },
      ],
    },
    m,
  );
};

handler.help = ["menu", "help"];
handler.tags = ["main", "otp"];
handler.command = /^(menu|help|bot)$/i;

export default handler;
