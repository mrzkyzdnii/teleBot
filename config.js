import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

/*============= MAIN INFO =============*/
global.botName = "Jelita OTP Bot"
global.footer = ""
global.public = true
global.version = "2.2.2"

// Owner Info
global.owner = ['628386484120', '1271362249'] // ID Telegram atau nomor owner
global.nomorown = '628386484120'
global.nameown = 'SIJELITA'
global.userown = '@sijelitaaaaaa'

// TELEGRAM BOT TOKEN
global.telegramToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "8931995586:AAExPCHCl58INte0NtOjSZ79BrxYzDRRpec"

// 1. CONFIG SERVER 1 (WAHub / Dehuyz)
global.wahub = {
  base: (process.env.WAHUB_BASE || "https://dehuyzotp.shop/api").replace(/\/$/, ""),
  key: process.env.WAHUB_KEY || "wh_1ce1fe8448997dfb64730a666318b883c6712e2d6b63a147347b89ffa86b4386"
}

// 2. CONFIG SMS (OTPINSTAN)
global.otpinstan = {
  base: (process.env.OTPINSTAN_BASE || "https://otpinstan.com/api/reseller").replace(/\/$/, ""),
  key: process.env.OTPINSTAN_KEY || "otpk_c28d064dae48ebeb54f15a28c15580402074ad6674c8ab4a"
}

// 3. CONFIG SERVER 2 (Engine Unicorn)
global.unicorn = {
  base: (process.env.UNICORN_BASE || "https://engineunicorn.cloud/v1").replace(/\/$/, ""),
  key: process.env.UNICORN_KEY || "sk_ghuwQpMsu_iIGcYXoELDcVkxTUJQIO7s"
}

// 4. CONFIG AUTOGOPAY (QRIS PAYMENT GATEWAY)
global.autogopay = {
  base: (process.env.AUTOGOPAY_BASE || "https://v1-gateway.autogopay.site").replace(/\/$/, ""),
  key: process.env.AUTOGOPAY_KEY || "agp_0ccc73f05a4a40a4f49a9064cf464d537826d67a673fd8e41957da543b10e4c9"
}

// FOOTER BUTTON & TEXT
global.otp_footer = process.env.OTP_FOOTER || ""

// MAP SERVICE SERVER 1 (WHATSAPP)
global.otp_wa_map = {
  "alfa gift": 31,
  alfagift: 31,
  allobank: 42,
  bilibili: 153,
  cgv: 30,
  dana: 24,
  douyin: 214,
  evmoto: 153,
  "ev moto": 153,
  facebook: 34,
  fb: 34,
  fore: 27,
  gojek: 23,
  gopay: 153,
  janjijiwa: 32,
  "janji jiwa": 32,
  kfc: 38,
  kopken: 4,
  kpoint: 15,
  kuaisho: 153,
  kuaishou: 153,
  lazada: 53,
  motoran: 25,
  ovo: 153,
  ovograb: 55,
  "ovo grab": 55,
  qpon: 43,
  qpoon: 43,
  rednote: 153,
  "royal dream": 153,
  royaldream: 153,
  "shopee filter": 163,
  shopeefilter: 163,
  slot: 6,
  susu: 154,
  tiket: 46,
  tiktok: 18,
  tokopedia: 13,
  treasury: 153,
  wingstore: 40,
  "wing store": 40
}

// DAFTAR 31 LAYANAN RESMI SERVER 1 (WA)
global.otp_wa_catalog = [
  { name: "Alfa gift", realName: "Alfagift", id: 31, price: 2000 },
  { name: "Allobank", realName: "Allobank", id: 42, price: 2000 },
  { name: "Bilibili", realName: "ovo", id: 153, price: 1000 },
  { name: "CGV", realName: "Cgv", id: 30, price: 1500 },
  { name: "Dana", realName: "Dana", id: 24, price: 2000 },
  { name: "Douyin", realName: "Douyin", id: 214, price: 1500 },
  { name: "Evmoto", realName: "ovo", id: 153, price: 1500 },
  { name: "Facebook", realName: "Facebook", id: 34, price: 1000 },
  { name: "Fore", realName: "Fore", id: 27, price: 1500 },
  { name: "Gojek", realName: "Gojek", id: 23, price: 2000 },
  { name: "Gopay", realName: "ovo", id: 153, price: 2000 },
  { name: "Janji jiwa", realName: "Janjijiwa", id: 32, price: 1500 },
  { name: "KFC", realName: "Kfc", id: 38, price: 1500 },
  { name: "Kopken", realName: "Kopken", id: 4, price: 2000 },
  { name: "Kpoint", realName: "Kpoint", id: 15, price: 1000 },
  { name: "Kuaisho", realName: "ovo", id: 153, price: 1500 },
  { name: "Lazada", realName: "Lazada", id: 53, price: 1500 },
  { name: "Motoran", realName: "Motoran", id: 25, price: 1000 },
  { name: "Ovo", realName: "ovo", id: 153, price: 1500 },
  { name: "Ovograb", realName: "Ovograb", id: 55, price: 1500 },
  { name: "Qpoon", realName: "Qpon", id: 43, price: 1000 },
  { name: "Rednote", realName: "ovo", id: 153, price: 1000 },
  { name: "Royal dream", realName: "ovo", id: 153, price: 2000 },
  { name: "Shopee filter", realName: "Shopee Filter", id: 163, price: 2000 },
  { name: "Slot", realName: "Slot", id: 6, price: 1000 },
  { name: "Susu", realName: "susu", id: 154, price: 1000 },
  { name: "Tiket", realName: "Tiket", id: 46, price: 1000 },
  { name: "Tiktok", realName: "Tiktok", id: 18, price: 1500 },
  { name: "Tokopedia", realName: "Tokopedia", id: 13, price: 1000 },
  { name: "Treasury", realName: "ovo", id: 153, price: 2000 },
  { name: "Wingstore", realName: "Wingstore", id: 40, price: 1000 }
]

