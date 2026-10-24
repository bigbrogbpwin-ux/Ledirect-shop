/** Integer money. USD cents, CNY fen, SLE whole leones, rates scaled by 10_000. */

export function divRound(n: bigint, d: bigint): number {
  if (d === 0n) throw new Error("Division by zero");
  const neg = n < 0n !== d < 0n;
  const an = n < 0n ? -n : n;
  const ad = d < 0n ? -d : d;
  let q = an / ad;
  const r = an % ad;
  if (r * 2n >= ad) q += 1n;
  const out = neg ? -q : q;
  if (out > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Amount overflow");
  return Number(out);
}

export type Fx = { slePerUsdE4: number; usdCnyE4: number; bufferBps: number };

export type CostInput = {
  purchaseCnyFen: number;
  domesticUsdCents: number;
  whUsdCents: number;
  destUsdCents: number;
  dutyBps: number;
  marginBps: number;
  weightG: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  zone: "instock" | "preorder";
  marketingPriceSle?: number | null;
};

export type FreightSettings = {
  seaUsdCentsPerCbm: number;
  airUsdCentsPerKg: number;
  gstDeductible: boolean;
  gstBps: number;
  minPreorderCm3: number;
};

export type PriceQuote = {
  priceSle: number;
  goodsSle: number;
  intlSle: number;
  costSle: number;
  minMarketingSle: number;
  landedUsdCents: number;
  purchaseUsdCents: number;
  seaFreightUsdCents: number;
  airFreightUsdCents: number;
  airDeltaSle: number;
  dutyUsdCents: number;
  gstUsdCents: number;
  billCm3: number;
  chargeableG: number;
  usedMarketing: boolean;
};

export function quoteSku(input: CostInput, fx: Fx, freight: FreightSettings, air = false): PriceQuote {
  const rawCm3 = Math.max(0, input.lengthCm * input.widthCm * input.heightCm);
  const billCm3 = input.zone === "preorder" ? Math.max(rawCm3, freight.minPreorderCm3) : Math.max(rawCm3, 1);
  const seaFreightUsdCents = divRound(BigInt(billCm3) * BigInt(freight.seaUsdCentsPerCbm), 1_000_000n);
  const volG = divRound(BigInt(rawCm3), 6n);
  const chargeableG = Math.max(input.weightG, volG);
  const airFreightUsdCents = divRound(BigInt(chargeableG) * BigInt(freight.airUsdCentsPerKg), 1000n);
  const freightCents = air ? airFreightUsdCents : seaFreightUsdCents;

  const purchaseUsdCents = divRound(BigInt(input.purchaseCnyFen) * 10_000n, BigInt(fx.usdCnyE4));
  const goodsCost = purchaseUsdCents + input.domesticUsdCents + input.whUsdCents;
  const cif = goodsCost + freightCents;
  const dutyUsdCents = divRound(BigInt(cif) * BigInt(input.dutyBps), 10_000n);
  const gstUsdCents = freight.gstDeductible
    ? 0
    : divRound(BigInt(cif + dutyUsdCents) * BigInt(freight.gstBps), 10_000n);
  const intlCost = freightCents + dutyUsdCents + gstUsdCents + input.destUsdCents;
  const landed = BigInt(goodsCost + intlCost);

  const priceFromFormula = divRound(
    landed * BigInt(fx.slePerUsdE4) * BigInt(10_000 + input.marginBps),
    10_000_000_000n,
  );
  const costSle = divRound(landed * BigInt(fx.slePerUsdE4), 1_000_000n);
  const minMarketingSle = divRound(BigInt(costSle) * 105n, 100n);

  let priceSle = priceFromFormula;
  let usedMarketing = false;
  if (input.marketingPriceSle != null && input.marketingPriceSle > 0) {
    if (input.marketingPriceSle < minMarketingSle) {
      throw new Error(`Marketing price Le ${input.marketingPriceSle} is below the 5% floor (Le ${minMarketingSle}).`);
    }
    priceSle = input.marketingPriceSle;
    usedMarketing = true;
  }

  const base = goodsCost + intlCost;
  const goodsSle = base > 0 ? divRound(BigInt(priceSle) * BigInt(goodsCost), BigInt(base)) : priceSle;
  const intlSle = priceSle - goodsSle;

  const airExtraCents = BigInt(airFreightUsdCents - seaFreightUsdCents);
  const airDeltaSle = divRound(airExtraCents * BigInt(fx.slePerUsdE4) * BigInt(10_000 + input.marginBps), 10_000_000_000n);

  return {
    priceSle,
    goodsSle,
    intlSle,
    costSle,
    minMarketingSle,
    landedUsdCents: Number(landed),
    purchaseUsdCents,
    seaFreightUsdCents,
    airFreightUsdCents,
    airDeltaSle,
    dutyUsdCents,
    gstUsdCents,
    billCm3,
    chargeableG,
    usedMarketing,
  };
}

export function presentSplit(zone: "instock" | "preorder", q: PriceQuote, extraGoods = 0) {
  if (zone === "instock") {
    const shelf = q.priceSle + extraGoods;
    return { goods: shelf, intl: 0, shelf };
  }
  const goods = q.goodsSle + extraGoods;
  return { goods, intl: q.intlSle, shelf: goods + q.intlSle };
}

export function sleToUsdCents(sle: number, fx: Fx): number {
  return divRound(BigInt(sle) * 1_000_000n, BigInt(fx.slePerUsdE4));
}

export function usdCentsToSle(cents: number, fx: Fx): number {
  return divRound(BigInt(cents) * BigInt(fx.slePerUsdE4), 1_000_000n);
}

export const BANNED_PATTERNS: RegExp[] = [
  /\b(drug|medicine|pharma|antibiotic|tramadol|vaccine|syringe)\b/i,
  /\b(walkie|transmitter|baofeng|two-way radio|radio set)\b/i,
  /\b(used|refurbished|second[- ]hand)\b/i,
  /\b(nike|adidas|gucci|louis vuitton|iphone|apple watch|samsung galaxy|dyson|rolex)\b/i,
  /\b(medical device|blood pressure|oximeter|stethoscope)\b/i,
];

export function complianceHit(text: string): string | null {
  for (const re of BANNED_PATTERNS) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}
