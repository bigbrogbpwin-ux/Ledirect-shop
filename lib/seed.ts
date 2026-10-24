import { DatabaseSync } from "node:sqlite";
import { imageSet } from "./art";
import { BRAND } from "./brand";
import { DEFAULT_SETTINGS, SEED_FX, SEED_VERSION } from "./defaults";
import { addHours, nowIso, weekLabel } from "./format";
import { hashPassword } from "./password";
import { presentSplit, quoteSku, type FreightSettings } from "./pricing";
import { INSTOCK_FLOW, PREORDER_FLOW } from "./states";

const FREIGHT: FreightSettings = {
  seaUsdCentsPerCbm: DEFAULT_SETTINGS.sea_usd_cents_per_cbm,
  airUsdCentsPerKg: DEFAULT_SETTINGS.air_usd_cents_per_kg,
  gstDeductible: false,
  gstBps: DEFAULT_SETTINGS.gst_bps,
  minPreorderCm3: DEFAULT_SETTINGS.min_preorder_cm3,
};

const CATS = [
  { slug: "phone", en: "Phone accessories", zh: "手机配件", fr: "Accessoires téléphone", margin: 35, duty: 10, hs: "8544.42", blurbEn: "Cables, chargers, and cases that survive a Freetown pocket.", blurbZh: "经得起弗里敦口袋的线、充电头和壳。", blurbFr: "Câbles, chargeurs et coques pour une poche à Freetown." },
  { slug: "solar", en: "Solar and power", zh: "太阳能与充电宝", fr: "Solaire et batteries", margin: 45, duty: 0, hs: "8541.43", blurbEn: "Panels, lamps, and power banks. Duty-free band.", blurbZh: "太阳能板、灯和充电宝。免税档。", blurbFr: "Panneaux, lampes et batteries. Bande hors taxe." },
  { slug: "beauty", en: "Wigs and beauty", zh: "假发与美妆", fr: "Perruques et beauté", margin: 40, duty: 20, hs: "6704.19", blurbEn: "Hair, brushes, and tools. Not cosmetics that need a permit.", blurbZh: "假发、刷子和工具。不含需要许可的化妆品。", blurbFr: "Cheveux, brosses et outils." },
  { slug: "home", en: "Small appliances", zh: "小家电", fr: "Petit électroménager", margin: 30, duty: 10, hs: "8516.79", blurbEn: "Kettles, irons, fans. Priced against Kissy market.", blurbZh: "水壶、熨斗、风扇。对照基西市场定价。", blurbFr: "Bouilloires, fers, ventilateurs. Prix face au marché de Kissy." },
  { slug: "moto", en: "Moto parts", zh: "摩托配件", fr: "Pièces moto", margin: 35, duty: 10, hs: "4011.40", blurbEn: "The parts okada riders replace most often.", blurbZh: "摩托骑手最常换的配件。", blurbFr: "Les pièces que les motos remplacent le plus." },
  { slug: "apparel", en: "Basics", zh: "基础服装", fr: "Vêtements de base", margin: 40, duty: 20, hs: "6109.10", blurbEn: "Tees, jeans, and rain layers. No branded copies.", blurbZh: "T 恤、牛仔裤和雨衣。没有仿牌。", blurbFr: "T-shirts, jeans et pluie. Pas de copies de marques." },
];

type Flag = {
  sku: string;
  cat: string;
  zone: "instock" | "preorder";
  en: string;
  zh: string;
  fr: string;
  descEn: string;
  descZh: string;
  descFr: string;
  g: number;
  l: number;
  w: number;
  h: number;
  cny: number;
  stock?: number;
  hot?: boolean;
  tags: string;
};

