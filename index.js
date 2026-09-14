import http from "http";
import { Bot, InputFile } from "grammy";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import "./config.js";

// Ambil token dari config.js atau environment variable
const token = (global.telegramToken || process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "").trim();

if (!token || token === "TARUH_TOKEN_TELEGRAM_DISINI") {
  console.log(chalk.redBright("\n======================================================="));
  console.log(chalk.yellowBright(" [!] TELEGRAM BOT TOKEN BELUM DIISI"));
  console.log(chalk.white(" Silakan buka file ") + chalk.cyanBright("config.js"));
  console.log(chalk.white(" Lalu isi: ") + chalk.greenBright("global.telegramToken = 'TOKEN_DARI_BOTFATHER'"));
  console.log(chalk.white(" Atau jalankan: ") + chalk.greenBright("export TELEGRAM_BOT_TOKEN='TOKEN_LU' node index.js"));
  console.log(chalk.redBright("=======================================================\n"));
  process.exit(1);
}

const bot = new Bot(token);
const plugins = new Map();

// ReplyKeyboardMarkup persistent di bawah input chat (Layanan, Deposit, Riwayat, Profil, Bantuan)
const replyKeyboard = {
  keyboard: [
    [
      { text: "📱 Layanan" },
      { text: "💳 Deposit" },
    ],
    [
      { text: "📜 Riwayat" },
      { text: "👤 Profil" },
    ],
    [
      { text: "❓ Bantuan" },
    ],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

// Helper untuk mengirim pesan teks dengan safe parse mode
async function safeSendMessage(chatId, text, options = {}) {
  try {
    return await bot.api.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      ...options,
    });
  } catch (err) {
    if (
      err.description?.includes("user is deactivated") ||
      err.description?.includes("bot was blocked by the user") ||
      err.error_code === 403
    ) {
      console.warn(`[SEND FAILED] Chat ${chatId} unavailable (403): ${err.description}`);
      return null;
    }
    // Fallback tanpa parse_mode jika ada karakter format markdown yang bentrok
    try {
      return await bot.api.sendMessage(chatId, text, {
        ...options,
        parse_mode: undefined,
      });
    } catch (err2) {
      if (
        err2.description?.includes("user is deactivated") ||
        err2.description?.includes("bot was blocked by the user") ||
        err2.error_code === 403
      ) {
        console.warn(`[SEND FAILED] Chat ${chatId} unavailable (403): ${err2.description}`);
        return null;
      }
      throw err2;
    }
  }
}

// Helper untuk mengedit pesan teks secara aman (in-place)
async function safeEditMessage(chatId, messageId, text, options = {}) {
  try {
    return await bot.api.editMessageText(chatId, messageId, text, {
      parse_mode: "Markdown",
      ...options,
    });
  } catch (err) {
    if (
      err.description?.includes("user is deactivated") ||
      err.description?.includes("bot was blocked by the user") ||
      err.error_code === 403
    ) {
      return null;
    }
    if (err.description?.includes("message is not modified")) {
      return null;
    }
    try {
      return await bot.api.editMessageText(chatId, messageId, text, {
        ...options,
        parse_mode: undefined,
      });
    } catch (err2) {
      if (
        err2.description?.includes("user is deactivated") ||
        err2.description?.includes("bot was blocked by the user") ||
        err2.error_code === 403
      ) {
        return null;
      }
      if (err2.description?.includes("there is no text in the message to edit")) {
        await bot.api.deleteMessage(chatId, messageId).catch(() => {});
      }
      return await safeSendMessage(chatId, text, options);
    }
  }
}

