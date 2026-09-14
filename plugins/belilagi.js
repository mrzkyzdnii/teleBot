import {
  otpBuyWa,
  otpBuyWa2,
  otpBuySms,
  getWaMap,
  getSmsMap
} from "../lib/otpEngine.js";

let handler = async (m, { conn, args, command }) => {
  let paramParts = [...(args || [])];
  if (paramParts.length === 0 && command.startsWith("belilagi_")) {
    paramParts = command.replace("belilagi_", "").split("_");
  }

  let provider = null;
  let platform = paramParts.join("_");
  if (paramParts[0] === "wa" || paramParts[0] === "wa2" || paramParts[0] === "sms") {
    provider = paramParts.shift();
    platform = paramParts.join("_");
  }

  const cleanPlatform = platform.replace(/_/g, " ").trim();
  if (!cleanPlatform) {
    await conn.sendMessage(
      m.chat,
      { text: "❌ Silakan masukkan nama platform layanan yang ingin dibeli lagi." },
      { quoted: m },
    );
    return;
  }

  const waMap = getWaMap();
  const smsMap = getSmsMap();

  if (provider === "wa2") {
    await otpBuyWa2(conn, m, cleanPlatform, 1);
  } else if (
    provider === "sms" ||
    (!provider &&
      !waMap[cleanPlatform.toLowerCase()] &&
      smsMap[cleanPlatform.toLowerCase()])
  ) {
    await otpBuySms(conn, m, cleanPlatform, 1);
  } else {
    await otpBuyWa(conn, m, cleanPlatform, 1);
  }
};

handler.help = ["belilagi [wa/wa2/sms] <platform>"];
handler.tags = ["otp"];
handler.command = /^(belilagi|belilagi_.*)$/i;

export default handler;