const FLAGS: Flag[] = [
  { sku: "PHONE-CABLE", cat: "phone", zone: "instock", en: "USB-C 60W cable, 1.5 m", zh: "USB-C 60W 数据线 1.5 米", fr: "Câble USB-C 60W, 1,5 m", descEn: "Braided cable for Android phones. Three studio photos, measured carton.", descZh: "安卓手机用编织线。三张棚拍，纸箱已实测。", descFr: "Câble tressé pour Android. Carton mesuré.", g: 80, l: 20, w: 10, h: 3, cny: 12, stock: 20, hot: true, tags: "cable charger usb" },
  { sku: "PHONE-NECK", cat: "phone", zone: "preorder", en: "Neckband earphones", zh: "颈挂式耳机", fr: "Écouteurs tour de cou", descEn: "Bluetooth neckband. Sea price includes freight and tax.", descZh: "蓝牙颈挂耳机。海运价已含运费和税。", descFr: "Tour de cou Bluetooth. Prix mer avec fret et taxes.", g: 180, l: 22, w: 16, h: 5, cny: 45, tags: "audio earphones" },
  { sku: "SOLAR-LAMP", cat: "solar", zone: "instock", en: "Solar desk lamp", zh: "太阳能台灯", fr: "Lampe solaire de bureau", descEn: "Charges in the day, lights a table at night. Duty-free band.", descZh: "白天充电，晚上照桌面。免税档。", descFr: "Se charge le jour, éclaire la table le soir.", g: 420, l: 28, w: 12, h: 8, cny: 38, stock: 9, hot: true, tags: "solar lamp light" },
  { sku: "SOLAR-KIT", cat: "solar", zone: "preorder", en: "300W home solar kit", zh: "300W 家用太阳能套装", fr: "Kit solaire maison 300W", descEn: "Panel, controller, and cables. A large order can cross the bank-transfer line.", descZh: "板、控制器和线。数量多了会进入银行转账。", descFr: "Panneau, contrôleur et câbles. Une grosse quantité passe au virement.", g: 6800, l: 110, w: 70, h: 8, cny: 980, tags: "solar panel kit" },
  { sku: "BEAUTY-WIG", cat: "beauty", zone: "preorder", en: "Body wave wig, 18 inch", zh: "大波浪假发 18 寸", fr: "Perruque body wave, 18 pouces", descEn: "Synthetic hair, three combs. Not a branded salon name.", descZh: "化纤发，三个卡子。不是品牌沙龙款。", descFr: "Cheveux synthétiques, trois peignes.", g: 260, l: 35, w: 20, h: 8, cny: 68, tags: "wig hair" },
  { sku: "BEAUTY-BRUSH", cat: "beauty", zone: "instock", en: "Makeup brush set, 10 pieces", zh: "化妆刷 10 支套装", fr: "Set de 10 pinceaux", descEn: "Wooden handles, pouch included. In the Kissy warehouse now.", descZh: "木柄，带收纳包。基西仓现货。", descFr: "Manches bois, pochette incluse. En stock à Kissy.", g: 220, l: 26, w: 12, h: 6, cny: 22, stock: 14, hot: true, tags: "brush makeup" },
  { sku: "HOME-KETTLE", cat: "home", zone: "instock", en: "Electric kettle, 1.8 L", zh: "电热水壶 1.8 升", fr: "Bouilloire électrique 1,8 L", descEn: "Boils fast. One left in this demo so two people cannot buy the last kettle.", descZh: "烧水快。演示里只剩一件，不能两个人同时买走最后一把。", descFr: "Chauffe vite. Une seule pièce dans la démo.", g: 900, l: 22, w: 20, h: 24, cny: 42, stock: 1, hot: true, tags: "kettle kitchen" },
  { sku: "HOME-FAN", cat: "home", zone: "instock", en: "Standing fan, 16 inch", zh: "落地扇 16 寸", fr: "Ventilateur sur pied, 16 pouces", descEn: "Three speeds. Ready for pickup in the sample orders.", descZh: "三档风速。示例订单里有一单待提货。", descFr: "Trois vitesses.", g: 3200, l: 50, w: 50, h: 18, cny: 75, stock: 6, tags: "fan cooling" },
  { sku: "HOME-IRON", cat: "home", zone: "preorder", en: "Steam iron", zh: "蒸汽熨斗", fr: "Fer à vapeur", descEn: "Non-stick plate. Ships with the weekly container.", descZh: "不粘底板。跟每周柜子走。", descFr: "Semelle antiadhésive. Part avec le conteneur.", g: 1100, l: 32, w: 16, h: 14, cny: 48, tags: "iron home" },
  { sku: "MOTO-HELM", cat: "moto", zone: "instock", en: "Open-face helmet", zh: "露脸头盔", fr: "Casque jet", descEn: "Sizes S, M, and L. Not a copy of a European brand.", descZh: "S、M、L 三个尺码。不是欧洲品牌仿品。", descFr: "Tailles S, M et L.", g: 950, l: 35, w: 28, h: 25, cny: 55, stock: 8, hot: true, tags: "helmet moto" },
  { sku: "MOTO-TYRE", cat: "moto", zone: "preorder", en: "Motorcycle tyre 2.75-18", zh: "摩托车外胎 2.75-18", fr: "Pneu moto 2.75-18", descEn: "A trader carton of these fills a real share of the weekly container.", descZh: "商贩整箱能占本周柜子里实实在在的一块体积。", descFr: "Un carton revendeur occupe une vraie part du conteneur.", g: 4500, l: 70, w: 70, h: 30, cny: 70, tags: "tyre moto okada" },
  { sku: "APP-TEE", cat: "apparel", zone: "instock", en: "Heavy cotton tee, 3-pack", zh: "厚棉 T 恤三件装", fr: "Lot de 3 t-shirts coton", descEn: "Black, white, navy. Sizes M, L, XL. Plain, no logos.", descZh: "黑、白、藏青。M、L、XL。没有商标。", descFr: "Noir, blanc, marine. M, L, XL. Sans logo.", g: 480, l: 30, w: 24, h: 6, cny: 36, stock: 18, hot: true, tags: "shirt tee cotton" },
];

