import {
  otpServiceListSms,
  sendNativeList,
  otpBuySms,
  getOtpFooter,
  getSmsMap
} from "../lib/otpEngine.js";

let handler = async (m, { conn, text }) => {
  const isMenuParam =
    (text || "").trim().toLowerCase().includes("menu") ||
    (m?.text || "").toLowerCase().includes("menu");
  const rawParts = (text || "")
    .trim()
    .split(/\s+/)
    .filter((p) => Boolean(p) && p.toLowerCase() !== "menu");
  let amount = 1;
  let platform = "";

  if (rawParts.length === 0) {
    try {
      const services = await otpServiceListSms(true);
      const sections = [
        {
          title: "Daftar Layanan SMS",
          rows: services.map((s) => ({
            header: "",
            title: String(s.name).toUpperCase(),
            description: `📦 Stok: ${s.stock ?? 0}`,
            id: `.buyotpsms ${s.name}`,
            rowId: `.buyotpsms ${s.name}`,
          })),
        },
      ];

      await sendNativeList(
        conn,
        m.chat,
        {
          text: "📨 *PILIH APLIKASI (SMS)*\n\nSilakan pilih aplikasi yang ingin dipesan:",
          footer: getOtpFooter(),
          buttonText: "📱 Pilih Aplikasi",
          backTarget: isMenuParam ? ".menu" : ".layanan",
          sections,
        },
        m,
      );
    } catch (e) {
      await conn.sendMessage(
        m.chat,
        { text: `❌ Gagal memuat daftar SMS: ${e.message}` },
        { quoted: m },
      );
    }
    return;
  }

  if (rawParts.length > 1 && /^\d+$/.test(rawParts[rawParts.length - 1])) {
    amount = parseInt(rawParts.pop(), 10);
    platform = rawParts.join(" ");
  } else {
    platform = rawParts.join(" ");
  }

  const smsMap = getSmsMap();
  if (!platform) {
    await conn.sendMessage(
      m.chat,
      {
        text:
          `📌 *Format*: .buyotpsms <platform> [jumlah]\n\n` +
          `*Contoh*:\n` +
          `• .buyotpsms ovo\n` +
          `• .buyotpsms ovo 2\n\n` +
          `✅ ${Object.keys(smsMap).sort().join(", ")}`,
      },
      { quoted: m },
    );
    return;
  }

  if (!Number.isInteger(amount) || amount < 1) {
    await conn.sendMessage(
      m.chat,
      { text: "❌ Jumlah harus berupa angka minimal 1." },
      { quoted: m },
    );
    return;
  }

  if (amount > 20) {
    await conn.sendMessage(
      m.chat,
      { text: "❌ Maksimal pembelian adalah 20 nomor sekaligus." },
      { quoted: m },
    );
    return;
  }

  await otpBuySms(conn, m, platform, amount);
};

handler.help = ["buyotpsms <platform> [jumlah]"];
handler.tags = ["otp"];
handler.command = /^buyotpsms$/i;

export default handler;
