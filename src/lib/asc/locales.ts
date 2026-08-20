export const LOCALE_NAMES: Record<string, string> = {
  "ar-SA": "Arabic",
  "ca": "Catalan",
  "zh-Hans": "Simplified Chinese",
  "zh-Hant": "Traditional Chinese",
  "hr": "Croatian",
  "cs": "Czech",
  "da": "Danish",
  "nl-NL": "Dutch",
  "en-AU": "English (Australia)",
  "en-CA": "English (Canada)",
  "en-GB": "English (UK)",
  "en-US": "English (US)",
  "fi": "Finnish",
  "fr-CA": "French (Canada)",
  "fr-FR": "French (France)",
  "de-DE": "German",
  "el": "Greek",
  "he": "Hebrew",
  "hi": "Hindi",
  "hu": "Hungarian",
  "id": "Indonesian",
  "it": "Italian",
  "ja": "Japanese",
  "ko": "Korean",
  "ms": "Malay",
  "no": "Norwegian",
  "pl": "Polish",
  "pt-BR": "Portuguese (Brazil)",
  "pt-PT": "Portuguese (Portugal)",
  "ro": "Romanian",
  "ru": "Russian",
  "sk": "Slovak",
  "es-MX": "Spanish (Mexico)",
  "es-ES": "Spanish (Spain)",
  "sv": "Swedish",
  "th": "Thai",
  "tr": "Turkish",
  "uk": "Ukrainian",
  "vi": "Vietnamese",
};

export function localeName(code: string): string {
  return LOCALE_NAMES[code] ?? code;
}

/**
 * Two-letter ISO country code that best represents an ASC locale.
 * For locales without a region suffix we pick the canonical country
 * (e.g. `tr` → TR, `ja` → JP). Used to render flag emojis.
 */
const LOCALE_COUNTRY: Record<string, string> = {
  "ar-SA": "SA",
  ca: "ES", // Catalan ≈ Spain (or Andorra)
  "zh-Hans": "CN",
  "zh-Hant": "TW",
  hr: "HR",
  cs: "CZ",
  da: "DK",
  "nl-NL": "NL",
  "en-AU": "AU",
  "en-CA": "CA",
  "en-GB": "GB",
  "en-US": "US",
  fi: "FI",
  "fr-CA": "CA",
  "fr-FR": "FR",
  "de-DE": "DE",
  el: "GR",
  he: "IL",
  hi: "IN",
  hu: "HU",
  id: "ID",
  it: "IT",
  ja: "JP",
  ko: "KR",
  ms: "MY",
  no: "NO",
  pl: "PL",
  "pt-BR": "BR",
  "pt-PT": "PT",
  ro: "RO",
  ru: "RU",
  sk: "SK",
  "es-MX": "MX",
  "es-ES": "ES",
  sv: "SE",
  th: "TH",
  tr: "TR",
  uk: "UA",
  vi: "VN",
};

function countryToFlag(country: string): string {
  if (!/^[A-Z]{2}$/.test(country)) return "🏳️";
  const base = 0x1f1e6; // 🇦
  return String.fromCodePoint(
    base + (country.charCodeAt(0) - 65),
    base + (country.charCodeAt(1) - 65),
  );
}

/**
 * Flag emoji for an ASC locale code. Falls back to a white flag for
 * unknown codes. Renders via OS/browser regional indicator sequences.
 */
export function localeFlag(code: string): string {
  const explicit = LOCALE_COUNTRY[code];
  if (explicit) return countryToFlag(explicit);
  // Best-effort: split on `-` and take the region segment.
  const parts = code.split("-");
  const region = parts[1]?.toUpperCase();
  if (region && /^[A-Z]{2}$/.test(region)) return countryToFlag(region);
  return "🏳️";
}

/**
 * Order locales for display: primary first (default `en-US`), then
 * alphabetical by human-readable name. Stable for unknown codes.
 */
export function sortLocaleCodes(codes: string[], primary = "en-US"): string[] {
  const collator = new Intl.Collator(undefined, { sensitivity: "base" });
  return [...codes].sort((a, b) => {
    if (a === primary && b !== primary) return -1;
    if (b === primary && a !== primary) return 1;
    return collator.compare(localeName(a), localeName(b));
  });
}

/**
 * Sort a list of localization records by `attributes.locale` using the
 * same ordering as `sortLocaleCodes`. Returns a new array.
 */
export function sortLocalizations<T extends { attributes?: { locale?: string } }>(
  list: T[],
  primary = "en-US",
): T[] {
  const collator = new Intl.Collator(undefined, { sensitivity: "base" });
  return [...list].sort((a, b) => {
    const ca = a.attributes?.locale ?? "";
    const cb = b.attributes?.locale ?? "";
    if (ca === primary && cb !== primary) return -1;
    if (cb === primary && ca !== primary) return 1;
    return collator.compare(localeName(ca), localeName(cb));
  });
}
