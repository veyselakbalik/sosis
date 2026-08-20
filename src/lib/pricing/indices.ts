/**
 * Static economic indices for price localization.
 * Big Mac index — USD price of a Big Mac in each country (The Economist, ~2024).
 * PPP — purchasing power parity vs USD (World Bank, ~2023).
 * Netflix — basic monthly subscription USD-equivalent (~2024).
 *
 * Territory codes follow ISO 3166-1 alpha-2 (ASC's territory IDs match).
 */

export type IndexType = "bigmac" | "ppp" | "netflix";

interface TerritoryIndex {
  bigmac?: number;   // local Big Mac price in USD
  ppp?: number;      // PPP factor (1.0 = US baseline). Higher = more expensive than US.
  netflix?: number;  // USD/mo basic plan
}

interface TerritoryFull extends TerritoryIndex {
  name: string;
  currency: string;
  /** How many local-currency units equal 1 USD at current FX rate. */
  fx: number;
}

// FX rates and indices are approximate end-of-2024 / early-2025 values.
// They are used as a sanity baseline for price localization suggestions;
// the developer always reviews & can hand-edit before applying.
export const INDICES: Record<string, TerritoryFull> = {
  USA: { name: "United States", currency: "USD", fx: 1,       bigmac: 5.69, ppp: 1.00, netflix: 6.99 },
  CAN: { name: "Canada",        currency: "CAD", fx: 1.37,    bigmac: 5.25, ppp: 0.83, netflix: 7.34 },
  MEX: { name: "Mexico",        currency: "MXN", fx: 17,      bigmac: 4.13, ppp: 0.55, netflix: 5.10 },
  BRA: { name: "Brazil",        currency: "BRL", fx: 5.0,     bigmac: 4.06, ppp: 0.51, netflix: 3.40 },
  ARG: { name: "Argentina",     currency: "ARS", fx: 1000,    bigmac: 4.27, ppp: 0.43, netflix: 2.50 },
  CHL: { name: "Chile",         currency: "CLP", fx: 950,     bigmac: 4.55, ppp: 0.56, netflix: 4.65 },
  COL: { name: "Colombia",      currency: "COP", fx: 4100,    bigmac: 3.80, ppp: 0.41, netflix: 4.10 },
  GBR: { name: "United Kingdom", currency: "GBP", fx: 0.79,   bigmac: 5.30, ppp: 0.83, netflix: 8.90 },
  DEU: { name: "Germany",       currency: "EUR", fx: 0.93,    bigmac: 5.39, ppp: 0.93, netflix: 8.45 },
  FRA: { name: "France",        currency: "EUR", fx: 0.93,    bigmac: 5.39, ppp: 0.93, netflix: 9.50 },
  ITA: { name: "Italy",         currency: "EUR", fx: 0.93,    bigmac: 5.30, ppp: 0.83, netflix: 8.45 },
  ESP: { name: "Spain",         currency: "EUR", fx: 0.93,    bigmac: 5.20, ppp: 0.78, netflix: 8.40 },
  NLD: { name: "Netherlands",   currency: "EUR", fx: 0.93,    bigmac: 5.50, ppp: 0.95, netflix: 8.40 },
  IRL: { name: "Ireland",       currency: "EUR", fx: 0.93,    bigmac: 5.40, ppp: 0.95, netflix: 9.40 },
  AUT: { name: "Austria",       currency: "EUR", fx: 0.93,    bigmac: 5.30, ppp: 0.92, netflix: 8.45 },
  PRT: { name: "Portugal",      currency: "EUR", fx: 0.93,    bigmac: 4.90, ppp: 0.70, netflix: 7.85 },
  GRC: { name: "Greece",        currency: "EUR", fx: 0.93,    bigmac: 4.50, ppp: 0.66, netflix: 8.45 },
  CHE: { name: "Switzerland",   currency: "CHF", fx: 0.88,    bigmac: 7.20, ppp: 1.21, netflix: 11.20 },
  NOR: { name: "Norway",        currency: "NOK", fx: 10.7,    bigmac: 6.80, ppp: 1.10, netflix: 11.50 },
  SWE: { name: "Sweden",        currency: "SEK", fx: 10.4,    bigmac: 6.20, ppp: 1.04, netflix: 8.30 },
  DNK: { name: "Denmark",       currency: "DKK", fx: 6.9,     bigmac: 6.10, ppp: 1.07, netflix: 9.80 },
  FIN: { name: "Finland",       currency: "EUR", fx: 0.93,    bigmac: 5.50, ppp: 0.93, netflix: 8.45 },
  POL: { name: "Poland",        currency: "PLN", fx: 4.0,     bigmac: 3.66, ppp: 0.42, netflix: 5.80 },
  CZE: { name: "Czechia",       currency: "CZK", fx: 23,      bigmac: 4.20, ppp: 0.50, netflix: 5.60 },
  HUN: { name: "Hungary",       currency: "HUF", fx: 360,     bigmac: 3.45, ppp: 0.40, netflix: 5.40 },
  ROU: { name: "Romania",       currency: "RON", fx: 4.6,     bigmac: 3.10, ppp: 0.34, netflix: 5.30 },
  TUR: { name: "Turkey",        currency: "TRY", fx: 35,      bigmac: 2.04, ppp: 0.45, netflix: 2.99 },
  RUS: { name: "Russia",        currency: "RUB", fx: 90,      bigmac: 2.31, ppp: 0.26, netflix: 2.60 },
  UKR: { name: "Ukraine",       currency: "UAH", fx: 41,      bigmac: 2.65, ppp: 0.27, netflix: 4.60 },
  JPN: { name: "Japan",         currency: "JPY", fx: 150,     bigmac: 3.20, ppp: 0.78, netflix: 6.85 },
  KOR: { name: "South Korea",   currency: "KRW", fx: 1330,    bigmac: 4.95, ppp: 0.78, netflix: 5.95 },
  CHN: { name: "China",         currency: "CNY", fx: 7.2,     bigmac: 3.50, ppp: 0.47, netflix: 0 },
  HKG: { name: "Hong Kong",     currency: "HKD", fx: 7.8,     bigmac: 3.10, ppp: 0.74, netflix: 8.40 },
  TWN: { name: "Taiwan",        currency: "TWD", fx: 32,      bigmac: 2.90, ppp: 0.45, netflix: 8.00 },
  SGP: { name: "Singapore",     currency: "SGD", fx: 1.35,    bigmac: 4.70, ppp: 0.85, netflix: 8.50 },
  MYS: { name: "Malaysia",      currency: "MYR", fx: 4.7,     bigmac: 2.65, ppp: 0.38, netflix: 5.20 },
  THA: { name: "Thailand",      currency: "THB", fx: 35,      bigmac: 3.85, ppp: 0.36, netflix: 4.00 },
  IDN: { name: "Indonesia",     currency: "IDR", fx: 16000,   bigmac: 2.90, ppp: 0.32, netflix: 3.80 },
  PHL: { name: "Philippines",   currency: "PHP", fx: 56,      bigmac: 3.10, ppp: 0.32, netflix: 3.50 },
  VNM: { name: "Vietnam",       currency: "VND", fx: 24500,   bigmac: 3.10, ppp: 0.29, netflix: 3.20 },
  IND: { name: "India",         currency: "INR", fx: 84,      bigmac: 2.55, ppp: 0.26, netflix: 1.95 },
  AUS: { name: "Australia",     currency: "AUD", fx: 1.55,    bigmac: 4.85, ppp: 0.92, netflix: 7.95 },
  NZL: { name: "New Zealand",   currency: "NZD", fx: 1.65,    bigmac: 5.10, ppp: 0.91, netflix: 7.40 },
  ARE: { name: "UAE",           currency: "AED", fx: 3.67,    bigmac: 4.90, ppp: 0.79, netflix: 7.60 },
  SAU: { name: "Saudi Arabia",  currency: "SAR", fx: 3.75,    bigmac: 4.80, ppp: 0.62, netflix: 6.40 },
  ISR: { name: "Israel",        currency: "ILS", fx: 3.7,     bigmac: 5.30, ppp: 0.95, netflix: 8.20 },
  EGY: { name: "Egypt",         currency: "EGP", fx: 49,      bigmac: 2.45, ppp: 0.20, netflix: 4.40 },
  ZAF: { name: "South Africa",  currency: "ZAR", fx: 18,      bigmac: 2.32, ppp: 0.38, netflix: 5.20 },
  NGA: { name: "Nigeria",       currency: "NGN", fx: 1600,    bigmac: 2.10, ppp: 0.30, netflix: 2.20 },
  KEN: { name: "Kenya",         currency: "KES", fx: 130,     bigmac: 2.30, ppp: 0.34, netflix: 5.90 },
};

