// ==========================================
// OTP ENGINE (SERVER 1 + SERVER 2 + SMS)
// ==========================================
import OTP_AXIOS from "axios";
import OTP_PATH from "path";
import OTP_FS from "fs";
import "../config.js";

// CONFIG GETTERS (mengambil dari global config.js)
export const getWahubBase = () => (global.wahub?.base || process.env.WAHUB_BASE || "https://dehuyzotp.shop/api").replace(/\/$/, "");
export const getWahubKey = () => global.wahub?.key || process.env.WAHUB_KEY || "wh_1ce1fe8448997dfb64730a666318b883c6712e2d6b63a147347b89ffa86b4386";

export const getInstanBase = () => (global.otpinstan?.base || process.env.OTPINSTAN_BASE || "https://otpinstan.com/api/reseller").replace(/\/$/, "");
export const getInstanKey = () => global.otpinstan?.key || process.env.OTPINSTAN_KEY || "otpk_c28d064dae48ebeb54f15a28c15580402074ad6674c8ab4a";

export const getUnicornBase = () => (global.unicorn?.base || process.env.UNICORN_BASE || "https://engineunicorn.cloud/v1").replace(/\/$/, "");
export const getUnicornKey = () => global.unicorn?.key || process.env.UNICORN_KEY || "sk_ghuwQpMsu_iIGcYXoELDcVkxTUJQIO7s";

export const getOtpFooter = () => global.otp_footer || process.env.OTP_FOOTER || "";

export const getWaMap = () => global.otp_wa_map || {};
export const getSmsMap = () => global.otp_sms_map || {};

export const getWaServicePrice = (serviceName) => {
  if (!serviceName) return 1500;
  const raw = String(serviceName).toLowerCase().trim();
  const prices = global.otp_wa_prices || {};

  if (prices[raw] !== undefined) return prices[raw];

  const compact = raw.replace(/[^a-z0-9]/g, "");
  for (const [k, p] of Object.entries(prices)) {
    const compactKey = k.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    if (compact === compactKey) return p;
  }

  for (const [k, p] of Object.entries(prices)) {
    const compactKey = k.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    if (compact.includes(compactKey) || compactKey.includes(compact)) return p;
  }

  return 1500;
};

export const getWa2ServicePrice = (serviceName) => {
  if (!serviceName) return null;
  const raw = String(serviceName).toLowerCase().trim();
  const prices = global.otp_wa2_prices || {};

  if (prices[raw] !== undefined) return prices[raw];

  const compact = raw.replace(/[^a-z0-9]/g, "");
  for (const [k, p] of Object.entries(prices)) {
    const compactKey = k.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    if (compact === compactKey) return p;
  }

  return null;
};

export const getSmsServicePrice = (serviceName) => {
  if (!serviceName) return 1500;
  const raw = String(serviceName).toLowerCase().trim();
  const prices = global.otp_sms_prices || {};

  if (prices[raw] !== undefined) return prices[raw];

  const compact = raw.replace(/[^a-z0-9]/g, "");
  for (const [k, p] of Object.entries(prices)) {
    const compactKey = k.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    if (compact === compactKey) return p;
  }

  for (const [k, p] of Object.entries(prices)) {
    const compactKey = k.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    if (compact.includes(compactKey) || compactKey.includes(compact)) return p;
  }

  return 1500;
};

export const OTP_USERS_DIR = OTP_PATH.join(process.cwd(), "database", "otp-users");
if (!OTP_FS.existsSync(OTP_USERS_DIR)) {
  OTP_FS.mkdirSync(OTP_USERS_DIR, { recursive: true });
}

export const OTP_STATE =
  global.__lilyOtpState ||
  (global.__lilyOtpState = {
    active: new Map(),
    messages: new Map(),
    sent: new Set(),
    processedMsgs: new Set(),
    userCooldown: new Map(),
    serviceCache: { data: null, expires: 0 },
    smsServiceCache: { data: null, expires: 0 },
    unicornServiceCache: { data: null, expires: 0 },
  });