// ==========================================
// TELEGRAM ADAPTER (CONN)
// ==========================================
const conn = {
  isTelegram: true,
  bot,
  user: {
    id: "",
    jid: "",
    name: global.botName || "Jelita OTP Bot",
  },

  // Kirim pesan umum (teks / foto)
  async sendMessage(chatId, content = {}, options = {}) {
    const targetChat = typeof chatId === "object" ? chatId?.chat || chatId?.id : chatId;
    const isCb = options?.quoted?.isCallback;
    const prevMsgId = options?.quoted?.message_id;

    // 1. Pesan Gambar / QRIS
    if (content.image) {
      let photoSource;
      if (typeof content.image === "string") {
        photoSource = fs.existsSync(content.image) ? new InputFile(content.image) : content.image;
      } else if (content.image?.url) {
        photoSource = fs.existsSync(content.image.url) ? new InputFile(content.image.url) : content.image.url;
      } else if (Buffer.isBuffer(content.image)) {
        photoSource = new InputFile(content.image);
      }

      if (photoSource) {
        let inline_keyboard = [];
        if (content.buttons && Array.isArray(content.buttons)) {
          for (const b of content.buttons) {
            const btn = parseInteractiveButton(b);
            if (btn) inline_keyboard.push([btn]);
          }
        }
        if (inline_keyboard.length === 0) {
          inline_keyboard = [[{ text: "🔙 Kembali ke Menu", callback_data: ".menu" }]];
        }
        const caption = content.caption || "";
        const photoOptions = {
          caption,
          reply_markup: { inline_keyboard },
          parse_mode: "Markdown",
        };

        // Jika berasal dari tombol, hapus pesan teks menu lama agar tidak bertumpuk
        if (isCb && prevMsgId) {
          await bot.api.deleteMessage(targetChat, prevMsgId).catch(() => {});
        }

        try {
          return await bot.api.sendPhoto(targetChat, photoSource, photoOptions);
        } catch {
          delete photoOptions.parse_mode;
          return await bot.api.sendPhoto(targetChat, photoSource, photoOptions);
        }
      }
    }

    // 2. Pesan Teks
    if (typeof content.text === "string" || content.caption) {
      let text = content.text || content.caption;
      if (content.footer) text += `\n\n_${content.footer}_`;

      let reply_markup;
      if (content.buttons && Array.isArray(content.buttons)) {
        const inline_keyboard = [];
        for (const b of content.buttons) {
          const btn = parseInteractiveButton(b);
          if (btn) inline_keyboard.push([btn]);
        }
        if (inline_keyboard.length > 0) reply_markup = { inline_keyboard };
      }

      if (isCb && prevMsgId) {
        return await safeEditMessage(targetChat, prevMsgId, text, { reply_markup });
      }

      return await safeSendMessage(targetChat, text, {
        reply_markup,
        ...(prevMsgId && !isCb ? { reply_parameters: { message_id: prevMsgId } } : {}),
      });
    }

    // Direct string
    if (typeof content === "string") {
      if (isCb && prevMsgId) {
        return await safeEditMessage(targetChat, prevMsgId, content);
      }
      return await safeSendMessage(targetChat, content);
    }
  },

  // Reply shortcut
  async reply(chatId, text, quoted = null) {
    return await this.sendMessage(chatId, { text }, { quoted });
  },

  // Send interactive buttons (in-place update + auto back button)
  async sendInteractive(chatId, { text, footer = global.otp_footer, buttons = [], image = null }, quoted = null) {
    const targetChat = typeof chatId === "object" ? chatId?.chat || chatId?.id : chatId;
    let fullText = text;
    if (footer) fullText += `\n\n_${footer}_`;

    const inline_keyboard = [];
    for (const b of buttons) {
      const btn = parseInteractiveButton(b);
      if (btn) inline_keyboard.push([btn]);
    }

    // Cek apakah tombol kembali sudah ada
    const hasBack = inline_keyboard.some((row) =>
      row.some(
        (btn) =>
          btn.callback_data === ".menu" ||
          btn.callback_data === ".layanan" ||
          (btn.text && btn.text.toLowerCase().includes("kembali"))
      )
    );

    // Cek apakah ini menu utama
    const isMainMenu = buttons.some((b) => {
      try {
        const p = typeof b.buttonParamsJson === "string" ? JSON.parse(b.buttonParamsJson) : (b.buttonParamsJson || {});
        return p.id === ".otpviawa" || p.id === ".otpviasms" || p.id === ".buyotpsms";
      } catch {
        return false;
      }
    });

    // Jika ini sub-menu dan belum ada tombol kembali, tambahkan tombol "🔙 Kembali ke Menu"
    if (!isMainMenu && !hasBack) {
      inline_keyboard.push([{ text: "🔙 Kembali ke Menu", callback_data: ".menu" }]);
    }

    const reply_markup = inline_keyboard.length > 0 ? { inline_keyboard } : undefined;
    const isCb = quoted?.isCallback;
    const msgId = quoted?.message_id;

    // Jika ada gambar (misal menu pakai foto jelita.jpg)
    if (image) {
      const imgPath = typeof image === "string" ? image : null;
      if (!imgPath || fs.existsSync(imgPath)) {
        let photoSource = typeof image === "string" && fs.existsSync(image) ? new InputFile(image) : image;
        const photoOptions = {
          caption: fullText,
          reply_markup,
          parse_mode: "Markdown",
        };

        if (isCb && msgId) {
          await bot.api.deleteMessage(targetChat, msgId).catch(() => {});
        }

        try {
          return await bot.api.sendPhoto(targetChat, photoSource, photoOptions);
        } catch {
          delete photoOptions.parse_mode;
          return await bot.api.sendPhoto(targetChat, photoSource, photoOptions);
        }
      }
    }

    // IN-PLACE EDIT: Edit pesan yang lama agar tidak nyepam chat!
    if (isCb && msgId) {
      return await safeEditMessage(targetChat, msgId, fullText, { reply_markup });
    }

    return await safeSendMessage(targetChat, fullText, {
      reply_markup,
      ...(msgId && !isCb ? { reply_parameters: { message_id: msgId } } : {}),
    });
  },

  // Send Native List (in-place grid menu + auto back button)
  async sendNativeList(chatId, { text, footer = global.otp_footer, buttonText = "📱 Pilih Layanan", backTarget: customBackTarget, sections = [] }, quoted = null) {
    const targetChat = typeof chatId === "object" ? chatId?.chat || chatId?.id : chatId;
    let fullText = text;
    if (footer) fullText += `\n\n_${footer}_`;

    const inline_keyboard = [];
    for (const section of sections) {
      const rows = section.rows || [];
      // Susun 2 tombol per baris agar rapi dan mudah ditekan di layar HP
      for (let i = 0; i < rows.length; i += 2) {
        const rowPair = [];
        const r1 = rows[i];
        if (r1) {
          rowPair.push({
            text: r1.title || "Pilih",
            callback_data: String(r1.id || r1.rowId || ".menu").slice(0, 64),
          });
        }
        const r2 = rows[i + 1];
        if (r2) {
          rowPair.push({
            text: r2.title || "Pilih",
            callback_data: String(r2.id || r2.rowId || ".menu").slice(0, 64),
          });
        }
        if (rowPair.length > 0) inline_keyboard.push(rowPair);
      }
    }

    // Sesuaikan target tombol kembali sesuai hierarki menu
    let backTarget = customBackTarget;
    if (!backTarget) {
      const isFromMenu = Boolean(
        (quoted?.text && quoted.text.toLowerCase().includes("menu")) ||
        (quoted?.cleanText && quoted.cleanText.toLowerCase().includes("menu"))
      );
      const sectionTitle = (sections[0]?.title || "").toLowerCase();
      if (sectionTitle.includes("server 1") || sectionTitle.includes("server 2") || sectionTitle.includes("wa")) {
        backTarget = isFromMenu ? ".otpviawa menu" : ".otpviawa";
      } else if (sectionTitle.includes("sms")) {
        backTarget = isFromMenu ? ".menu" : ".layanan";
      } else {
        backTarget = isFromMenu ? ".menu" : ".layanan";
      }
    }
    inline_keyboard.push([{ text: "🔙 Kembali", callback_data: backTarget }]);

    const reply_markup = inline_keyboard.length > 0 ? { inline_keyboard } : undefined;
    const isCb = quoted?.isCallback;
    const msgId = quoted?.message_id;

    // IN-PLACE EDIT: Edit pesan list langsung tanpa nyepam
    if (isCb && msgId) {
      return await safeEditMessage(targetChat, msgId, fullText, { reply_markup });
    }

    return await safeSendMessage(targetChat, fullText, {
      reply_markup,
      ...(msgId && !isCb ? { reply_parameters: { message_id: msgId } } : {}),
    });
  },

  async relayMessage(chatId, message, options = {}) {
    return true;
  },
};

