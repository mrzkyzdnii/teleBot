import {
  otpServiceListCatalog,
  sendNativeList,
  otpApiError,
  otpBuyWa,
  getOtpFooter,
  getWaMap,
  getWaServicePrice,
  otpGetUser
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
      const services = await otpServiceListCatalog(true);
      const sorted = services
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));

      const sections = [
        {
          title: "Daftar Layanan (Server 1)",
          rows: sorted.map((s) => ({
            header: "",
            title: String(s.name),
            description: `📦 Stok: ${s.stock ?? 0}`,
            id: `.buyotpwa ${s.name}`,
            rowId: `.buyotpwa ${s.name}`,
          })),
        },
      ];

      await sendNativeList(
        conn,
        m.chat,
        {
          text: "📱 *PILIH APLIKASI (SERVER 1)*\n\nSilakan pilih aplikasi yang ingin dipesan:",
          footer: getOtpFooter(),
          buttonText: "📱 Pilih Aplikasi",
          backTarget: isMenuParam ? ".otpviawa menu" : ".otpviawa",
          sections,
        },
        m,
      );
    } catch (e) {
      await conn.sendMessage(
        m.chat,
        { text: `❌ Gagal memuat daftar Server 1: ${otpApiError(e, "WAHub")}` },
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

  if (!platform) {
    const catalog = global.otp_wa_catalog || [];
    const listNames = catalog.map((c) => c.name).sort().join(", ");
    await conn.sendMessage(
      m.chat,
      {
        text:
          `📌 *Format*: .buyotpwa <platform> [jumlah]\n\n` +
          `*Contoh*:\n` +
          `• .buyotpwa ovo\n` +
          `• .buyotpwa kuaisho 2\n\n` +
          `✅ *Layanan Tersedia (Server 1)*:\n${listNames}`,
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

  await otpBuyWa(conn, m, platform, amount);
};

handler.help = ["buyotpwa <platform> [jumlah]"];
handler.tags = ["otp"];
handler.command = /^buyotpwa$/i;

export default handler;