export const otpNum = (v = "") => String(v).replace(/\D/g, "").split(":")[0];
export const otpHeadersWa = () => ({
  Authorization: `Bearer ${getWahubKey()}`,
  "Content-Type": "application/json",
});
export const otpHeadersSms = () => ({ "X-Api-Key": getInstanKey() });
export const otpHeadersUnicorn = (idempotencyKey = null) => {
  const headers = {
    Authorization: `Bearer ${getUnicornKey()}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  return headers;
};

export const otpSleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const otpNormalize = (v = "") =>
  String(v)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

export const otpFormatPhone = (v = "-") => {
  let n = String(v).replace(/\D/g, "");
  if (n.startsWith("62")) n = n.slice(2);
  else if (n.startsWith("0")) n = n.slice(1);
  return n || "-";
};

export const otpUserPath = (n) => OTP_PATH.join(OTP_USERS_DIR, `${otpNum(n)}.json`);
export const otpGetUser = (n) => {
  const key = otpNum(n);
  let u;
  try {
    u = OTP_FS.existsSync(otpUserPath(key))
      ? JSON.parse(OTP_FS.readFileSync(otpUserPath(key), "utf8"))
      : null;
  } catch {
    u = null;
  }
  if (!u) {
    u = {
      number: key,
      name: "",
      orders: [],
      deposits: [],
      saldo: 0,
      totalDeposit: 0,
      totalOrders: 0,
      registeredAt: Date.now(),
    };
  } else {
    if (u.saldo === undefined) {
      u.saldo = Number(u.totalDeposit || 0);
    }
  }
  return u;
};

export const otpSaveUser = (n, u) => {
  try {
    OTP_FS.writeFileSync(otpUserPath(n), JSON.stringify(u, null, 2));
  } catch (e) {
    console.error("[OTP DB]", e.message);
  }
};

export const otpAddOrder = (n, info) => {
  const u = otpGetUser(n);
  const o = {
    chatId: `${otpNum(n)}_${info.orderId}`,
    orderId: info.orderId,
    platform: info.platform,
    phone: info.phone || "-",
    token: info.token || null,
    apiType: info.apiType,
    serviceId: info.serviceId || null,
    platformId: info.platformId || null,
    allowRetry: info.allowRetry !== false,
    expiresAt: info.expiresAt || null,
    price: Number(info.price || 0),
    cost: Number(info.cost || info.price || 0),
    refunded: Boolean(info.refunded),
    status: "active",
    createdAt: Date.now(),
    completedAt: null,
  };
  u.orders.push(o);
  u.totalOrders = u.orders.length;
  otpSaveUser(n, u);
  return o;
};

export const otpUpdate = (n, id, status, fields = {}) => {
  const u = otpGetUser(n);
  const o = u.orders.find((x) => String(x.orderId) === String(id));
  if (o) {
    Object.assign(o, fields, { status });
    if (status !== "active") o.completedAt = Date.now();
    otpSaveUser(n, u);
  }
  return o;
};

export const otpApiError = (e, provider = "API") => {
  const s = e?.response?.status,
    d = e?.response?.data,
    m =
      d?.error?.message ||
      d?.message ||
      d?.error ||
      d?.detail ||
      e?.message ||
      "Unknown error";

  if (provider === "WAHub") {
    if (s === 401) return "API Key Server 1 tidak valid atau expired.";
    if (s === 403) return "Akun Server 1 diblokir.";
    if (s === 408) return "Waktu tunggu OTP Server 1 habis.";
    if (s === 429) return "Batas pesanan tercapai. Coba sebentar lagi.";
    if (s === 503) return "Stok nomor Server 1 sedang habis.";
  }

  if (provider === "EngineUnicorn" || provider === "Unicorn") {
    if (s === 401) return "API Key Server 2 tidak valid.";
    if (s === 402) return "Saldo akun Server 2 tidak cukup.";
    if (s === 409) return m || "Stok nomor Server 2 sedang kosong.";
    if (s === 422) return `Permintaan tidak valid: ${m}`;
    if (s === 429) return "Terlalu banyak permintaan. Tunggu sebentar.";
  }

  return s ? `${m} (HTTP ${s})` : m;
};

// ===================== HELPER INTERACTIVE & LIST BUTTON =====================
export const sendInteractive = async (conn, chatJid, { text, footer = getOtpFooter(), buttons = [], image = null }, quoted = null) => {
  if (conn?.sendInteractive) {
    return await conn.sendInteractive(chatJid, { text, footer, buttons, image }, quoted);
  }
  return await conn.sendMessage(
    chatJid,
    { text: footer ? `${text}\n\n_${footer}_` : text },
    { quoted }
  );
};

export const sendNativeList = async (conn, chatJid, options = {}, quoted = null) => {
  if (conn?.sendNativeList) {
    return await conn.sendNativeList(chatJid, options, quoted);
  }
  return await conn.sendMessage(
    chatJid,
    { text: options.footer ? `${options.text}\n\n_${options.footer}_` : options.text },
    { quoted }
  );
};

// ===================== DAFTAR LAYANAN SERVER 1 =====================
export const otpServiceList = async (force = false) => {
  const now = Date.now();
  if (
    !force &&
    OTP_STATE.serviceCache.data &&
    OTP_STATE.serviceCache.expires > now
  )
    return OTP_STATE.serviceCache.data;
  const r = await OTP_AXIOS.get(`${getWahubBase()}/services`, {
    headers: otpHeadersWa(),
    timeout: 15000,
  });
  const list = Array.isArray(r.data)
    ? r.data
    : Array.isArray(r.data?.services)
      ? r.data.services
      : [];
  if (!list.length)
    throw new Error("Server 1 tidak mengembalikan daftar layanan.");
  OTP_STATE.serviceCache = { data: list, expires: now + 30000 };
  return list;
};

// ===================== DAFTAR LAYANAN SMS =====================
export const otpServiceListSms = async (force = false) => {
  const now = Date.now();
  if (
    !force &&
    OTP_STATE.smsServiceCache?.data &&
    OTP_STATE.smsServiceCache.expires > now
  ) {
    return OTP_STATE.smsServiceCache.data;
  }

  let list = [];
  try {
    const [rS1, rReseller] = await Promise.allSettled([
      OTP_AXIOS.get(`${getInstanBase()}/s1/services.php`, {
        params: { country_id: 7 },
        headers: otpHeadersSms(),
        timeout: 15000,
      }),
      OTP_AXIOS.get(`${getInstanBase()}/services.php`, {
        headers: otpHeadersSms(),
        timeout: 15000,
      }),
    ]);

    const platformStockMap = new Map();
    if (rS1.status === "fulfilled") {
      const d = rS1.value.data;
      const rawList = Array.isArray(d)
        ? d
        : Array.isArray(d?.data)
          ? d.data
          : Array.isArray(d?.services)
            ? d.services
            : [];
      for (const item of rawList) {
        const pid = Number(item.platform_id);
        const curStock = Number(item.stock || 0);
        const existing = platformStockMap.get(pid);
        if (!existing || curStock > Number(existing.stock || 0)) {
          platformStockMap.set(pid, item);
        }
      }
    }

    let waStock = 0;
    let tgStock = 0;
    if (rReseller.status === "fulfilled") {
      const d = rReseller.value.data;
      const servicesList = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
      const waItem = servicesList.find((s) => Number(s.country) === 6 && String(s.service).toLowerCase() === "wa");
      const tgItem = servicesList.find((s) => Number(s.country) === 6 && String(s.service).toLowerCase() === "tg");
      waStock = waItem?.count || 0;
      tgStock = tgItem?.count || 0;
    }

    const seen = new Set();
    const seenPid = new Set();
    const smsMap = getSmsMap();
    for (const [key, pid] of Object.entries(smsMap)) {
      const cleanKey = key.trim();
      const strPid = String(pid);
      if (seen.has(cleanKey.toLowerCase()) || seenPid.has(strPid)) continue;
      seen.add(cleanKey.toLowerCase());
      seenPid.add(strPid);

      let stock = 0;
      if (strPid === "reseller_wa" || strPid === "s9_76") {
        stock = waStock;
      } else if (strPid === "reseller_tg" || strPid === "s9_65") {
        stock = tgStock;
      } else {
        const apiItem = platformStockMap.get(Number(pid));
        stock = apiItem ? Number(apiItem.stock || 0) : 0;
      }

      list.push({
        name: cleanKey,
        platform_id: strPid,
        stock: stock,
      });
    }
  } catch (err) {
    console.warn("[OTP SMS SERVICE LIST ERROR]", err.message);
  }

  if (!list.length) {
    const seen = new Set();
    const seenPid = new Set();
    const smsMap = getSmsMap();
    for (const [name, pid] of Object.entries(smsMap)) {
      const strPid = String(pid);
      if (seen.has(name.toLowerCase()) || seenPid.has(strPid)) continue;
      seen.add(name.toLowerCase());
      seenPid.add(strPid);
      list.push({
        name,
        platform_id: strPid,
        stock: "Ready",
      });
    }
  }

  list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  if (!OTP_STATE.smsServiceCache) OTP_STATE.smsServiceCache = {};
  OTP_STATE.smsServiceCache = { data: list, expires: now + 30000 };
  return list;
};

// ===================== DAFTAR LAYANAN SERVER 2 =====================
export const otpServiceListUnicorn = async (force = false) => {
  const now = Date.now();
  if (
    !force &&
    OTP_STATE.unicornServiceCache?.data &&
    OTP_STATE.unicornServiceCache.expires > now
  ) {
    return OTP_STATE.unicornServiceCache.data;
  }

  const r = await OTP_AXIOS.get(`${getUnicornBase()}/services`, {
    headers: otpHeadersUnicorn(),
    timeout: 15000,
  });

  const rawList = Array.isArray(r.data?.data)
    ? r.data.data
    : Array.isArray(r.data)
      ? r.data
      : [];

  if (!rawList.length) {
    throw new Error("Server 2 tidak mengembalikan daftar layanan.");
  }

  // Filter hanya layanan yang ada di daftar owner Server 2 (yang tidak ada di list dihapus)
  const list = rawList
    .map((s) => ({
      ...s,
      name: String(s.name || "").trim(),
    }))
    .filter((s) => getWa2ServicePrice(s.name) !== null);

  if (!OTP_STATE.unicornServiceCache) OTP_STATE.unicornServiceCache = {};
  OTP_STATE.unicornServiceCache = { data: list, expires: now + 30000 };
  return list;
};

export const otpServiceListCatalog = async (force = false) => {
  const liveList = await otpServiceList(force);
  const stockMap = new Map();
  for (const s of liveList) {
    stockMap.set(Number(s.id), Number(s.stock || 0));
  }
  const ovoStock = stockMap.get(153) || 0;

  const catalog = global.otp_wa_catalog || [];
  return catalog.map((item) => {
    const stock = Number(item.id) === 153 ? ovoStock : (stockMap.get(Number(item.id)) ?? 0);
    return {
      id: item.id,
      name: item.name,
      realName: item.realName,
      price: item.price,
      stock,
    };
  });
};

export const otpResolveService = async (name) => {
  const req = otpNormalize(name);
  const compact = req.replace(/[^a-z0-9]/g, "");

  const catalog = global.otp_wa_catalog || [];
  const catItem = catalog.find((c) => {
    const cNorm = otpNormalize(c.name);
    const cCompact = cNorm.replace(/[^a-z0-9]/g, "");
    return (
      cNorm === req ||
      cCompact === compact ||
      cCompact.includes(compact) ||
      compact.includes(cCompact)
    );
  });

  if (catItem) {
    const liveList = await otpServiceList(false);
    const realService = liveList.find((x) => Number(x.id) === Number(catItem.id));
    const ovoStock = liveList.find((x) => Number(x.id) === 153)?.stock ?? 0;
    const stock = Number(catItem.id) === 153 ? ovoStock : (realService?.stock ?? 0);

    return {
      id: catItem.id,
      name: catItem.name,
      realName: catItem.realName,
      stock,
      price: catItem.price,
    };
  }

  const waMap = getWaMap();
  const configured = waMap[String(name).toLowerCase().trim()];
  let list = await otpServiceList(false);
  const match = (x) => {
    const n = otpNormalize(x?.name);
    const c = n.replace(/[^a-z0-9]/g, "");
    return (
      n === req ||
      c === compact ||
      (req === "shopee filter" && n.includes("shopee") && n.includes("filter"))
    );
  };
  let s =
    list.find(match) ||
    (configured != null
      ? list.find((x) => Number(x.id) === Number(configured))
      : null);
  if (!s) {
    list = await otpServiceList(true);
    s =
      list.find(match) ||
      (configured != null
        ? list.find((x) => Number(x.id) === Number(configured))
        : null);
  }
  if (!s)
    throw new Error(`Layanan "${name}" tidak ditemukan di Server 1.`);
  return s;
};

export const otpResolveServiceUnicorn = async (name) => {
  const req = otpNormalize(name);
  const compact = req.replace(/[^a-z0-9]/g, "");
  let list = await otpServiceListUnicorn(false);

  const match = (x) => {
    const n = otpNormalize(x?.name);
    const c = n.replace(/[^a-z0-9]/g, "");
    return (
      n === req ||
      c === compact ||
      n.includes(req) ||
      c.includes(compact) ||
      compact.includes(c) ||
      String(x.id) === String(name).trim()
    );
  };

  let s = list.find(match);
  if (!s) {
    list = await otpServiceListUnicorn(true);
    s = list.find(match);
  }
  if (!s) {
    throw new Error(`Layanan "${name}" tidak ditemukan di Server 2.`);
  }
  return s;
};

export const otpRememberMsg = (m, chatId, sent) => {
  if (sent?.key?.id)
    OTP_STATE.messages.set(`${otpNum(m.sender)}_${sent.key.id}`, chatId);
  const od = OTP_STATE.active.get(chatId);
  if (od && sent?.key) od.msgKey = sent.key;
};

export const otpResolve = (m, hint = null) => {
  const n = otpNum(m.sender);
  let cid = hint && String(hint).startsWith(`${n}_`) ? String(hint) : null;

  const btnId =
    m.msg?.selectedButtonId ||
    m.message?.buttonsResponseMessage?.selectedButtonId ||
    m.msg?.selectedId ||
    m.message?.templateButtonReplyMessage?.selectedId;

  const qid = btnId || m.msg?.contextInfo?.stanzaId || m.quoted?.id;
  if (!cid && qid) cid = OTP_STATE.messages.get(`${n}_${qid}`);
  if (!cid && m.text?.includes("_")) {
    const a = m.text.split(/\s+/).find((x) => x.includes("_"));
    if (a && otpNum(a.split("_")[0]) === n) cid = a;
  }
  let od = cid ? OTP_STATE.active.get(cid) : null;
  if (!od && cid) {
    const o = otpGetUser(n).orders.find(
      (x) => String(x.chatId) === String(cid) && (x.status === "active" || x.status === "completed"),
    );
    if (o) {
      od = { ...o, userNumber: n, isActive: o.status === "active", createdAt: o.createdAt };
      OTP_STATE.active.set(cid, od);
    }
  }
  if (!od) {
    const o = otpGetUser(n)
      .orders.slice()
      .reverse()
      .find((x) => x.status === "active");
    if (o) {
      cid = o.chatId;
      od = OTP_STATE.active.get(cid) || {
        ...o,
        userNumber: n,
        isActive: true,
        createdAt: o.createdAt,
      };
      OTP_STATE.active.set(cid, od);
    }
  }
  return od || null;
};

export const otpClean = (od) => {
  if (od.changeTimer) {
    clearTimeout(od.changeTimer);
    od.changeTimer = null;
  }
  if (od.cancelTimer) {
    clearTimeout(od.cancelTimer);
    od.cancelTimer = null;
  }
  OTP_STATE.active.delete(od.chatId);
  for (const [k, v] of OTP_STATE.messages)
    if (v === od.chatId) OTP_STATE.messages.delete(k);
};

export const otpCancel = async (od) => {
  if (od.changeTimer) {
    clearTimeout(od.changeTimer);
    od.changeTimer = null;
  }
  if (od.cancelTimer) {
    clearTimeout(od.cancelTimer);
    od.cancelTimer = null;
  }
  od.isActive = false;
  try {
    if (od.apiType === "wahub") {
      await OTP_AXIOS.post(
        `${getWahubBase()}/order/${encodeURIComponent(od.orderId)}`,
        { action: "cancel" },
        { headers: otpHeadersWa(), timeout: 10000 },
      );
    } else if (od.apiType === "unicorn") {
      await OTP_AXIOS.post(
        `${getUnicornBase()}/orders/${encodeURIComponent(od.orderId)}/cancel`,
        {},
        { headers: otpHeadersUnicorn(), timeout: 10000 },
      );
    } else if (od.apiType === "otpinstan_reseller") {
      const res = await OTP_AXIOS.post(
        `${getInstanBase()}/cancel.php`,
        new URLSearchParams({ order_id: String(od.orderId) }).toString(),
        {
          headers: {
            ...otpHeadersSms(),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          timeout: 10000,
        },
      );
      if (res.data && res.data.success === false) {
        throw new Error(res.data.message || res.data.error || "Gagal membatalkan order.");
      }
    } else if (od.apiType === "otpinstan_s9") {
      await OTP_AXIOS.post(
        `${getInstanBase()}/s9/cancel.php`,
        new URLSearchParams({ order_id: String(od.orderId) }).toString(),
        {
          headers: {
            ...otpHeadersSms(),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          timeout: 10000,
        },
      );
    } else {
      await OTP_AXIOS.post(
        `${getInstanBase()}/s1/cancel.php`,
        new URLSearchParams({ order_id: String(od.orderId) }).toString(),
        {
          headers: {
            ...otpHeadersSms(),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          timeout: 10000,
        },
      );
    }
    // Refund saldo jika order memiliki harga dan belum pernah di-refund
    if (od.price > 0 && !od.refunded && od.userNumber) {
      od.refunded = true;
      const u = otpGetUser(od.userNumber);
      u.saldo = (u.saldo || 0) + od.price;
      otpSaveUser(od.userNumber, u);
    }
    otpUpdate(od.userNumber, od.orderId, "cancelled", {
      refunded: Boolean(od.refunded),
      price: od.price || 0,
    });
    otpClean(od);
    return { ok: true };
  } catch (e) {
    od.isActive = true;
    return {
      ok: false,
      error: otpApiError(
        e,
        od.apiType === "wahub"
          ? "WAHub"
          : od.apiType === "unicorn"
            ? "EngineUnicorn"
            : "OTPINSTAN",
      ),
    };
  }
};

// ===================== OTP RECEIVED HANDLER =====================
export const otpDone = async (conn, m, od, code) => {
  if (od.changeTimer) {
    clearTimeout(od.changeTimer);
    od.changeTimer = null;
  }
  if (od.cancelTimer) {
    clearTimeout(od.cancelTimer);
    od.cancelTimer = null;
  }
  const key = `${od.chatId}_${code}`;
  if (OTP_STATE.sent.has(key)) return;
  OTP_STATE.sent.add(key);
  setTimeout(() => OTP_STATE.sent.delete(key), 60000);

  otpUpdate(od.userNumber, od.orderId, "completed");

  if (od.apiType === "wahub") {
    for (let i = 1; i <= 3; i++) {
      try {
        await OTP_AXIOS.post(
          `${getWahubBase()}/order/${encodeURIComponent(od.orderId)}`,
          { action: "done" },
          { headers: otpHeadersWa(), timeout: 10000 },
        );
        break;
      } catch {
        await otpSleep(i * 1000);
      }
    }
  }

  const cardText = [
    "✦ *OTP RECEIVED* ✦",
    "",
    `📱 *Layanan*: ${String(od.platform).toUpperCase()}`,
    `📞 *Nomor*: ${otpFormatPhone(od.phone)}`,
    `🔑 *Kode OTP*: *${code}*`,
    "",
    "Silakan salin kode OTP menggunakan tombol di bawah.",
  ].join("\n");

  const buyAgainCmd =
    od.apiType === "wahub"
      ? `.buyotpwa ${od.platform}`
      : od.apiType === "unicorn"
        ? `.buyotpwa2 ${od.platform}`
        : `.buyotpsms ${od.platform}`;

  const buttons = [
    {
      name: "cta_copy",
      buttonParamsJson: JSON.stringify({
        display_text: `📋 Salin: ${code}`,
        copy_code: String(code),
      }),
    },
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🛒 Beli Lagi",
        id: buyAgainCmd,
      }),
    },
  ];

  const sent = await sendInteractive(
    conn,
    m.chat,
    {
      text: cardText,
      footer: getOtpFooter(),
      buttons,
    },
    m,
  );

  otpRememberMsg(m, od.chatId, sent);

  await otpSleep(400);

  const targetQuote = od.originalMsg || m;
  await conn.sendMessage(
    m.chat,
    { text: `${code}` },
    { quoted: targetQuote },
  );
};

// ===================== POLLING SERVER 1 =====================
export const otpPollWa = async (conn, m, cid) => {
  const started = Date.now(),
    max = 20 * 60 * 1000;
  while (true) {
    const od = OTP_STATE.active.get(cid);
    if (!od?.isActive) break;
    const remain = od.expiresAt
      ? od.expiresAt - Date.now()
      : max - (Date.now() - started);
    if (remain <= 0 || Date.now() - started > max) {
      const r = await otpCancel(od);
      const uAfter = otpGetUser(od.userNumber);
      const refundInfo = od.price
        ? `\n💰 *Refund Saldo*: Rp ${Number(od.price).toLocaleString("id-ID")}\n💳 *Sisa Saldo*: Rp ${Number(uAfter.saldo || 0).toLocaleString("id-ID")}`
        : "";
      await sendInteractive(
        conn,
        m.chat,
        {
          text: r.ok
            ? `⏳ *WAKTU HABIS*\n\nPesanan telah otomatis dibatalkan dan saldo dikembalikan.${refundInfo}`
            : `⚠️ *WAKTU HABIS*\n\nGagal memproses pembatalan server.`,
          footer: getOtpFooter(),
          buttons: [
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "🛒 Beli Lagi",
                id: `.buyotpwa ${od.platform}`,
              }),
            },
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "🔙 Menu Utama",
                id: ".otpviawa",
              }),
            },
          ],
        },
        m,
      );
      break;
    }
    try {
      const timeout = Math.min(60, Math.max(10, Math.floor(remain / 1000)));
      const r = await OTP_AXIOS.get(
        `${getWahubBase()}/sms/${encodeURIComponent(od.token)}?timeout=${timeout}`,
        { headers: otpHeadersWa(), timeout: (timeout + 10) * 1000 },
      );
      if (r.data?.state === "success" && r.data?.otp) {
        await otpDone(conn, m, od, r.data.otp);
        break;
      }
    } catch (e) {
      if ([404, 410].includes(e.response?.status)) {
        od.isActive = false;
        if (od.price && !od.refunded && od.userNumber) {
          od.refunded = true;
          const u = otpGetUser(od.userNumber);
          u.saldo = (u.saldo || 0) + od.price;
          otpSaveUser(od.userNumber, u);
        }
        otpUpdate(od.userNumber, od.orderId, "expired", { refunded: Boolean(od.refunded), price: od.price || 0 });
        otpClean(od);
        const uCur = otpGetUser(od.userNumber);
        const refundNote = od.price
          ? `\n💰 Saldo Rp ${Number(od.price).toLocaleString("id-ID")} telah dikembalikan.\n💳 Sisa Saldo: Rp ${Number(uCur.saldo || 0).toLocaleString("id-ID")}`
          : "";
        await conn.sendMessage(
          m.chat,
          { text: `❌ Pesanan sudah tidak aktif atau kedaluwarsa.${refundNote}` },
          { quoted: m },
        );
        break;
      }
      await otpSleep(e.response?.status === 429 ? 5000 : 1500);
    }
  }
};

// ===================== POLLING SERVER 2 =====================
export const otpPollUnicorn = async (conn, m, cid) => {
  const started = Date.now();
  const max = 20 * 60 * 1000;

  while (true) {
    const od = OTP_STATE.active.get(cid);
    if (!od?.isActive) break;

    const remain = od.expiresAt
      ? od.expiresAt - Date.now()
      : max - (Date.now() - started);

    if (remain <= 0 || Date.now() - started > max) {
      const r = await otpCancel(od);
      await sendInteractive(
        conn,
        m.chat,
        {
          text: r.ok
            ? `⏳ *WAKTU HABIS*\n\nPesanan dibatalkan otomatis dan saldo dikembalikan.`
            : `⚠️ *WAKTU HABIS*\n\nGagal membatalkan pesanan di server.`,
          footer: getOtpFooter(),
          buttons: [
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "🛒 Beli Lagi",
                id: `.buyotpwa2 ${od.platform}`,
              }),
            },
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "🔙 Menu Utama",
                id: ".otpviawa",
              }),
            },
          ],
        },
        m,
      );
      break;
    }

    try {
      const r = await OTP_AXIOS.get(
        `${getUnicornBase()}/orders/${encodeURIComponent(od.orderId)}`,
        {
          headers: otpHeadersUnicorn(),
          timeout: 15000,
        },
      );

      const d = r.data?.data || {};

      if (d.status === "completed" && d.otp) {
        await otpDone(conn, m, od, d.otp);
        break;
      }

      if (d.status === "cancelled") {
        od.isActive = false;
        if (od.price > 0 && !od.refunded && od.userNumber) {
          od.refunded = true;
          const u = otpGetUser(od.userNumber);
          u.saldo = (u.saldo || 0) + od.price;
          otpSaveUser(od.userNumber, u);
        }
        otpUpdate(od.userNumber, od.orderId, "cancelled", {
          refunded: Boolean(od.refunded),
          price: od.price || 0,
        });
        otpClean(od);
        await conn.sendMessage(
          m.chat,
          { text: `❌ Pesanan telah dibatalkan di server.\n💰 Saldo telah di-refund ke akunmu.` },
          { quoted: m },
        );
        break;
      }
    } catch (e) {
      if ([404, 410].includes(e.response?.status)) {
        od.isActive = false;
        if (od.price > 0 && !od.refunded && od.userNumber) {
          od.refunded = true;
          const u = otpGetUser(od.userNumber);
          u.saldo = (u.saldo || 0) + od.price;
          otpSaveUser(od.userNumber, u);
        }
        otpUpdate(od.userNumber, od.orderId, "expired", {
          refunded: Boolean(od.refunded),
          price: od.price || 0,
        });
        otpClean(od);
        await conn.sendMessage(
          m.chat,
          { text: `❌ Pesanan sudah tidak aktif atau kedaluwarsa.\n💰 Saldo telah di-refund ke akunmu.` },
          { quoted: m },
        );
        break;
      }
      await otpSleep(e.response?.status === 429 ? 5000 : 2000);
      continue;
    }

    await otpSleep(3500);
  }
};

// ===================== POLLING SMS =====================
export const otpPollSms = async (conn, m, cid) => {
  const started = Date.now(),
    max = 17 * 60 * 1000;
  while (true) {
    const od = OTP_STATE.active.get(cid);
    if (!od?.isActive) break;
    if (Date.now() - started >= max) {
      const r = await otpCancel(od);
      await sendInteractive(
        conn,
        m.chat,
        {
          text: r.ok
            ? `⏳ *WAKTU HABIS*\n\nPesanan dibatalkan otomatis dan saldo dikembalikan.`
            : `⚠️ *WAKTU HABIS*\n\nPembatalan provider gagal.`,
          footer: getOtpFooter(),
          buttons: [
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "🛒 Beli Lagi",
                id: `.buyotpsms ${od.platform}`,
              }),
            },
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "🔙 Menu Utama",
                id: ".otpviasms",
              }),
            },
          ],
        },
        m,
      );
      break;
    }
    try {
      const endpoint =
        od.apiType === "otpinstan_reseller"
          ? "/check.php"
          : od.apiType === "otpinstan_s9"
            ? "/s9/check.php"
            : "/s1/check.php";
      const r = await OTP_AXIOS.get(`${getInstanBase()}${endpoint}`, {
        params: { order_id: od.orderId },
        headers: otpHeadersSms(),
        timeout: 15000,
      });
      const d = r.data || {};
      if (d.success && d.status === "received" && d.otp) {
        await otpDone(conn, m, od, d.otp);
        break;
      }
      if (
        d.success &&
        ["cancelled", "expired", "finished"].includes(
          String(d.status).toLowerCase(),
        )
      ) {
        od.isActive = false;
        if (od.price > 0 && !od.refunded && od.userNumber) {
          od.refunded = true;
          const u = otpGetUser(od.userNumber);
          u.saldo = (u.saldo || 0) + od.price;
          otpSaveUser(od.userNumber, u);
        }
        otpUpdate(
          od.userNumber,
          od.orderId,
          String(d.status).toLowerCase() === "cancelled"
            ? "cancelled"
            : "expired",
          { refunded: Boolean(od.refunded), price: od.price || 0 }
        );
        otpClean(od);
        await conn.sendMessage(
          m.chat,
          { text: `❌ Pesanan telah berakhir di server.\n💰 Saldo telah di-refund ke akunmu.` },
          { quoted: m },
        );
        break;
      }
    } catch (e) {
      await otpSleep(e.response?.status === 429 ? 5000 : 1500);
      continue;
    }
    await otpSleep(5000);
  }
};

// ===================== LOGIKA BUY OTP WA (SERVER 1) =====================
export const otpBuyWa = async (conn, m, platform, amount = 1) => {
  amount = Number(amount);

  if (!Number.isInteger(amount) || amount < 1) {
    return conn.sendMessage(
      m.chat,
      { text: "❌ Jumlah harus berupa angka minimal 1." },
      { quoted: m },
    );
  }

  if (amount > 20) {
    return conn.sendMessage(
      m.chat,
      { text: "❌ Maksimal pembelian adalah 20 nomor sekaligus." },
      { quoted: m },
    );
  }

  let service;
  try {
    service = await otpResolveService(platform);
  } catch (e) {
    return conn.sendMessage(
      m.chat,
      { text: `❌ ${e.message}` },
      { quoted: m },
    );
  }

  const sid = Number(service.id);
  const stock = Number(service.stock);
  if (Number.isFinite(stock) && stock <= 0) {
    return conn.sendMessage(
      m.chat,
      { text: `❌ Stok ${service.name || platform} di Server 1 sedang habis.` },
      { quoted: m },
    );
  }

  const price = getWaServicePrice(service.name || platform);
  const totalPrice = price * amount;
  const n = otpNum(m.sender);
  const u = otpGetUser(n);
  const currentSaldo = Number(u.saldo || 0);

  if (currentSaldo < totalPrice) {
    return await sendInteractive(
      conn,
      m.chat,
      {
        text:
          `❌ *SALDO TIDAK MENCUKUPI*\n\n` +
          `📱 *Layanan*: ${String(service.name || platform).toUpperCase()}\n` +
          `💵 *Harga per nomor*: Rp ${price.toLocaleString("id-ID")}\n` +
          `🔢 *Jumlah*: ${amount} nomor\n` +
          `💰 *Total Biaya*: Rp ${totalPrice.toLocaleString("id-ID")}\n` +
          `💳 *Saldo Kamu*: Rp ${currentSaldo.toLocaleString("id-ID")}\n\n` +
          `Silakan lakukan deposit saldo terlebih dahulu untuk melanjutkan pemesanan.`,
        footer: getOtpFooter(),
        buttons: [
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
              display_text: "🔙 Kembali ke Layanan",
              id: ".buyotpwa",
            }),
          },
        ],
      },
      m,
    );
  }

  await conn.sendMessage(
    m.chat,
    {
      text: `⏳ Sedang mengalokasikan ${amount} nomor *${String(service.name || platform).toUpperCase()}*...`,
    },
    { quoted: m },
  );

  const createOrder = async () => {
    try {
      const r = await OTP_AXIOS.post(
        `${getWahubBase()}/rent`,
        { service_id: sid },
        {
          headers: otpHeadersWa(),
          timeout: 20000,
        },
      );

      const d = r.data || {};
      const oid = d.order_id ?? d.data?.order_id;
      const tok = d.token ?? d.data?.token;
      const phone =
        d.phone ??
        d.number ??
        d.data?.phone ??
        d.data?.number ??
        "-";

      if (oid == null || !tok) {
        throw new Error(
          d.message || d.error || "Respon server tidak valid.",
        );
      }

      const cid = `${n}_${oid}`;

      // Potong saldo pengguna sesuai harga layanan
      const userDb = otpGetUser(n);
      userDb.saldo = Math.max(0, (userDb.saldo || 0) - price);
      otpSaveUser(n, userDb);

      const od = {
        chatId: cid,
        orderId: oid,
        token: tok,
        phone,
        platform: service.name || platform,
        serviceId: sid,
        platformId: null,
        apiType: "wahub",
        userNumber: n,
        price,
        cost: price,
        refunded: false,
        createdAt: Date.now(),
        expiresAt: d.expires_at ? Number(d.expires_at) * 1000 : null,
        isActive: true,
        allowRetry:
          d.allow_retry !== false && service.allow_retry !== false,
        originalMsg: m,
      };

      otpAddOrder(n, od);
      OTP_STATE.active.set(cid, od);

      otpPollWa(conn, m, cid).catch(async (e) => {
        const current = OTP_STATE.active.get(cid);
        if (!current || !current.isActive) return;
        current.isActive = false;
        OTP_STATE.active.delete(cid);

        // Refund saldo jika order error dan belum pernah direfund
        if (current.price && !current.refunded && current.userNumber) {
          current.refunded = true;
          const userObj = otpGetUser(current.userNumber);
          userObj.saldo = (userObj.saldo || 0) + current.price;
          otpSaveUser(current.userNumber, userObj);
          otpUpdate(current.userNumber, current.orderId, "cancelled", { refunded: true, price: current.price });
        }

        await conn.sendMessage(
          m.chat,
          {
            text: `❌ *OTP ERROR*\n\n${otpApiError(e, "WAHub")}\n💰 Saldo telah di-refund ke akunmu.`,
          },
          { quoted: m },
        );
      });

      return { ok: true, order: od };
    } catch (e) {
      return { ok: false, error: e };
    }
  };

  const results = [];
  for (let i = 0; i < amount; i++) {
    const res = await createOrder();
    results.push(res);
    if (!res.ok) {
      const status = res.error?.response?.status;
      if ([401, 403, 503].includes(status)) break;
    }
    if (i < amount - 1) await otpSleep(1000);
  }

  const successOrders = results.filter((x) => x.ok).map((x) => x.order);
  const successCount = successOrders.length;

  if (successCount === 0) {
    const err = results[0]?.error;
    return conn.sendMessage(
      m.chat,
      {
        text: `❌ *SEMUA ORDER GAGAL*\n\n${otpApiError(err, "WAHub")}`,
      },
      { quoted: m },
    );
  }

  const uLatest = otpGetUser(n);

  if (amount === 1) {
    const od = successOrders[0];
    const orderText = [
      "✦ *PESANAN NOMOR AKTIF* ✦",
      "",
      `📱 *Layanan*: ${String(od.platform).toUpperCase()}`,
      `📞 *Nomor*: ${otpFormatPhone(od.phone)}`,
      `💵 *Harga*: Rp ${price.toLocaleString("id-ID")}`,
      `💳 *Sisa Saldo*: Rp ${Number(uLatest.saldo || 0).toLocaleString("id-ID")}`,
      `⏱️ *Status*: Menunggu Kode OTP masuk...`,
      "",
      "Gunakan tombol di bawah untuk mengontrol pesanan:",
    ].join("\n");

    const buttons = [
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔄 Ganti Nomor",
          id: `.gantinomor_${od.chatId}`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "📤 Minta Ulang",
          id: `.kirimulang_${od.chatId}`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "❌ Batalkan",
          id: `.cancel_${od.chatId}`,
        }),
      },
    ];

    const sent = await sendInteractive(
      conn,
      m.chat,
      {
        text: orderText,
        footer: getOtpFooter(),
        buttons,
      },
      m,
    );

    otpRememberMsg(m, od.chatId, sent);
    return;
  }

  let listText = `✦ *BERHASIL MENDAPATKAN ${successCount}/${amount} NOMOR* ✦\n\n`;
  listText += `📱 *Layanan*: ${String(service.name || platform).toUpperCase()}\n`;
  listText += `💵 *Total Biaya*: Rp ${(price * successCount).toLocaleString("id-ID")}\n`;
  listText += `💳 *Sisa Saldo*: Rp ${Number(uLatest.saldo || 0).toLocaleString("id-ID")}\n`;
  listText += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  successOrders.forEach((o, idx) => {
    listText += `*#${idx + 1}* ⇢ 📞 *${otpFormatPhone(o.phone)}*\n`;
  });

  listText += `\n💡 Tunggu kode OTP masuk... Tekan tombol di bawah untuk kontrol.`;

  const buttons = [
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "❌ Batalkan Semua",
        id: ".cancelall",
      }),
    },
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🛒 Beli Lagi",
        id: `.buyotpwa ${service.name || platform}`,
      }),
    },
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🔙 Menu Utama",
        id: ".otpviawa",
      }),
    },
  ];

  const sent = await sendInteractive(
    conn,
    m.chat,
    {
      text: listText.trim(),
      footer: getOtpFooter(),
      buttons,
    },
    m,
  );

  for (const od of successOrders) {
    otpRememberMsg(m, od.chatId, sent);
  }
};