// Parser tombol interactive WhatsApp -> Telegram Inline Button
function parseInteractiveButton(b) {
  let params = {};
  try {
    params = typeof b.buttonParamsJson === "string" ? JSON.parse(b.buttonParamsJson) : (b.buttonParamsJson || {});
  } catch {
    params = {};
  }

  // 1. Copy Button (Telegram Bot API 7.0+ copy_text)
  if (b.name === "cta_copy" || params.copy_code) {
    return {
      text: params.display_text || `📋 Salin: ${params.copy_code}`,
      copy_text: {
        text: String(params.copy_code),
      },
    };
  }

  // 2. URL Button
  if (b.name === "cta_url" || params.url) {
    return {
      text: params.display_text || params.title || "Buka Link",
      url: params.url,
    };
  }

  // 3. Quick Reply / Callback Button
  const cmd = params.id || params.rowId || b.id || ".menu";
  return {
    text: params.display_text || params.title || "Pilih",
    callback_data: String(cmd).slice(0, 64),
  };
}

// ==========================================
// PLUGIN LOADER
// ==========================================
async function loadPlugins() {
  const pluginDir = path.join(process.cwd(), "plugins");
  if (!fs.existsSync(pluginDir)) return;

  const files = fs.readdirSync(pluginDir).filter((f) => f.endsWith(".js") && !f.startsWith("_"));
  for (const file of files) {
    try {
      const modulePath = `file://${path.join(pluginDir, file)}?update=${Date.now()}`;
      const mod = await import(modulePath);
      const handler = mod.default || mod.handler;
      if (typeof handler === "function") {
        plugins.set(file, handler);
      }
    } catch (err) {
      console.error(chalk.redBright(`[LOAD ERROR] ${file}:`), err.message);
    }
  }
  console.log(chalk.greenBright(`✓ Berhasil memuat ${plugins.size} plugin bot.`));
}