// HARGA LAYANAN SERVER 1 (WA)
global.otp_wa_prices = {
  "alfagift": 2000,
  "alfa gift": 2000,
  "allobank": 2000,
  "cgv": 1500,
  "dana": 2000,
  "douyin": 1500,
  "kuaisho": 1500,
  "kuaishou": 1500,
  "rednote": 1000,
  "bilibili": 1000,
  "facebook": 1000,
  "fb": 1000,
  "fore": 1500,
  "gojek": 2000,
  "gopay": 2000,
  "janjijiwa": 1500,
  "janji jiwa": 1500,
  "kfc": 1500,
  "kopken": 2000,
  "kpoint": 1000,
  "lazada": 1500,
  "motoran": 1000,
  "ovo": 1500,
  "ovograb": 1500,
  "ovo grab": 1500,
  "qpon": 1000,
  "qpoon": 1000,
  "shopee filter": 2000,
  "shopeefilter": 2000,
  "shopee": 2000,
  "slot": 1000,
  "slot2": 1000,
  "susu": 1000,
  "tiket": 1000,
  "tiktok": 1500,
  "tokopedia": 1000,
  "wingstore": 1000,
  "wing store": 1000,
  "evmoto": 1500,
  "ev moto": 1500,
  "treasury": 2000,
  "royal dream": 2000,
  "royaldream": 2000
}

// HARGA LAYANAN SERVER 2 (ENGINE UNICORN)
global.otp_wa2_prices = {
  "gopay": 1500,
  "chagee": 1000,
  "keretaku": 1000,
  "motorku": 1000,
  "familymart": 1000,
  "family mart": 1000,
  "tokopedia": 1000,
  "kfc": 1000,
  "rupa rupa": 1000,
  "ruparupa": 1000,
  "evmoto": 1500,
  "ev moto": 1500,
  "facebook": 1000,
  "fb": 1000,
  "grab": 1000,
  "ovo": 1000,
  "mtix": 1000,
  "m-tix": 1000,
  "m tix": 1000,
  "janjijiwa": 1000,
  "janji jiwa": 1000,
  "my republik": 1000,
  "my republic": 1000,
  "myrepublik": 1000,
  "myrepublic": 1000,
  "cgv": 1000,
  "sgm": 1000,
  "bebeclub": 1000,
  "hifi": 1000,
  "hi-fi": 1000,
  "hi fi": 1000,
  "instagram": 1000,
  "ig": 1000,
  "kpoin": 1000,
  "k-poin": 1000,
  "k poin": 1000,
  "kpoint": 1000,
  "dana": 1500,
  "mixue": 1000,
  "yahoo": 1000,
  "slot": 1000,
  "gojek": 1500,
  "doku": 1500,
  "nutrilon": 1000,
  "lazada": 1000,
  "akulaku": 1000,
  "shopee": 2500,
  "alfagift": 1500,
  "alfa gift": 1500,
  "blibli": 1000,
  "fore cofee": 1500,
  "fore coffee": 1500,
  "fore": 1500,
  "honset": 1000,
  "kopken": 2500,
  "kopi kenangan": 2500
}


// MAP SERVICE SMS (OTPINSTAN)
global.otp_sms_map = {
  "All Acces": 196,
  "Allo Fresh": 1646,
  "BPJSTK": 102,
  "Bumble": 65,
  "Dana": 45,
  "Doku": 199,
  "Gojek": 55,
  "Grab": 56,
  "Hypermart": 1844,
  "Indomaret": 642,
  "LinkAja": 47,
  "OVO": 46,
  "Shopee": 21,
  "Telegram": "reseller_tg",
  "TikTok": 7,
  "Tomoro Coffee": 223,
  "Twitter": 6,
  "Whatsapp": "reseller_wa",
  // Alias teks / pencarian
  "all acces": 196,
  allacces: 196,
  "allo fresh": 1646,
  allofresh: 1646,
  bpjstk: 102,
  bumbel: 65,
  bumble: 65,
  dana: 45,
  doku: 199,
  gojek: 55,
  grab: 56,
  hypermart: 1844,
  indomaret: 642,
  "link aja": 47,
  linkaja: 47,
  ovo: 46,
  shopee: 21,
  telegram: "reseller_tg",
  tg: "reseller_tg",
  tiktok: 7,
  tomorro: 223,
  "tomorro coffee": 223,
  tomorrocaffe: 223,
  tomoro: 223,
  twitter: 6,
  whatsapp: "reseller_wa",
  wa: "reseller_wa"
}

// HARGA LAYANAN SMS (OTPINSTAN)
global.otp_sms_prices = {
  "all acces": 1500,
  "allacces": 1500,
  "allo fresh": 1500,
  "allofresh": 1500,
  "bpjstk": 1500,
  "bumble": 1000,
  "bumbel": 1000,
  "dana": 1500,
  "doku": 1500,
  "gojek": 1500,
  "grab": 1000,
  "hypermart": 2000,
  "indomaret": 1500,
  "link aja": 1500,
  "linkaja": 1500,
  "ovo": 1500,
  "shopee": 2000,
  "telegram": 4000,
  "tg": 4000,
  "tiktok": 1500,
  "tomoro": 1500,
  "tomorro": 1500,
  "tomoro coffee": 1500,
  "tomorro coffee": 1500,
  "twitter": 1000,
  "whatsapp": 3500,
  "wa": 3500
}

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Update 'config.js'"))
  import(`${file}?update=${Date.now()}`)
})