// ===================== LOGIKA BUY OTP WA (SERVER 2) =====================
export const otpBuyWa2 = async (conn, m, platform, amount = 1) => {
  amount = Number(amount);

  if (!Number.isInteger(amount) || amount < 1) {
    return conn.sendMessage(
      m.chat,
      { text: "❌ Jumlah harus berupa angka minimal 1." },
      { quoted: m },
    );
  }

  if (amount > 20) {
    return conn.sendMessage(
      m.chat,
      { text: "❌ Maksimal pembelian adalah 20 nomor sekaligus." },
      { quoted: m },
    );
  }

  let service;
  try {
    service = await otpResolveServiceUnicorn(platform);
  } catch (e) {
    return conn.sendMessage(
      m.chat,
      { text: `❌ ${e.message}` },
      { quoted: m },
    );
  }

  const sid = Number(service.id);
  const stock = Number(service.stock);
  if (Number.isFinite(stock) && stock <= 0) {
    return conn.sendMessage(
      m.chat,
      { text: `❌ Stok ${service.name || platform} di Server 2 sedang habis.` },
      { quoted: m },
    );
  }

  const price = getWa2ServicePrice(service.name || platform);
  if (price === null || price === undefined) {
    return conn.sendMessage(
      m.chat,
      { text: `❌ Layanan ${service.name || platform} tidak tersedia di Server 2.` },
      { quoted: m },
    );
  }

  const totalPrice = price * amount;
  const n = otpNum(m.sender);
  const u = otpGetUser(n);
  const currentSaldo = Number(u.saldo || 0);

  if (currentSaldo < totalPrice) {
    return await sendInteractive(
      conn,
      m.chat,
      {
        text:
          `❌ *SALDO TIDAK MENCUKUPI*\n\n` +
          `📱 *Layanan*: ${String(service.name || platform).toUpperCase()}\n` +
          `💵 *Harga per nomor*: Rp ${price.toLocaleString("id-ID")}\n` +
          `🔢 *Jumlah*: ${amount} nomor\n` +
          `💰 *Total Biaya*: Rp ${totalPrice.toLocaleString("id-ID")}\n` +
          `💳 *Saldo Kamu*: Rp ${currentSaldo.toLocaleString("id-ID")}\n\n` +
          `Silakan lakukan deposit saldo terlebih dahulu untuk melanjutkan pemesanan.`,
        footer: getOtpFooter(),
        buttons: [
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
              display_text: "🔙 Kembali ke Layanan",
              id: ".buyotpwa2",
            }),
          },
        ],
      },
      m,
    );
  }

  await conn.sendMessage(
    m.chat,
    {
      text: `⏳ Sedang mengalokasikan ${amount} nomor *${String(service.name || platform).toUpperCase()}*...`,
    },
    { quoted: m },
  );

  const createOrder = async () => {
    try {
      const idempotencyKey = crypto.randomUUID();
      const r = await OTP_AXIOS.post(
        `${getUnicornBase()}/orders`,
        { service_id: sid },
        {
          headers: otpHeadersUnicorn(idempotencyKey),
          timeout: 20000,
        },
      );

      const d = r.data?.data || {};
      const oid = d.id;
      const phone = d.phone_number || "-";

      if (!oid) {
        throw new Error(r.data?.message || "Respons server tidak valid.");
      }

      const cid = `${n}_${oid}`;

      // Potong saldo pengguna sesuai harga layanan
      const userDb = otpGetUser(n);
      userDb.saldo = Math.max(0, (userDb.saldo || 0) - price);
      otpSaveUser(n, userDb);

      const od = {
        chatId: cid,
        orderId: oid,
        phone,
        platform: service.name || platform,
        serviceId: sid,
        platformId: null,
        apiType: "unicorn",
        userNumber: n,
        price,
        cost: price,
        refunded: false,
        createdAt: Date.now(),
        expiresAt: d.expire_at ? Number(d.expire_at) * 1000 : null,
        isActive: true,
        allowRetry: true,
        originalMsg: m,
      };

      otpAddOrder(n, od);
      OTP_STATE.active.set(cid, od);

      otpPollUnicorn(conn, m, cid).catch(async (e) => {
        const current = OTP_STATE.active.get(cid);
        if (!current || !current.isActive) return;
        current.isActive = false;
        OTP_STATE.active.delete(cid);

        // Refund saldo jika order error dan belum pernah direfund
        if (current.price && !current.refunded && current.userNumber) {
          current.refunded = true;
          const userObj = otpGetUser(current.userNumber);
          userObj.saldo = (userObj.saldo || 0) + current.price;
          otpSaveUser(current.userNumber, userObj);
          otpUpdate(current.userNumber, current.orderId, "cancelled", { refunded: true, price: current.price });
        }

        await conn.sendMessage(
          m.chat,
          {
            text: `❌ *OTP ERROR*\n\n${otpApiError(e, "EngineUnicorn")}\n💰 Saldo telah di-refund ke akunmu.`,
          },
          { quoted: m },
        );
      });

      return { ok: true, order: od };
    } catch (e) {
      return { ok: false, error: e };
    }
  };

  const results = [];
  for (let i = 0; i < amount; i++) {
    const res = await createOrder();
    results.push(res);
    if (!res.ok) {
      const status = res.error?.response?.status;
      if ([401, 402, 409].includes(status)) break;
    }
    if (i < amount - 1) await otpSleep(1000);
  }

  const successOrders = results.filter((x) => x.ok).map((x) => x.order);
  const successCount = successOrders.length;

  if (successCount === 0) {
    const err = results[0]?.error;
    return conn.sendMessage(
      m.chat,
      {
        text: `❌ *SEMUA ORDER GAGAL*\n\n${otpApiError(err, "EngineUnicorn")}`,
      },
      { quoted: m },
    );
  }

  const uLatest = otpGetUser(n);

  if (amount === 1) {
    const od = successOrders[0];
    const orderText = [
      "✦ *PESANAN NOMOR AKTIF* ✦",
      "",
      `📱 *Layanan*: ${String(od.platform).toUpperCase()}`,
      `📞 *Nomor*: ${otpFormatPhone(od.phone)}`,
      `💵 *Harga*: Rp ${price.toLocaleString("id-ID")}`,
      `💳 *Sisa Saldo*: Rp ${Number(uLatest.saldo || 0).toLocaleString("id-ID")}`,
      `⏱️ *Status*: Menunggu Kode OTP masuk...`,
      "",
      "Gunakan tombol di bawah untuk mengontrol pesanan:",
    ].join("\n");

    const buttons = [
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔄 Ganti Nomor",
          id: `.gantinomor_${od.chatId}`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "📤 Minta Ulang",
          id: `.kirimulang_${od.chatId}`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "❌ Batalkan",
          id: `.cancel_${od.chatId}`,
        }),
      },
    ];

    const sent = await sendInteractive(
      conn,
      m.chat,
      {
        text: orderText,
        footer: getOtpFooter(),
        buttons,
      },
      m,
    );

    otpRememberMsg(m, od.chatId, sent);
    return;
  }

  let listText = `✦ *BERHASIL MENDAPATKAN ${successCount}/${amount} NOMOR* ✦\n\n`;
  listText += `📱 *Layanan*: ${String(service.name || platform).toUpperCase()}\n`;
  listText += `💵 *Harga per nomor*: Rp ${price.toLocaleString("id-ID")}\n`;
  listText += `💳 *Sisa Saldo*: Rp ${Number(uLatest.saldo || 0).toLocaleString("id-ID")}\n`;
  listText += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  successOrders.forEach((o, idx) => {
    listText += `*#${idx + 1}* ⇢ 📞 *${otpFormatPhone(o.phone)}*\n`;
  });

  listText += `\n💡 Tunggu kode OTP masuk... Tekan tombol di bawah untuk kontrol.`;

  const buttons = [
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "❌ Batalkan Semua",
        id: ".cancelall",
      }),
    },
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🛒 Beli Lagi",
        id: `.buyotpwa2 ${service.name || platform}`,
      }),
    },
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🔙 Menu Utama",
        id: ".otpviawa",
      }),
    },
  ];

  const sent = await sendInteractive(
    conn,
    m.chat,
    {
      text: listText.trim(),
      footer: getOtpFooter(),
      buttons,
    },
    m,
  );

  for (const od of successOrders) {
    otpRememberMsg(m, od.chatId, sent);
  }
};