const NOUNS: Record<string, { en: string[]; zh: string[]; fr: string[] }> = {
  phone: { en: ["Braided cable", "Wall charger", "Phone stand", "Earbuds", "Car charger", "Glass pack"], zh: ["编织线", "充电头", "手机支架", "耳机", "车充", "钢化膜"], fr: ["Câble tressé", "Chargeur mural", "Support", "Écouteurs", "Chargeur voiture", "Verre"] },
  solar: { en: ["Power bank", "Folding panel", "Garden light", "USB fan", "Lantern", "Clip lamp"], zh: ["充电宝", "折叠太阳能板", "庭院灯", "USB 风扇", "露营灯", "夹子灯"], fr: ["Batterie", "Panneau pliant", "Lampe jardin", "Ventilo USB", "Lanterne", "Lampe pince"] },
  beauty: { en: ["Edge brush", "Bonnet", "Mirror", "Lash pack", "Comb set", "Hair dryer"], zh: ["发际线刷", "睡帽", "镜子", "假睫毛", "梳子套装", "吹风机"], fr: ["Brosse", "Bonnet", "Miroir", "Faux cils", "Peignes", "Sèche-cheveux"] },
  home: { en: ["Hand blender", "Rice cooker", "Toaster", "Clip fan", "Extension reel", "Thermos"], zh: ["手持搅拌器", "电饭煲", "烤面包机", "夹扇", "卷线盘", "保温壶"], fr: ["Mixeur", "Cuiseur", "Grille-pain", "Ventilo", "Enrouleur", "Thermos"] },
  moto: { en: ["Mirror pair", "Riding gloves", "Phone mount", "H4 bulb", "Chain lube", "Grip set"], zh: ["后视镜一对", "骑行手套", "手机支架", "H4 灯泡", "链条油", "手把套"], fr: ["Rétros", "Gants", "Support", "Ampoule H4", "Lubrifiant", "Poignées"] },
  apparel: { en: ["Work jeans", "School polo", "Rain jacket", "Sports shorts", "Cotton socks", "Plain shirt"], zh: ["工装牛仔裤", "校服 Polo", "雨衣", "运动短裤", "棉袜", "素色衬衫"], fr: ["Jean de travail", "Polo", "Imperméable", "Short", "Chaussettes", "Chemise"] },
};

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seed(db: DatabaseSync) {
  const run = (sql: string, ...params: unknown[]) => db.prepare(sql).run(...(params as never[]));
  const ins = (sql: string, ...params: unknown[]) => Number(db.prepare(sql).run(...(params as never[])).lastInsertRowid);
  const put = (table: string, row: Record<string, unknown>) => {
    const keys = Object.keys(row);
    return ins(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`, ...keys.map((k) => row[k]));
  };

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    put("settings", { key, value: typeof value === "boolean" ? (value ? "1" : "0") : String(value) });
  }
  put("settings", { key: "seed_version", value: SEED_VERSION });

  put("fx_rates", {
    sle_per_usd_e4: SEED_FX.slePerUsdE4,
    usd_cny_e4: SEED_FX.usdCnyE4,
    buffer_bps: SEED_FX.bufferBps,
    effective_at: addHours(nowIso(), -48),
    entered_by: "joseph@ledirect.demo",
    reviewed_by: "amadu@ledirect.demo",
    status: "active",
  });

  const pw = hashPassword("Demo#2026");
  const staff = [
    ["ada@ledirect.demo", "Ada Kamara", "super_admin"],
    ["ibrahim@ledirect.demo", "Ibrahim Koroma", "ops"],
    ["wei@ledirect.demo", "Wei Chen", "procurement"],
    ["mamusu@ledirect.demo", "Mamusu Bangura", "warehouse"],
    ["fanta@ledirect.demo", "Fanta Sesay", "cs"],
    ["joseph@ledirect.demo", "Joseph Cole", "finance"],
    ["amadu@ledirect.demo", "Amadu Turay", "finance"],
  ];
  for (const [email, name, role] of staff) put("staff", { email, name, role, password_hash: pw, active: 1 });

  const aminata = put("users", { phone: "+23276111001", name: "Aminata Bangura", email: "aminata@example.com", pickup_point_id: 1, created_at: addHours(nowIso(), -400) });
  const mohamed = put("users", { phone: "+23276111002", name: "Mohamed Sesay", created_at: addHours(nowIso(), -200) });
  put("wallets", { user_id: aminata, balance_sle: 0, frozen_sle: 0 });
  put("wallets", { user_id: mohamed, balance_sle: 0, frozen_sle: 0 });
  put("addresses", { user_id: aminata, name: "Aminata Bangura", phone: "+23276111001", area: "freetown", line: "14 Wilkinson Road, Freetown", is_default: 1 });

  const kissy = put("pickup_points", { name: "Kissy warehouse", address: BRAND.warehouse, hours: BRAND.hours, city: "Freetown", note: "Main pickup. Bring the code.", active: 1, kind: "local", fee_sle: 0, phone: BRAND.phone });
  put("pickup_points", { name: "PZ desk", address: "PZ Roundabout, Freetown", hours: "Mon–Sat 10:00–17:00", city: "Freetown", note: "Small parcels only.", active: 1, kind: "local", fee_sle: 0, phone: "" });
  put("pickup_points", { name: "Bo parcel desk", address: "12 Damballa Road, Bo", hours: "Mon–Sat 9:00–17:00", city: "Bo", note: "Partner desk. Inland fee is on the bill.", active: 1, kind: "partner", fee_sle: 80, phone: "+23276200101" });
  put("pickup_points", { name: "Kenema parcel desk", address: "4 Hangha Road, Kenema", hours: "Mon–Sat 9:00–17:00", city: "Kenema", note: "Partner desk. Inland fee is on the bill.", active: 1, kind: "partner", fee_sle: 120, phone: "+23276200102" });
  put("pickup_points", { name: "Makeni parcel desk", address: "8 Station Road, Makeni", hours: "Mon–Sat 9:00–17:00", city: "Makeni", note: "Partner desk. Inland fee is on the bill.", active: 1, kind: "partner", fee_sle: 90, phone: "+23276200103" });
  const coupon = (code: string, en: string, zh: string, fr: string, kind: string, value: number, min: number, cap: number, zone: string) =>
    put("coupons", {
      code, title_en: en, title_zh: zh, title_fr: fr, kind, value, cap_sle: cap, min_sle: min, zone,
      max_uses: 500, used_count: 0, per_user: 1, active: 1,
      starts_at: addHours(nowIso(), -24), ends_at: addHours(nowIso(), 24 * 180), created_at: nowIso(),
    });
  coupon("WELCOME500", "Le 500 off from Le 2,000", "满 Le 2,000 减 Le 500", "Le 500 dès Le 2 000", "amount", 500, 2000, 0, "any");
  coupon("SEA10", "10% off sea freight goods", "海运商品 9 折", "10 % sur le fret mer", "percent", 1000, 0, 1500, "preorder");
  coupon("FAMILY200", "Le 200 off a family order", "给家里人买减 Le 200", "Le 200 sur une commande famille", "amount", 200, 0, 0, "diaspora");
  put("seller_apps", {
    shop_name: "Mariama Wigs", owner_name: "Mariama Jalloh", phone: "+23276666001", email: "mariama@example.com",
    category: "Wigs and beauty", city: "Freetown", doc_note: "Partner shop", status: "approved",
    commission_bps: 800, seller_code: "SEL-1001", reviewed_at: addHours(nowIso(), -48), created_at: addHours(nowIso(), -72),
  });

  const catId: Record<string, number> = {};
  CATS.forEach((c, i) => {
    catId[c.slug] = put("categories", { slug: c.slug, name_en: c.en, name_zh: c.zh, name_fr: c.fr, blurb_en: c.blurbEn, blurb_zh: c.blurbZh, blurb_fr: c.blurbFr, sort: i });
  });

  const ids: Record<string, number> = {};
  const addSku = (input: {
    sku: string;
    cat: string;
    zone: "instock" | "preorder";
    en: string;
    zh: string;
    fr: string;
    descEn: string;
    descZh: string;
    descFr: string;
    g: number;
    l: number;
    w: number;
    h: number;
    cny: number;
    stock?: number | null;
    hot?: boolean;
    tags: string;
    source?: string;
    shop?: string;
    years?: number | null;
    sales?: number | null;
    supplier?: string;
  }) => {
    const cat = CATS.find((c) => c.slug === input.cat)!;
    const quote = quoteSku(
      {
        purchaseCnyFen: Math.round(input.cny * 100),
        domesticUsdCents: 80,
        whUsdCents: 40,
        destUsdCents: input.g > 2000 ? 150 : 70,
        dutyBps: cat.duty * 100,
        marginBps: cat.margin * 100,
        weightG: input.g,
        lengthCm: input.l,
        widthCm: input.w,
        heightCm: input.h,
        zone: input.zone,
      },
      SEED_FX,
      FREIGHT,
    );
    const local = Math.ceil(quote.priceSle / 0.75 / 10) * 10;
    const hot = input.hot && input.zone === "instock" && quote.priceSle <= local * 0.8 ? 1 : 0;
    const id = put("products", {
      sku: input.sku,
      zone: input.zone,
      source: input.source || "catalog",
      category_id: catId[input.cat],
      title_en: input.en,
      title_zh: input.zh,
      title_fr: input.fr,
      description_en: input.descEn,
      description_zh: input.descZh,
      description_fr: input.descFr,
      highlights_en: JSON.stringify(["Measured carton", "English details", "Price locked when you pay"]),
      highlights_zh: JSON.stringify(["纸箱已实测", "英文详情", "付款锁定价格"]),
      highlights_fr: JSON.stringify(["Carton mesuré", "Fiche en anglais", "Prix bloqué au paiement"]),
      images: JSON.stringify(imageSet(input.sku, input.cat, true)),
      weight_g: input.g,
      length_cm: input.l,
      width_cm: input.w,
      height_cm: input.h,
      purchase_cny_fen: Math.round(input.cny * 100),
      domestic_usd_cents: 80,
      wh_usd_cents: 40,
      dest_usd_cents: input.g > 2000 ? 150 : 70,
      duty_bps: cat.duty * 100,
      hs_code: cat.hs,
      hs_signed_by: "A. Conteh",
      needs_permit: 0,
      margin_bps: cat.margin * 100,
      marketing_price_sle: null,
      local_market_sle: local,
      local_market_source: "Kissy market stall survey",
      local_market_date: "2026-10-18",
      stock: input.zone === "instock" ? input.stock ?? 8 : null,
      sold_count: 20 + (input.sku.length % 40),
      status: "live",
      gate_measure: 1,
      gate_english: 1,
      gate_local: 1,
      gate_hs: 1,
      gate_compliance: 1,
      compliance_note: null,
      is_hot: hot,
      is_estimate: 0,
      shop_name: input.shop || "LeDirect",
      shop_years: input.years ?? null,
      sales_count_src: input.sales ?? null,
      supplier_name: input.supplier || "Yiwu Hengda",
      air_ok: 1,
      tags: input.tags,
      visual_key: input.cat,
      created_at: nowIso(),
    });
    ids[input.sku] = id;
    return { id, quote };
  };

  for (const flag of FLAGS) addSku(flag);
  const rand = mulberry(20261022);
  for (const cat of CATS) {
    const have = FLAGS.filter((f) => f.cat === cat.slug).length;
    for (let n = have; n < 10; n++) {
      const noun = NOUNS[cat.slug];
      const i = n % noun.en.length;
      const zone = rand() > 0.45 ? "preorder" : "instock";
      addSku({
        sku: `${cat.slug.toUpperCase()}-X${n}`,
        cat: cat.slug,
        zone,
        en: `${noun.en[i]} ${n + 1}`,
        zh: `${noun.zh[i]} ${n + 1}`,
        fr: `${noun.fr[i]} ${n + 1}`,
        descEn: `${noun.en[i]} for Freetown. Factory packed, price locked at payment.`,
        descZh: `${noun.zh[i]}，弗里敦交付。工厂包装，付款锁价。`,
        descFr: `${noun.fr[i]} pour Freetown. Prix bloqué au paiement.`,
        g: 80 + Math.round(rand() * 1500),
        l: 15 + Math.round(rand() * 40),
        w: 10 + Math.round(rand() * 30),
        h: 4 + Math.round(rand() * 20),
        cny: 8 + Math.round(rand() * 80),
        stock: zone === "instock" ? 4 + Math.round(rand() * 12) : undefined,
        tags: cat.slug,
      });
    }
  }

  const shops = ["Yiwu Hengda", "Shenzhen Nuoli", "Guangzhou Meijia", "Putian Hengfei", "Dongguan Aoke"];
  for (let n = 1; n <= 200; n++) {
    const cat = CATS[n % CATS.length];
    const noun = NOUNS[cat.slug];
    const i = n % noun.en.length;
    addSku({
      sku: `A1688-${String(n).padStart(4, "0")}`,
      cat: cat.slug,
      zone: "preorder",
      en: `${noun.en[i]} · lot ${n}`,
      zh: `${noun.zh[i]} · 批次 ${n}`,
      fr: `${noun.fr[i]} · lot ${n}`,
      descEn: "1688 sample listing. Same checkout as the LeDirect shelf.",
      descZh: "1688 样本商品。结算和店内商品一样。",
      descFr: "Fiche échantillon 1688. Même paiement.",
      g: 60 + Math.round(rand() * 2000),
      l: 12 + Math.round(rand() * 50),
      w: 8 + Math.round(rand() * 30),
      h: 3 + Math.round(rand() * 24),
      cny: 6 + Math.round(rand() * 220),
      tags: `1688 ${cat.slug}`,
      source: "1688",
      shop: shops[n % shops.length],
      years: 1 + (n % 8),
      sales: 30 + Math.round(rand() * 8000),
      supplier: shops[n % shops.length],
    });
  }

  const helm = ids["MOTO-HELM"];
  for (const [label, delta, stock] of [["S", 0, 2], ["M", 0, 3], ["L", 15, 3]] as const) {
    put("variants", { product_id: helm, label, sku: `MOTO-HELM-${label}`, price_delta_sle: delta, stock, weight_extra_g: 0 });
  }
  run("UPDATE products SET stock = 8 WHERE id = ?", helm);
  const tee = ids["APP-TEE"];
  for (const [label, delta, stock] of [["M", 0, 6], ["L", 0, 7], ["XL", 10, 5]] as const) {
    put("variants", { product_id: tee, label, sku: `APP-TEE-${label}`, price_delta_sle: delta, stock, weight_extra_g: 20 });
  }

  put("reviews", { product_id: ids["PHONE-CABLE"], user_name: "Isata K.", rating: 5, body: "E fine well. The cable is still charging after three weeks.", created_at: addHours(nowIso(), -30) });
  put("reviews", { product_id: ids["SOLAR-LAMP"], user_name: "Abdul R.", rating: 4, body: "Light is enough for homework. Took two evenings of sun.", reply: "Glad it reached you. — Mariama", created_at: addHours(nowIso(), -20) });
  put("reviews", { product_id: ids["HOME-KETTLE"], user_name: "Fatu B.", rating: 5, body: "Boils faster than the one at the market, and it cost less.", created_at: addHours(nowIso(), -12) });

  const help = [
    ["shipping", "Freight and timing", "运费和时效", "Fret et délais",
      "In-stock goods in Freetown: pickup is free, motorbike delivery is Le 30, free from Le 500 of in-stock goods. Sea freight from China is about 35–49 days and is already inside the price. Air is offered at checkout as the difference versus sea. Partner desks in Bo (Le 80), Kenema (Le 120), and Makeni (Le 90) add that inland fee to the bill.",
      "弗里敦现货：自提免费，摩托派送 Le 30，现货满 Le 500 免派送。中国海运约 35–49 天，运费和税已经在价格里。结算页可以改空运，只补和海运的差价。Bo（Le 80）、Kenema（Le 120）、Makeni（Le 90）的合作提货点，内陆费写在账单上。",
      "Stock à Freetown : retrait gratuit, moto Le 30, offerte dès Le 500 de stock local. La mer depuis la Chine prend 35–49 jours et le fret est déjà dans le prix. L'avion se choisit au paiement, pour la différence. Comptoirs partenaires : Bo Le 80, Kenema Le 120, Makeni Le 90, ajoutés à la facture."],
    ["refunds", "Refunds", "退款", "Remboursements",
      "Cancel before we buy: full refund. Cancel after we buy but before the container: 90% back. If we cannot supply, fail inspection, or the price rises and you do not confirm: full refund within 48 hours. Lost goods, or more than 30 days past the promised window: full refund or we send it again. Quality issues within 7 days, with unboxing photos: refund that item or send it again. We pay you first.",
      "采购前取消：全额退。采购后、装柜前取消：退 90%。缺货、验货失败或涨价你没确认：48 小时内全额退。丢件，或超出承诺 30 天：全额退或免费重发。到货 7 天内的质量问题，附开箱照片：退该件或补发。我们先赔付。",
      "Annulation avant l'achat : remboursement total. Après l'achat mais avant le conteneur : 90 %. Rupture, échec de contrôle, ou hausse non confirmée : total sous 48 heures. Perte, ou plus de 30 jours après la promesse : total ou renvoi gratuit. Qualité sous 7 jours avec photos : cet article est remboursé ou renvoyé. Nous payons d'abord."],
    ["pickup", "Pickup points", "提货点", "Points de retrait",
      `${BRAND.warehouse}. ${BRAND.hours}. Bring the 6-digit code from WhatsApp or SMS. A small desk at PZ takes small parcels only. Partner desks: 12 Damballa Road, Bo (Le 80); 4 Hangha Road, Kenema (Le 120); 8 Station Road, Makeni (Le 90).`,
      `${BRAND.warehouse}。${BRAND.hours}。带上 WhatsApp 或短信里的 6 位提货码。PZ 小柜台只收小件。合作点：Bo Damballa 路 12 号（Le 80）；Kenema Hangha 路 4 号（Le 120）；Makeni Station 路 8 号（Le 90）。`,
      `${BRAND.warehouse}. ${BRAND.hours}. Apportez le code à 6 chiffres. Le comptoir de PZ ne prend que les petits colis. Partenaires : 12 Damballa Road, Bo (Le 80) ; 4 Hangha Road, Kenema (Le 120) ; 8 Station Road, Makeni (Le 90).`],
    ["faq", "Common questions", "常见问题", "Questions fréquentes",
      "The price locks when payment succeeds. A later exchange rate does not change a paid order. Orders over Le 13,500 take a 30% mobile-money deposit and the rest by bank transfer within 72 hours. If the balance does not arrive, the deposit comes back in full.",
      "付款成功就锁定价格。之后汇率变了，已付款的订单不改价。超过 Le 13,500 的订单先用移动货币付 30% 定金，72 小时内银行转账付余款。余款没到，定金全额退回。",
      "Le prix se bloque au paiement. Un taux plus tard ne change pas une commande payée. Au-dessus de Le 13 500 : 30 % d'acompte, le reste par virement sous 72 heures. Sans le solde, l'acompte revient en entier."],
  ];
  help.forEach((h, i) => {
    put("posts", { kind: "help", slug: h[0], title_en: h[1], title_zh: h[2], title_fr: h[3], body_en: h[4], body_zh: h[5], body_fr: h[6], published: 1, sort: i });
  });

  const unbox = [
    ["Kettle weighed at Kissy", "基西仓称过的水壶", "Bouilloire pesée à Kissy", "The carton matched the sheet. Seal intact.", "纸箱和单据一致，封条完好。", "Le carton correspond à la fiche. Scellé intact."],
    ["Solar lamp, first batch", "太阳能灯第一批", "Lampe solaire, premier lot", "Opened one unit. Bulb and panel both work.", "拆了一件。灯和板都能用。", "Une pièce ouverte. Ampoule et panneau marchent."],
    ["Cable carton count", "数据线清点", "Comptage des câbles", "Forty pieces. None missing from the packing list.", "四十件，装箱单没有少。", "Quarante pièces. Rien ne manque."],
  ];
  unbox.forEach((u, i) => {
    put("posts", {
      kind: "unbox",
      slug: `unbox-${i + 1}`,
      title_en: u[0],
      title_zh: u[1],
      title_fr: u[2],
      body_en: u[3],
      body_zh: u[4],
      body_fr: u[5],
      image: `/photos/home-${(i % 3) + 1}.jpg`,
      published: 1,
      sort: i,
    });
  });

  const liveId = put("posts", {
    kind: "live",
    slug: "kissy-friday",
    title_en: "Friday count at Kissy",
    title_zh: "周五基西清点",
    title_fr: "Comptage du vendredi à Kissy",
    body_en: "A recorded walk through the shelves. Tap a product to add it.",
    body_zh: "仓库货架的录像。点商品就能加购。",
    body_fr: "Une vidéo des rayons. Touchez un article pour l'ajouter.",
    image: "/photos/wh-1.jpg",
    video: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    published: 1,
    sort: 0,
    meta_json: JSON.stringify({ starts: "Friday 16:00 Africa/Freetown", host: BRAND.agent }),
  });
  [ids["PHONE-CABLE"], ids["SOLAR-LAMP"], ids["BEAUTY-BRUSH"], ids["HOME-FAN"]].forEach((productId, sort) => {
    put("live_products", { post_id: liveId, product_id: productId, sort });
  });

  const quoteOf = (sku: string) => {
    const row = db.prepare("SELECT * FROM products WHERE id = ?").get(ids[sku]) as {
      purchase_cny_fen: number; domestic_usd_cents: number; wh_usd_cents: number; dest_usd_cents: number; duty_bps: number;
      margin_bps: number; weight_g: number; length_cm: number; width_cm: number; height_cm: number; zone: string; title_en: string; sku: string;
    };
    const q = quoteSku(
      {
        purchaseCnyFen: row.purchase_cny_fen,
        domesticUsdCents: row.domestic_usd_cents,
        whUsdCents: row.wh_usd_cents,
        destUsdCents: row.dest_usd_cents,
        dutyBps: row.duty_bps,
        marginBps: row.margin_bps,
        weightG: row.weight_g,
        lengthCm: row.length_cm,
        widthCm: row.width_cm,
        heightCm: row.height_cm,
        zone: row.zone === "instock" ? "instock" : "preorder",
      },
      SEED_FX,
      FREIGHT,
    );
    return { row, q, shown: presentSplit(row.zone === "instock" ? "instock" : "preorder", q) };
  };

  let payN = 1000;
  const place = (opts: {
    userId: number;
    sku: string;
    qty: number;
    status: string;
    hoursAgo: number;
    code?: string;
    container?: number;
    cm3?: number;
    bl?: string;
    split?: boolean;
  }) => {
    const { row, q, shown } = quoteOf(opts.sku);
    const zone = row.zone === "instock" ? "instock" : "preorder";
    const goods = shown.goods * opts.qty;
    const intl = zone === "instock" ? 0 : shown.intl * opts.qty;
    const total = goods + intl;
    const created = addHours(nowIso(), -opts.hoursAgo);
    const locked = opts.status !== "PENDING_PAYMENT";
    const split = Boolean(opts.split);
    const deposit = split ? Math.round(total * 0.3) : total;
    const groupId = put("payment_groups", {
      user_id: opts.userId,
      number: `PG-26-${payN}`,
      purpose: "order",
      total_sle: total,
      charged_sle: split ? deposit : total,
      method: locked ? "orange" : null,
      status: locked ? "success" : "pending",
      external_ref: locked ? `DEMO-PAY-${payN}` : null,
      raw_json: JSON.stringify({ walletSle: 0, lang: "en", methods: ["orange"] }),
      created_at: created,
    });
    const orderId = put("orders", {
      number: `LD-26-${payN}`,
      user_id: opts.userId,
      group_id: groupId,
      zone,
      source: "catalog",
      status: opts.status,
      shipping_method: "pickup",
      pickup_point_id: kissy,
      freight_mode: "sea",
      fx_sle_per_usd_e4: SEED_FX.slePerUsdE4,
      fx_usd_cny_e4: SEED_FX.usdCnyE4,
      fx_buffer_bps: SEED_FX.bufferBps,
      goods_sle: goods,
      intl_sle: intl,
      delivery_sle: 0,
      air_delta_sle: 0,
      total_sle: total,
      buffer_sle: locked && !split ? Math.round((total * SEED_FX.bufferBps) / 10000) : 0,
      wallet_sle: 0,
      pay_mode: split ? "split" : "full",
      deposit_sle: deposit,
      balance_sle: split ? total - deposit : 0,
      deposit_paid: locked ? 1 : 0,
      balance_paid: locked && !split ? 1 : 0,
      balance_due_at: split ? addHours(nowIso(), 70) : null,
      price_locked: locked ? 1 : 0,
      pickup_code: opts.code || null,
      created_at: created,
      paid_at: locked ? created : null,
    });
    put("order_items", {
      order_id: orderId,
      product_id: ids[opts.sku],
      title: row.title_en,
      sku: row.sku,
      qty: opts.qty,
      unit_sle: shown.shelf,
      unit_goods_sle: shown.goods,
      unit_intl_sle: zone === "instock" ? 0 : shown.intl,
      snapshot_json: JSON.stringify(q),
    });
    if (locked) {
      put("payments", {
        group_id: groupId,
        order_id: orderId,
        user_id: opts.userId,
        purpose: "order",
        method: "orange",
        amount_sle: split ? deposit : total,
        status: "success",
        external_ref: `DEMO-PAY-${payN}`,
        created_at: created,
      });
    }
    const flow: readonly string[] = zone === "instock" ? INSTOCK_FLOW : PREORDER_FLOW;
    const target = opts.status === "DEPOSIT_HELD" ? "PAID" : opts.status;
    const idx = Math.max(0, flow.indexOf(target));
    const steps = opts.status === "DEPOSIT_HELD" ? ["PENDING_PAYMENT", "DEPOSIT_HELD"] : flow.slice(0, idx + 1);
    steps.forEach((status, i) => {
      put("order_events", {
        order_id: orderId,
        status,
        note: status === "SHIPPED" && opts.bl ? `B/L ${opts.bl}` : null,
        evidence_url: status === "PROCURED" || status === "IN_CN_WH" ? "/photos/wh-1.jpg" : null,
        actor: "seed",
        created_at: addHours(created, i * 6),
      });
    });
    if (opts.container) put("container_lines", { container_id: opts.container, order_id: orderId, cm3: opts.cm3 || q.billCm3 * opts.qty });
    payN += 1;
    return orderId;
  };

  const seaBox = put("containers", { code: "CT-2026-42", week_label: "12 Oct 2026", status: "on_sea", target_cm3: 6_000_000, rollover_count: 0, bl_no: "MSCU4829137", created_at: addHours(nowIso(), -240) });
  const openBox = put("containers", { code: "CT-2026-43", week_label: weekLabel(), status: "open", target_cm3: 6_000_000, rollover_count: 0, created_at: addHours(nowIso(), -48) });

  place({ userId: aminata, sku: "PHONE-CABLE", qty: 1, status: "COMPLETED", hoursAgo: 240, code: "110028" });
  place({ userId: aminata, sku: "HOME-FAN", qty: 1, status: "READY", hoursAgo: 20, code: "482913" });
  place({ userId: aminata, sku: "PHONE-NECK", qty: 1, status: "SHIPPED", hoursAgo: 160, container: seaBox, bl: "MSCU4829137" });
  place({ userId: aminata, sku: "HOME-IRON", qty: 1, status: "PAID", hoursAgo: 6 });
  const tyre = quoteOf("MOTO-TYRE");
  place({ userId: mohamed, sku: "MOTO-TYRE", qty: 16, status: "CONSOLIDATED", hoursAgo: 36, container: openBox, cm3: tyre.q.billCm3 * 16 });
  const solar = quoteOf("SOLAR-KIT");
  const solarQty = Math.max(2, Math.ceil(14000 / solar.shown.shelf));
  place({ userId: aminata, sku: "SOLAR-KIT", qty: solarQty, status: "DEPOSIT_HELD", hoursAgo: 5, split: true });

  put("seller_apps", {
    shop_name: "Lumley Gadgets",
    owner_name: "Sia Kallon",
    phone: "+23276111999",
    email: "sia@example.com",
    category: "Phone accessories",
    city: "Freetown",
    doc_note: "Business registration scan on file",
    status: "submitted",
    created_at: addHours(nowIso(), -10),
  });
  put("messages", {
    user_id: aminata,
    channel: "whatsapp",
    template_key: "paid",
    body: "How di body, Aminata. Payment received — price locked.",
    status: "sent",
    popup: 0,
    created_at: addHours(nowIso(), -200),
    read_at: addHours(nowIso(), -199),
  });
}
