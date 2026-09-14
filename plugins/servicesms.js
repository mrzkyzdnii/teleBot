import { otpServiceListSms, getSmsMap } from "../lib/otpEngine.js";

let handler = async (m, { conn }) => {
  try {
    const services = await otpServiceListSms(true);
    const list = services
      .map((s) => `🟢 *${s.name.toUpperCase()}* · Stok: ${s.stock ?? 0}`)
      .join("\n");
    await conn.sendMessage(
      m.chat,
      {
        text: `📋 *LAYANAN SMS*\n\n${list}\n\n📌 Format: .buyotpsms <nama> [jumlah]`,
      },
      { quoted: m },
    );
  } catch (e) {
    const smsMap = getSmsMap();
    const list = Object.keys(smsMap)
      .sort()
      .map((name) => `🟢 *${name.toUpperCase()}*`)
      .join("\n");
    await conn.sendMessage(
      m.chat,
      {
        text: `📋 *LAYANAN SMS*\n\n${list}\n\n📌 Format: .buyotpsms <nama> [jumlah]`,
      },
      { quoted: m },
    );
  }
};

handler.help = ["servicesms"];
handler.tags = ["otp"];
handler.command = /^servicesms$/i;

export default handler;