// ===================== LOGIKA BUY OTP SMS =====================
export const otpBuySms = async (conn, m, platform, amount = 1) => {
  const smsMap = getSmsMap();
  let pid = smsMap[String(platform).toLowerCase().trim()];
  if (!pid) {
    const compact = String(platform).toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const [k, v] of Object.entries(smsMap)) {
      if (k.toLowerCase().replace(/[^a-z0-9]/g, "") === compact) {
        pid = v;
        break;
      }
    }
  }

  if (!pid) {
    return conn.sendMessage(
      m.chat,
      {
        text: `❌ Platform tidak ditemukan.\n\n✅ ${Object.keys(smsMap).sort().join(", ")}`,
      },
      { quoted: m },
    );
  }

  amount = Number(amount);

  if (!Number.isInteger(amount) || amount < 1) {
    return conn.sendMessage(
      m.chat,
      { text: "❌ Jumlah harus berupa angka minimal 1." },
      { quoted: m },
    );
  }

  if (amount > 20) {
    return conn.sendMessage(
      m.chat,
      { text: "❌ Maksimal pembelian adalah 20 nomor sekaligus." },
      { quoted: m },
    );
  }

  const price = getSmsServicePrice(platform);
  const totalPrice = price * amount;
  const n = otpNum(m.sender);
  const u = otpGetUser(n);
  const currentSaldo = Number(u.saldo || 0);

  if (currentSaldo < totalPrice) {
    return await sendInteractive(
      conn,
      m.chat,
      {
        text:
          `❌ *SALDO TIDAK MENCUKUPI*\n\n` +
          `📱 *Layanan*: ${String(platform).toUpperCase()} [SMS]\n` +
          `💵 *Harga per nomor*: Rp ${price.toLocaleString("id-ID")}\n` +
          `🔢 *Jumlah*: ${amount} nomor\n` +
          `💰 *Total Biaya*: Rp ${totalPrice.toLocaleString("id-ID")}\n` +
          `💳 *Saldo Kamu*: Rp ${currentSaldo.toLocaleString("id-ID")}\n\n` +
          `Silakan lakukan deposit saldo terlebih dahulu untuk melanjutkan pemesanan.`,
        footer: getOtpFooter(),
        buttons: [
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
              display_text: "🔙 Kembali ke Layanan",
              id: ".buyotpsms",
            }),
          },
        ],
      },
      m,
    );
  }

  await conn.sendMessage(
    m.chat,
    {
      text: `⏳ Sedang mengalokasikan ${amount} nomor *${String(platform).toUpperCase()}* via SMS...`,
    },
    { quoted: m },
  );

  const isReseller = String(pid).startsWith("reseller_");
  const isS9 = String(pid).startsWith("s9_");
  const resellerService = isReseller
    ? (String(pid).includes("wa") ? "wa" : "tg")
    : null;
  const s9ServiceId = isS9 ? String(pid).replace("s9_", "") : null;

  const createOrder = async () => {
    try {
      let d = {};
      let oid = "";
      let phone = "-";

      if (isReseller) {
        const r = await OTP_AXIOS.post(
          `${getInstanBase()}/order.php`,
          new URLSearchParams({
            service: String(resellerService),
            country: "6",
          }).toString(),
          {
            headers: {
              ...otpHeadersSms(),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout: 20000,
          },
        );
        d = r.data || {};
        if (!d.success || !d.order_id) {
          throw new Error(d.message || d.error || "Provider Reseller menolak order.");
        }
        oid = d.order_id;
        phone = d.phone || d.number || "-";
      } else if (isS9) {
        const r = await OTP_AXIOS.post(
          `${getInstanBase()}/s9/order.php`,
          new URLSearchParams({
            service: String(s9ServiceId),
            country: "7",
            operator: "any",
          }).toString(),
          {
            headers: {
              ...otpHeadersSms(),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout: 20000,
          },
        );
        d = r.data || {};
        if (!d.success || !d.order_id) {
          throw new Error(d.message || d.error || "Provider s9 menolak order.");
        }
        oid = d.order_id;
        phone = d.phone || d.number || "-";
      } else {
        const r = await OTP_AXIOS.post(
          `${getInstanBase()}/s1/order.php`,
          {
            platform_id: pid,
            country_id: 7,
          },
          {
            headers: {
              ...otpHeadersSms(),
              "Content-Type": "application/json",
            },
            timeout: 20000,
          },
        );
        d = r.data || {};
        if (!(d.status === "success" || d.success)) {
          throw new Error(d.message || "Provider menolak order.");
        }
        oid =
          d.order_id ||
          d.id ||
          `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        phone = d.phone || d.number || "-";
      }

      const cid = `${n}_${oid}`;

      // Potong saldo pengguna sesuai harga layanan SMS
      const userDb = otpGetUser(n);
      userDb.saldo = Math.max(0, (userDb.saldo || 0) - price);
      otpSaveUser(n, userDb);

      const od = {
        chatId: cid,
        orderId: oid,
        phone,
        platform: String(platform).toLowerCase(),
        platformId: isReseller || isS9 ? null : pid,
        serviceId: isReseller ? resellerService : isS9 ? Number(s9ServiceId) : null,
        apiType: isReseller
          ? "otpinstan_reseller"
          : isS9
            ? "otpinstan_s9"
            : "otpinstan",
        userNumber: n,
        price,
        cost: price,
        refunded: false,
        createdAt: Date.now(),
        isActive: true,
        allowRetry: true,
        originalMsg: m,
      };

      otpAddOrder(n, od);
      OTP_STATE.active.set(cid, od);

      (async () => {
        await otpSleep(4000);
        try {
          await otpPollSms(conn, m, cid);
        } catch (e) {
          const current = OTP_STATE.active.get(cid);
          if (!current || !current.isActive) return;
          current.isActive = false;
          OTP_STATE.active.delete(cid);

          if (current.price && !current.refunded && current.userNumber) {
            current.refunded = true;
            const userObj = otpGetUser(current.userNumber);
            userObj.saldo = (userObj.saldo || 0) + current.price;
            otpSaveUser(current.userNumber, userObj);
            otpUpdate(current.userNumber, current.orderId, "cancelled", { refunded: true, price: current.price });
          }

          await conn.sendMessage(
            m.chat,
            {
              text: `❌ *OTP ERROR*\n\n${otpApiError(e, "OTPINSTAN")}\n💰 Saldo telah di-refund ke akunmu.`,
            },
            { quoted: m },
          );
        }
      })();

      return { ok: true, order: od };
    } catch (e) {
      return { ok: false, error: e };
    }
  };

  const results = [];
  for (let i = 0; i < amount; i++) {
    const res = await createOrder();
    results.push(res);
    if (!res.ok) {
      const status = res.error?.response?.status;
      if ([401, 403, 503].includes(status)) break;
    }
    if (i < amount - 1) await otpSleep(1000);
  }

  const successOrders = results.filter((x) => x.ok).map((x) => x.order);
  const successCount = successOrders.length;

  if (successCount === 0) {
    const err = results[0]?.error;
    return conn.sendMessage(
      m.chat,
      {
        text: `❌ *SEMUA ORDER GAGAL*\n\n${otpApiError(err, "OTPINSTAN")}`,
      },
      { quoted: m },
    );
  }

  const uLatest = otpGetUser(n);

  if (amount === 1) {
    const od = successOrders[0];
    const orderText = [
      "✦ *PESANAN NOMOR AKTIF* ✦",
      "",
      `📱 *Layanan*: ${String(od.platform).toUpperCase()} [SMS]`,
      `📞 *Nomor*: ${otpFormatPhone(od.phone)}`,
      `💵 *Harga*: Rp ${price.toLocaleString("id-ID")}`,
      `💳 *Sisa Saldo*: Rp ${Number(uLatest.saldo || 0).toLocaleString("id-ID")}`,
      `⏱️ *Status*: Menunggu Kode OTP masuk...`,
      "",
      "Gunakan tombol di bawah untuk mengontrol pesanan:",
    ].join("\n");

    const buttons = [
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔄 Ganti Nomor",
          id: `.gantinomor_${od.chatId}`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "📤 Minta Ulang",
          id: `.kirimulang_${od.chatId}`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "❌ Batalkan",
          id: `.cancel_${od.chatId}`,
        }),
      },
    ];

    const sent = await sendInteractive(
      conn,
      m.chat,
      {
        text: orderText,
        footer: getOtpFooter(),
        buttons,
      },
      m,
    );

    otpRememberMsg(m, od.chatId, sent);
    return;
  }

  let listText = `✦ *BERHASIL MENDAPATKAN ${successCount}/${amount} NOMOR* ✦\n\n`;
  listText += `📱 *Layanan*: ${String(platform).toUpperCase()} [SMS]\n`;
  listText += `💵 *Harga per nomor*: Rp ${price.toLocaleString("id-ID")}\n`;
  listText += `💳 *Sisa Saldo*: Rp ${Number(uLatest.saldo || 0).toLocaleString("id-ID")}\n`;
  listText += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  successOrders.forEach((o, idx) => {
    listText += `*#${idx + 1}* ⇢ 📞 *${otpFormatPhone(o.phone)}*\n`;
  });

  listText += `\n💡 Tunggu kode OTP masuk... Tekan tombol di bawah untuk kontrol.`;

  const buttons = [
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "❌ Batalkan Semua",
        id: ".cancelall",
      }),
    },
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🛒 Beli Lagi",
        id: `.buyotpsms ${platform}`,
      }),
    },
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🔙 Menu Utama",
        id: ".otpviasms",
      }),
    },
  ];

  const sent = await sendInteractive(
    conn,
    m.chat,
    {
      text: listText.trim(),
      footer: getOtpFooter(),
      buttons,
    },
    m,
  );

  for (const od of successOrders) {
    otpRememberMsg(m, od.chatId, sent);
  }
};
