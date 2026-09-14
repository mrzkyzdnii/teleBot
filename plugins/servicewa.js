import { otpServiceList, otpApiError } from "../lib/otpEngine.js";

let handler = async (m, { conn }) => {
  try {
    const services = await otpServiceList(true);

    const list = services
      .sort((a, b) =>
        String(a.name).localeCompare(String(b.name))
      )
      .map(
        (service) =>
          `${Number(service.stock) > 0 ? "🟢" : "🔴"} *${service.name || `ID ${service.id}`}* · Stok: ${service.stock ?? "?"}`
      )
      .join("\n");

    await conn.sendMessage(
      m.chat,
      {
        text: `📋 *LAYANAN WA (SERVER 1)*\n\n${list}\n\n📌 Format: .buyotpwa <nama> [jumlah]`,
      },
      { quoted: m }
    );
  } catch (e) {
    await conn.sendMessage(
      m.chat,
      {
        text: `❌ Gagal mengambil layanan: ${otpApiError(e, "WAHub")}`,
      },
      { quoted: m }
    );
  }
};

handler.help = ["servicewa"];
handler.tags = ["otp"];
handler.command = /^servicewa$/i;

export default handler;
