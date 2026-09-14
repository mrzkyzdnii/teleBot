import { otpGetUser, getOtpFooter, sendInteractive, OTP_USERS_DIR } from "../lib/otpEngine.js";
import fs from "fs";
import path from "path";

let handler = async (m, { conn, text, args }) => {
  const isOwner = (global.owner || []).some(
    (o) => String(o).includes(m.sender) || (Array.isArray(o) && String(o[0]) === String(m.sender))
  );

  // Jika Owner ingin melihat daftar semua user yang pernah beli / deposit
  if (isOwner && args[0]?.toLowerCase() === "all") {
    const files = fs.existsSync(OTP_USERS_DIR)
      ? fs.readdirSync(OTP_USERS_DIR).filter((f) => f.endsWith(".json"))
      : [];

    if (files.length === 0) {
      await conn.reply(m.chat, "📋 Belum ada data transaksi user.", m);
      return;
    }

    const summaryList = [];
    for (const f of files) {
      try {
        const uData = JSON.parse(fs.readFileSync(path.join(OTP_USERS_DIR, f), "utf8"));
        const uid = uData.number;
        const uName = uData.name || "User";
        const ordersCount = uData.orders?.length || 0;
        const depoTotal = Number(uData.totalDeposit || 0).toLocaleString("id-ID");
        summaryList.push(`• *${uName}* (\`${uid}\`)\n  📦 Order: ${ordersCount}x | 💰 Depo: Rp ${depoTotal}`);
      } catch {}
    }

    const report = [
      "✦ *DAFTAR TRANSAKSI SELURUH USER* ✦",
      "",
      summaryList.slice(0, 30).join("\n\n"),
      "",
      "📌 Cek detail user tertentu: `.riwayat <ID_USER>`",
    ].join("\n");

    await conn.reply(m.chat, report, m);
    return;
  }

  // Target ID: jika owner mengisi ID target, tampilkan riwayat user tersebut
  let targetId = m.sender;
  if (isOwner && args[0] && /^\d+$/.test(args[0])) {
    targetId = args[0];
  }

  const u = otpGetUser(targetId);
  const totalDepo = Number(u.totalDeposit || 0).toLocaleString("id-ID");
  const orders = u.orders || [];
  const deposits = u.deposits || [];

  const lines = [
    `✦ *RIWAYAT TRANSAKSI ${targetId === m.sender ? "SAYA" : `USER ${targetId}`}* ✦`,
    "",
    `👤 *Nama*: ${u.name || "Pengguna"}`,
    `💰 *Total Deposit*: Rp ${totalDepo}`,
    `📦 *Total Order OTP*: ${orders.length} pesanan`,
    "",
    "── 📦 PESANAN OTP TERAKHIR ──",
  ];

  if (orders.length === 0) {
    lines.push("Belum ada riwayat pesanan OTP.");
  } else {
    // Tampilkan 7 pesanan terakhir
    const latestOrders = orders.slice(-7).reverse();
    for (const o of latestOrders) {
      const statusIcon =
        o.status === "completed" || o.status === "done"
          ? "🟢"
          : o.status === "cancelled" || o.status === "canceled"
          ? "🔴"
          : "🟡";
      const statusText =
        o.status === "completed" || o.status === "done"
          ? "Selesai"
          : o.status === "cancelled" || o.status === "canceled"
          ? "Batal"
          : "Aktif";
      const orderDate = new Date(o.createdAt || Date.now()).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      const platformName = String(o.platform || "OTP").toUpperCase();
      const phoneNum = o.phone || "-";
      lines.push(`${statusIcon} *${platformName}* (${phoneNum})\n   └ Status: ${statusText} · ${orderDate}`);
    }
  }

  if (deposits.length > 0) {
    lines.push("");
    lines.push("── 💳 RIWAYAT DEPOSIT TERAKHIR ──");
    const latestDeposits = deposits.slice(-5).reverse();
    for (const d of latestDeposits) {
      const dDate = new Date(d.date || Date.now()).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      });
      lines.push(`• 💳 Rp ${Number(d.amount || 0).toLocaleString("id-ID")} · ${dDate}`);
    }
  }

  const buttons = [
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "📱 Beli OTP",
        id: ".layanan",
      }),
    },
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "💳 Deposit Saldo",
        id: ".deposit",
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

  await sendInteractive(
    conn,
    m.chat,
    {
      text: lines.join("\n"),
      footer: getOtpFooter(),
      buttons,
    },
    m
  );
};

handler.help = ["riwayat", "history"];
handler.tags = ["main"];
handler.command = /^(riwayat|history|pesanansaya)$/i;

export default handler;
