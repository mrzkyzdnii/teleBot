let handler = async (m, { conn, text }) => {
  await conn.sendMessage(
    m.chat,
    { text: text || "Tidak ada kode OTP." },
    { quoted: m },
  );
};

handler.help = ["copy <code>"];
handler.tags = ["otp"];
handler.command = /^copy$/i;

export default handler;
