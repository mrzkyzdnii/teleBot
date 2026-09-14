import OTP_AXIOS from "axios";
import { getUnicornBase, otpHeadersUnicorn, otpApiError } from "../lib/otpEngine.js";

let handler = async (m, { conn }) => {
  try {
    const r = await OTP_AXIOS.get(`${getUnicornBase()}/balance`, {
      headers: otpHeadersUnicorn(),
      timeout: 10000,
    });
    const d = r.data?.data || {};
    const bal = Number(d.balance || 0).toLocaleString("id-ID");
    await conn.sendMessage(
      m.chat,
      {
        text: `💳 *SALDO AKUN SERVER 2*\n\nSisa Saldo: *Rp ${bal}*\nMata Uang: ${d.currency || "IDR"}`,
      },
      { quoted: m },
    );
  } catch (e) {
    await conn.sendMessage(
      m.chat,
      { text: `❌ Gagal cek saldo: ${otpApiError(e, "EngineUnicorn")}` },
      { quoted: m },
    );
  }
};

handler.help = ["balancewa2"];
handler.tags = ["otp"];
handler.command = /^(balancewa2|saldowa2)$/i;

export default handler;