// ==========================================
// MESSAGE DISPATCHER
// ==========================================
async function dispatchMessage(m, text) {
  const cleanText = (text || "").trim();
  if (!cleanText) return;

  const prefixMatch = cleanText.match(/^[./#!]/);
  const usedPrefix = prefixMatch ? prefixMatch[0] : "";
  const noPrefixText = usedPrefix ? cleanText.slice(usedPrefix.length) : cleanText;
  const parts = noPrefixText.trim().split(/\s+/);
  let command = (parts[0] || "").toLowerCase();
  const args = parts.slice(1);
  let paramText = args.join(" ");

  // Jika user sedang menunggu input nominal kustom deposit
  if (global.__waitingDepositInput?.has(m.sender) && !cleanText.startsWith("/") && !cleanText.startsWith(".")) {
    const rawNumber = cleanText.replace(/[^0-9]/g, "");
    if (rawNumber && !isNaN(parseInt(rawNumber, 10))) {
      global.__waitingDepositInput.delete(m.sender);
      command = "deposit";
      paramText = rawNumber;
      args.length = 0;
      args.push(rawNumber);
    }
  }

  // Normalisasi command dari ReplyKeyboardMarkup & teks
  if (command === "start" || cleanText === "/start") {
    await bot.api.sendMessage(m.chat, "✨ Keyboard pintasan aktif di bawah input chat.", {
      reply_markup: replyKeyboard,
    }).catch(() => {});
    command = "menu";
    paramText = "";
    args.length = 0;
  } else if (/^(\/)?(layanan|📱\s*layanan)$/i.test(cleanText) || command === "layanan") {
    await conn.sendInteractive(
      m.chat,
      {
        text: "✦ *PILIHAN LAYANAN OTP* ✦\n\nSilakan pilih jalur verifikasi OTP yang ingin kamu gunakan:",
        footer: global.otp_footer,
        buttons: [
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "📱 OTP via WA",
              id: ".otpviawa",
            }),
          },
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "📨 OTP via SMS",
              id: ".buyotpsms",
            }),
          },
        ],
      },
      m
    );
    return true;
  } else if (/^(💳\s*deposit|deposit|bayar|qris)$/i.test(cleanText)) {
    command = "deposit";
    paramText = "";
    args.length = 0;
  } else if (/^(📜\s*riwayat|riwayat|history)$/i.test(cleanText)) {
    command = "riwayat";
    paramText = "";
    args.length = 0;
  } else if (/^(👤\s*profil|profil|profile|me)$/i.test(cleanText)) {
    command = "profile";
    paramText = "";
    args.length = 0;
  } else if (/^(❓\s*bantuan|bantuan|cs|support)$/i.test(cleanText)) {
    command = "bantuan";
    paramText = "";
    args.length = 0;
  }

  let handled = false;

  for (const [fileName, handler] of plugins.entries()) {
    let match = false;

    if (handler.command instanceof RegExp) {
      match = handler.command.test(command);
    } else if (Array.isArray(handler.command)) {
      match = handler.command.includes(command);
    } else if (typeof handler.command === "string") {
      match = handler.command.toLowerCase() === command;
    }

    if (match) {
      try {
        await handler(m, {
          conn,
          text: paramText,
          args,
          usedPrefix: usedPrefix || ".",
          command,
        });
        handled = true;
      } catch (err) {
        console.error(chalk.redBright(`[EXEC ERROR ${fileName}]:`), err?.message || err);
        await conn.reply(m.chat, `❌ Terjadi kesalahan: ${err.message || err}`, m).catch(() => {});
      }
      break;
    }
  }

  return handled;
}

