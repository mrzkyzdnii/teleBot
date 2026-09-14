import axios from "axios";
import { otpGetUser, otpSaveUser, sendInteractive, getOtpFooter } from "../lib/otpEngine.js";
import "../config.js";

const getAutoGopayBase = () => (global.autogopay?.base || "https://v1-gateway.autogopay.site").replace(/\/$/, "");
const getAutoGopayKey = () => (global.autogopay?.key || "").trim();

// Map untuk melacak tagihan deposit yang sedang aktif / menunggu pembayaran
const activeDeposits = global.__activeDeposits || (global.__activeDeposits = new Map());

// Request QRIS dengan auto-retry 3x untuk mengatasi transient delay upstream
async function requestQrisWithRetry(apiBase, apiKey, nominal, maxRetries = 3) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.post(
        `${apiBase}/interactive/qris/create`,
        { amount: nominal },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
      lastErr = new Error(res.data?.message || "Gagal membuat QRIS.");
    } catch (err) {
      lastErr = err;
      console.warn(`[AUTOGOPAY ATTEMPT ${attempt}]:`, err?.response?.data?.message || err.message);
    }
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr;
}

// Cek status QRIS dengan retry dan timeout lebih panjang untuk menangani delay server bank
async function checkStatusWithRetry(apiBase, apiKey, invoiceId, refNo, maxRetries = 2) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.post(
        `${apiBase}/interactive/qris/status`,
        { invoice_id: String(invoiceId), ref_no: String(refNo) },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 20000,
        }
      );
      if (res.data) return res.data;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  throw lastErr;
}

// Fungsi bantu untuk memproses penambahan saldo deposit
async function creditUserDeposit(conn, chatId, userId, amount, invoiceId, refNo, qrisMessageId) {
  // Hapus pesan / tombol QRIS pembayaran lama agar hanya tersisa pesan pembayaran berhasil
  if (qrisMessageId) {
    await conn.bot.api.deleteMessage(chatId, qrisMessageId).catch(async () => {
      await conn.bot.api.editMessageReplyMarkup(chatId, qrisMessageId, {
        reply_markup: { inline_keyboard: [] },
      }).catch(() => {});
    });
  }

  const u = otpGetUser(userId);
  if (!u.deposits) u.deposits = [];

  // Hindari duplikasi pencatatan invoice yang sama
  const alreadyCredited = u.deposits.some((d) => d.invoiceId === String(invoiceId));
  if (alreadyCredited) return false;

  u.deposits.push({
    amount,
    date: Date.now(),
    invoiceId: String(invoiceId),
    refNo: String(refNo || ""),
    method: "QRIS Interactive (AutoGoPay)",
  });

  u.saldo = (u.saldo || 0) + amount;
  u.totalDeposit = (u.totalDeposit || 0) + amount;
  otpSaveUser(userId, u);

  const formattedAmount = amount.toLocaleString("id-ID");
  const formattedSaldo = u.saldo.toLocaleString("id-ID");
  const formattedTotal = u.totalDeposit.toLocaleString("id-ID");

  await conn.sendMessage(chatId, {
    text: [
      "🎉 *PEMBAYARAN QRIS BERHASIL DITERIMA!*",
      "",
      `✅ *Status*: Lunas (Settlement)`,
      `👤 *Pengguna*: \`${userId}\``,
      `💰 *Nominal*: Rp ${formattedAmount}`,
      `💳 *Saldo Aktif*: Rp ${formattedSaldo}`,
      `📈 *Total Deposit*: Rp ${formattedTotal}`,
      `🧾 *Invoice ID*: \`${invoiceId}\``,
      "",
      "Terima kasih! Saldo telah otomatis masuk dan siap digunakan untuk order nomor OTP.",
    ].join("\n"),
    buttons: [
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "📱 Sewa Nomor OTP",
          id: ".layanan",
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "👤 Cek Profil & Saldo",
          id: ".profile",
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
  });

  // Kirim LIVE NOTIFIKASI langsung ke Owner (ID: 1271362249)
  const ownerId = "1271362249";
  try {
    const timeStr = new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "medium",
    });

    const ownerNotifText = [
      "🔔 *[LIVE DEPOSIT]* Pembayaran Masuk!",
      "",
      `👤 *Pengguna*: ${u.name || "Pengguna"} (\`${userId}\`)`,
      `💰 *Nominal*: *Rp ${formattedAmount}*`,
      `💳 *Saldo User*: Rp ${formattedSaldo}`,
      `📈 *Total Deposit*: Rp ${formattedTotal}`,
      `🧾 *Invoice ID*: \`${invoiceId}\``,
      `🏷 *Ref No*: \`${refNo || "-"}\``,
      `🕒 *Waktu*: ${timeStr} WIB`,
      `🏦 *Metode*: QRIS All Payment (AutoGoPay)`,
      "",
      "✅ _Status: Lunas & Saldo langsung masuk otomatis ke akun user._",
    ].join("\n");

    await conn.sendMessage(ownerId, { text: ownerNotifText }).catch(() => {});
  } catch (ownerErr) {
    console.error("[OWNER NOTIF ERROR]:", ownerErr.message);
  }

  return true;
}