export function indexValue(territory: string, type: IndexType): number | null {
  const t = INDICES[territory];
  if (!t) return null;
  const v = t[type];
  return typeof v === "number" && v > 0 ? v : null;
}

/**
 * Compute a suggested USD-equivalent for `target` based on `base` price (in
 * base territory's local currency) and a chosen economic index.
 *
 *   target_local_value_in_USD = base_USD × (target_index / base_index)
 *
 * Use `suggestLocalPrice` for the actual local-currency amount (with FX).
 */
export function suggestPrice(
  basePriceUsd: number,
  baseTerritory: string,
  targetTerritory: string,
  index: IndexType,
): number | null {
  const baseIdx = indexValue(baseTerritory, index);
  const targetIdx = indexValue(targetTerritory, index);
  if (!baseIdx || !targetIdx) return null;
  return basePriceUsd * (targetIdx / baseIdx);
}

/**
 * Compute the suggested price IN THE TARGET TERRITORY'S LOCAL CURRENCY.
 *
 *   target_local_price = base_USD × (target_index / base_index) × target_fx
 *
 * `base_USD` is the base price already normalized to USD. If the base price
 * is in a non-USD currency, convert it to USD first via the base territory's fx.
 */
export function suggestLocalPrice(
  baseUsd: number,
  baseTerritory: string,
  targetTerritory: string,
  index: IndexType,
): { localPrice: number; usdEquivalent: number } | null {
  const ratio = (() => {
    const b = indexValue(baseTerritory, index);
    const t = indexValue(targetTerritory, index);
    return b && t ? t / b : null;
  })();
  if (ratio == null) return null;
  const targetFx = INDICES[targetTerritory]?.fx;
  if (!targetFx) return null;
  const usdEquivalent = baseUsd * ratio;
  const localPrice = usdEquivalent * targetFx;
  return { localPrice, usdEquivalent };
}

/**
 * Convert a price in a territory's local currency to its USD equivalent
 * via the FX rate.
 */
export function localToUsd(price: number, territory: string): number | null {
  const fx = INDICES[territory]?.fx;
  if (!fx || fx <= 0) return null;
  return price / fx;
}

export function snapToNearest(target: number, candidates: number[]): number | null {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  let bestDiff = Math.abs(candidates[0] - target);
  for (let i = 1; i < candidates.length; i++) {
    const diff = Math.abs(candidates[i] - target);
    if (diff < bestDiff) { best = candidates[i]; bestDiff = diff; }
  }
  return best;
}

export const TERRITORY_KEYS = Object.keys(INDICES);