// ==========================================
// EVENT HANDLERS
// ==========================================
bot.on("message:text", async (ctx) => {
  const m = {
    message_id: ctx.message.message_id,
    chat: String(ctx.chat.id),
    sender: String(ctx.from.id),
    pushName: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") || ctx.from.username || "User",
    isGroup: ctx.chat.type === "group" || ctx.chat.type === "supergroup",
    text: ctx.message.text,
    isCallback: false,
    reply: (text) => conn.reply(ctx.chat.id, text, m),
  };

  await dispatchMessage(m, ctx.message.text);
});

// Listener Callback Query dari Inline Button (Quick Reply & Native List)
bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery().catch(() => {});

  const m = {
    message_id: ctx.callbackQuery.message?.message_id,
    callbackQueryId: ctx.callbackQuery.id,
    chat: String(ctx.chat?.id || ctx.callbackQuery.message?.chat?.id),
    sender: String(ctx.from.id),
    pushName: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") || ctx.from.username || "User",
    isGroup: ctx.chat?.type === "group" || ctx.chat?.type === "supergroup",
    text: data,
    isCallback: true,
    reply: (text) => conn.reply(m.chat, text, m),
  };

  await dispatchMessage(m, data);
});

// ==========================================
// STARTUP
// ==========================================
async function startBot() {
  await loadPlugins();

  const botInfo = await bot.api.getMe();
  conn.user.id = String(botInfo.id);
  conn.user.name = botInfo.first_name;

  console.log(chalk.cyanBright("============================================"));
  console.log(chalk.greenBright(`🤖 ${botInfo.first_name} (@${botInfo.username}) AKTIF!`));
  console.log(chalk.yellowBright(`📌 In-place Menu & Navigation Ready!`));
  console.log(chalk.cyanBright("============================================"));

  const port = process.env.PORT || 3000;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", bot: botInfo.username || "active" }));
  });
  server.listen(port, () => {
    console.log(chalk.greenBright(`🌐 Web server aktif di port ${port} (Render ready)`));
  });

  bot.start({
    onStart: () => {
      console.log(chalk.green("Polling Telegram dimulai..."));
    },
  });
}

// Global error handler Grammy agar bot tidak pernah stop jika ada user deactivated / blocked / connection error
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(
    chalk.redBright(`[BOT ERROR] Update ${ctx?.update?.update_id || "-"}:`),
    err.error?.description || err.error?.message || err.message || err,
  );
});

process.on("unhandledRejection", (reason) => {
  console.warn(chalk.yellowBright("[UNHANDLED REJECTION]:"), reason?.description || reason?.message || reason);
});

process.on("uncaughtException", (err) => {
  console.error(chalk.redBright("[UNCAUGHT EXCEPTION]:"), err?.description || err?.message || err);
});

startBot().catch((err) => {
  console.error(chalk.redBright("[FATAL ERROR]:"), err);
});