let handler = async (m, { conn, text, args, usedPrefix, command }) => {
  const cmd = command.toLowerCase();
  const apiKey = getAutoGopayKey();
  const apiBase = getAutoGopayBase();

  if (!apiKey) {
    await conn.reply(m.chat, "❌ API Key AutoGoPay belum dikonfigurasi di `config.js`.", m);
    return;
  }

  // 1. HANDLER BATALKAN TAGIHAN (.canceldepo <invoiceId>)
  if (cmd === "canceldepo") {
    const invId = (args[0] || "").trim();
    if (!invId) {
      await conn.reply(m.chat, "📌 Format: `.canceldepo <invoice_id>`", m);
      return;
    }

    const session = activeDeposits.get(invId);
    if (session) {
      if (session.timer) clearInterval(session.timer);
      if (session.messageId) {
        await conn.bot.api.deleteMessage(m.chat, session.messageId).catch(async () => {
          await conn.bot.api.editMessageReplyMarkup(m.chat, session.messageId, {
            reply_markup: { inline_keyboard: [] },
          }).catch(() => {});
        });
      }
      activeDeposits.delete(invId);
      await conn.reply(m.chat, `✅ Tagihan deposit \`${invId}\` berhasil dibatalkan.`, m);
    } else {
      await conn.reply(m.chat, `ℹ️ Tagihan deposit \`${invId}\` tidak ditemukan atau sudah selesai.`, m);
    }
    return;
  }

  // 2. HANDLER CEK STATUS MANUAL (.cekdepo <invoiceId> <refNo>)
  if (cmd === "cekdepo") {
    const invId = (args[0] || "").trim();
    const refNoParam = (args[1] || "").trim();
    if (!invId) {
      await conn.sendMessage(m.chat, { text: "📌 Format: `.cekdepo <invoice_id>`" });
      return;
    }

    const session = activeDeposits.get(invId);
    const refNo = refNoParam || session?.refNo;

    if (!refNo && !session) {
      await conn.sendMessage(m.chat, {
        text: `ℹ️ Tagihan \`${invId}\` tidak ditemukan atau sudah selesai/kadaluwarsa.`,
      });
      return;
    }

    try {
      const data = await checkStatusWithRetry(apiBase, apiKey, invId, refNo, 2);

      if (data?.success && data?.data?.status === "success") {
        if (session?.timer) clearInterval(session.timer);
        activeDeposits.delete(invId);
        const amount = data?.data?.amount || session?.amount || 0;
        await creditUserDeposit(conn, session?.chatId || m.chat, session?.userId || m.sender, amount, invId, refNo, session?.messageId);
      } else {
        await conn.sendMessage(m.chat, {
          text: [
            "⏳ *STATUS: MENUNGGU PEMBAYARAN*",
            "",
            `🧾 *Invoice ID*: \`${invId}\``,
            session?.amount ? `💰 *Nominal*: Rp ${session.amount.toLocaleString("id-ID")}` : "",
            `⌛ *Status*: Belum Terbayar (Pending)`,
            "",
            "Silakan scan dan bayar QRIS di atas. Begitu pembayaran lunas, saldo akan otomatis bertambah ke akun kamu!",
          ].filter(Boolean).join("\n"),
        });
      }
    } catch (err) {
      const isTimeout = err.code === "ECONNABORTED" || err.message?.includes("timeout");
      if (isTimeout) {
        await conn.sendMessage(m.chat, {
          text: [
            "⏳ *SERVER BANK SEDANG SIBUK*",
            "",
            "Pengecekan ke bank membutuhkan respon lebih lama dari biasanya. Pembayaran kamu tetap aman dan sistem auto-detect tetap aktif di background.",
            "",
            "Silakan klik tombol *[🔄 Cek Status Pembayaran]* sekali lagi.",
          ].join("\n"),
        });
      } else {
        await conn.sendMessage(m.chat, {
          text: `❌ Gagal memeriksa status: ${err?.response?.data?.message || err.message}`,
        });
      }
    }
    return;
  }

  // 3. HANDLER PROMPT INPUT NOMINAL KUSTOM (.inputdepo)
  if (cmd === "inputdepo") {
    global.__waitingDepositInput = global.__waitingDepositInput || new Set();
    global.__waitingDepositInput.add(m.sender);

    const messageText = [
      "✍️ *INPUT NOMINAL DEPOSIT KUSTOM*",
      "",
      "Silakan ketik nominal yang ingin kamu depositkan langsung di chat ini (cukup ketik angkanya saja).",
      "",
      "💡 *Contoh*: `15000` atau `25000`",
      "📌 *Minimal*: Rp 1.000 | *Maksimal*: Rp 10.000.000",
    ].join("\n");

    const buttons = [
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔙 Batal / Pilihan Nominal",
          id: `${usedPrefix}deposit`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🏠 Menu Utama",
          id: ".menu",
        }),
      },
    ];

    await sendInteractive(conn, m.chat, { text: messageText, footer: getOtpFooter(), buttons }, m);
    return;
  }

  // 3. PILIHAN NOMINAL CEPAT (Jika tanpa parameter nominal)
  const cleanInput = (text || "").replace(/[^0-9]/g, "").trim();
  const nominal = parseInt(cleanInput, 10);

  if (!cleanInput || isNaN(nominal) || nominal < 1000) {
    const user = otpGetUser(m.sender);
    const saldoText = Number(user.saldo || 0).toLocaleString("id-ID");

    const messageText = [
      "✦ *DEPOSIT SALDO OTOMATIS* ✦",
      "",
      `👤 *Akun*: ${m.pushName || "Pengguna"} (\`${m.sender}\`)`,
      `💰 *Saldo Saat Ini*: Rp ${saldoText}`,
      "",
      "💳 *Metode*: QRIS Dinamis (All Payment)",
      "Bisa dibayar lewat DANA, OVO, GoPay, ShopeePay, BCA, Mandiri, BRI, BNI, dll.",
      "",
      "📌 *Pilih nominal deposit di bawah ini* atau ketik nominal sendiri:",
      `Contoh: \`${usedPrefix}deposit 15000\``,
      "_(Minimal deposit Rp 1.000)_",
    ].join("\n");

    const buttons = [
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "Rp 2.000",
          id: `${usedPrefix}deposit 2000`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "Rp 5.000",
          id: `${usedPrefix}deposit 5000`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "Rp 10.000",
          id: `${usedPrefix}deposit 10000`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "Rp 20.000",
          id: `${usedPrefix}deposit 20000`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "Rp 50.000",
          id: `${usedPrefix}deposit 50000`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "Rp 100.000",
          id: `${usedPrefix}deposit 100000`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "✏️ Input Nominal Kustom",
          id: `${usedPrefix}inputdepo`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔙 Kembali ke Menu",
          id: ".menu",
        }),
      },
    ];

    await sendInteractive(conn, m.chat, { text: messageText, footer: getOtpFooter(), buttons }, m);
    return;
  }

  if (nominal > 10000000) {
    await conn.reply(m.chat, "❌ Maksimal nominal deposit adalah Rp 10.000.000 per transaksi.", m);
    return;
  }

  // Batalkan sesi aktif user sebelumnya jika ada yang belum dibayar
  for (const [key, session] of activeDeposits.entries()) {
    if (session.userId === m.sender) {
      if (session.timer) clearInterval(session.timer);
      activeDeposits.delete(key);
    }
  }

  // 4. REQUEST GENERATE QRIS KE AUTOGOPAY
  const loadingMsg = await conn.reply(m.chat, `⏳ Sedang membuat QRIS untuk nominal *Rp ${nominal.toLocaleString("id-ID")}*...`, m);

  try {
    const qrisData = await requestQrisWithRetry(apiBase, apiKey, nominal, 3);
    const { qr_url, invoice_id, ref_no, amount } = qrisData;

    // Download gambar QRIS ke memory buffer agar aman dikirim ke Telegram
    const imgRes = await axios.get(qr_url, {
      responseType: "arraybuffer",
      timeout: 10000,
    });
    const qrBuffer = Buffer.from(imgRes.data);

    // Hapus pesan loading agar chat tetap rapi
    if (loadingMsg?.message_id) {
      await conn.bot.api.deleteMessage(m.chat, loadingMsg.message_id).catch(() => {});
    }

    const caption = [
      "💳 *QRIS PEMBAYARAN (ALL PAYMENT)*",
      "",
      `👤 *User*: ${m.pushName || "Pengguna"} (\`${m.sender}\`)`,
      `💰 *Total Bayar*: *Rp ${amount.toLocaleString("id-ID")}*`,
      `🧾 *Invoice ID*: \`${invoice_id}\``,
      `⏳ *Masa Berlaku*: 15 Menit`,
      "",
      "📱 *Cara Pembayaran*:",
      "1. Scan QRIS di atas dengan e-Wallet atau Mobile Banking apa saja (DANA, OVO, GoPay, ShopeePay, BCA, BRI, Mandiri, dll.).",
      "2. Masukkan nominal yang sesuai (jika diminta) dan selesaikan transaksi.",
      "3. Saldo akun bot kamu akan bertambah *OTOMATIS* dalam beberapa detik setelah pembayaran lunas!",
      "",
      "Tekan tombol di bawah jika ingin memeriksa manual atau membatalkan.",
    ].join("\n");

    const buttons = [
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔄 Cek Status Pembayaran",
          id: `.cekdepo ${invoice_id} ${ref_no}`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "❌ Batalkan Tagihan",
          id: `.canceldepo ${invoice_id}`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔙 Menu Utama",
          id: ".menu",
        }),
      },
    ];

    const qrisMsg = await conn.sendMessage(
      m.chat,
      {
        image: qrBuffer,
        caption,
        buttons,
      },
      { quoted: m }
    );

    // 5. BACKGROUND AUTO-POLLING SISTEM (Cek tiap 4 detik selama 15 menit)
    let elapsedSeconds = 0;
    const maxSeconds = 15 * 60; // 15 menit
    const intervalSeconds = 4;

    const pollTimer = setInterval(async () => {
      elapsedSeconds += intervalSeconds;

      // Timeout expired
      if (elapsedSeconds >= maxSeconds) {
        clearInterval(pollTimer);
        const currentSession = activeDeposits.get(String(invoice_id));
        activeDeposits.delete(String(invoice_id));

        if (currentSession?.messageId) {
          await conn.bot.api.deleteMessage(m.chat, currentSession.messageId).catch(async () => {
            await conn.bot.api.editMessageReplyMarkup(m.chat, currentSession.messageId, {
              reply_markup: { inline_keyboard: [] },
            }).catch(() => {});
          });
        }

        await conn.reply(
          m.chat,
          `⌛ *TAGIHAN KADALUWARSA*\n\nTagihan deposit \`${invoice_id}\` sebesar *Rp ${amount.toLocaleString("id-ID")}* telah kadaluwarsa karena tidak dibayar dalam 15 menit.`,
          m
        ).catch(() => {});
        return;
      }

      try {
        const checkRes = await axios.post(
          `${apiBase}/interactive/qris/status`,
          { invoice_id: String(invoice_id), ref_no: String(ref_no) },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            timeout: 18000,
          }
        );

        if (checkRes.data?.success && checkRes.data?.data?.status === "success") {
          clearInterval(pollTimer);
          const currentSession = activeDeposits.get(String(invoice_id));
          activeDeposits.delete(String(invoice_id));
          await creditUserDeposit(conn, m.chat, m.sender, amount, invoice_id, ref_no, currentSession?.messageId || qrisMsg?.message_id);
        }
      } catch (pollErr) {
        // Abaikan transient network error saat polling berkala
      }
    }, intervalSeconds * 1000);

    // Simpan data sesi aktif
    activeDeposits.set(String(invoice_id), {
      userId: m.sender,
      chatId: m.chat,
      amount,
      invoiceId: String(invoice_id),
      refNo: String(ref_no),
      messageId: qrisMsg?.message_id,
      timer: pollTimer,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.error("[AUTOGOPAY ERROR]:", err?.response?.data || err.message);
    const errMsg = err?.response?.data?.message || err.message || "Gagal menghubungi gateway pembayaran.";
    await conn.sendMessage(
      m.chat,
      {
        text: `❌ *Gagal membuat QRIS*: ${errMsg}\n\nServer gateway sedang mengalami kendala sesaat. Silakan klik tombol di bawah untuk mencoba kembali:`,
        buttons: [
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `🔄 Coba Lagi (Rp ${nominal.toLocaleString("id-ID")})`,
              id: `${usedPrefix}deposit ${nominal}`,
            }),
          },
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🔙 Pilihan Nominal",
              id: `${usedPrefix}deposit`,
            }),
          },
        ],
      },
      { quoted: m }
    );
  }
};

handler.help = ["deposit <nominal>", "qris <nominal>"];
handler.tags = ["main", "otp"];
handler.command = /^(deposit|qris|depo|bayar|cekdepo|canceldepo|inputdepo)$/i;

export default handler;
