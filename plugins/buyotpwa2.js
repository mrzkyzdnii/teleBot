import {
  otpServiceListUnicorn,
  sendNativeList,
  otpApiError,
  otpBuyWa2,
  getOtpFooter
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
      const services = await otpServiceListUnicorn(true);
      const sorted = services
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));

      const sections = [
        {
          title: "Daftar Layanan (Server 2)",
          rows: sorted.map((s) => ({
            header: "",
            title: String(s.name),
            description: `📦 Stok: ${Number(s.stock || 0).toLocaleString("id-ID")}`,
            id: `.buyotpwa2 ${s.name}`,
            rowId: `.buyotpwa2 ${s.name}`,
          })),
        },
      ];

      await sendNativeList(
        conn,
        m.chat,
        {
          text: "📱 *PILIH APLIKASI (SERVER 2)*\n\nSilakan pilih aplikasi yang ingin dipesan:",
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
        { text: `❌ Gagal memuat daftar Server 2: ${otpApiError(e, "EngineUnicorn")}` },
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
    await conn.sendMessage(
      m.chat,
      {
        text:
          `📌 *Format*: .buyotpwa2 <platform> [jumlah]\n\n` +
          `*Contoh*:\n` +
          `• .buyotpwa2 chagee\n` +
          `• .buyotpwa2 kopken 2\n` +
          `• .buyotpwa2 facebook 3`,
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

  await otpBuyWa2(conn, m, platform, amount);
};

handler.help = ["buyotpwa2 <platform> [jumlah]"];
handler.tags = ["otp"];
handler.command = /^buyotpwa2$/i;

export default handler;
