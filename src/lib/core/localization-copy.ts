import {
  LOCALIZATION_FIELDS,
  type LocalizationField,
  type LocalizationPatch,
} from "./localization-changes";

export interface CopyLocalizationRecord {
  id: string;
  locale: string;
  attributes: Partial<Record<LocalizationField, string | null | undefined>>;
}

export interface LocalizationCopyUpdate {
  localizationId: string;
  locale: string;
  attributes: LocalizationPatch;
}

export interface LocalizationCopySkip {
  locale: string;
  reason: "SOURCE_LOCALE_NOT_FOUND" | "TARGET_LOCALE_NOT_FOUND" | "NO_SOURCE_FIELDS";
}

export function buildLocalizationCopyUpdates(input: {
  source: CopyLocalizationRecord[];
  target: CopyLocalizationRecord[];
  fields?: string[];
  locales?: string[];
}): { updates: LocalizationCopyUpdate[]; skipped: LocalizationCopySkip[]; fields: LocalizationField[] } {
  const requestedFields = input.fields ?? [...LOCALIZATION_FIELDS];
  const fields = requestedFields.map((field) => {
    if (!LOCALIZATION_FIELDS.includes(field as LocalizationField)) {
      throw new Error(`UNSUPPORTED_LOCALIZATION_FIELD:${field}`);
    }
    return field as LocalizationField;
  });
  if (fields.length === 0) throw new Error("EMPTY_LOCALIZATION_FIELD_SELECTION");
  if (new Set(fields).size !== fields.length) throw new Error("DUPLICATE_LOCALIZATION_FIELD");

  const sourceByLocale = new Map(input.source.map((record) => [record.locale, record]));
  const targetByLocale = new Map(input.target.map((record) => [record.locale, record]));
  const locales = input.locales ?? input.source.map((record) => record.locale);
  if (new Set(locales).size !== locales.length) throw new Error("DUPLICATE_LOCALE_SELECTION");

  const updates: LocalizationCopyUpdate[] = [];
  const skipped: LocalizationCopySkip[] = [];
  for (const locale of locales) {
    const source = sourceByLocale.get(locale);
    if (!source) {
      skipped.push({ locale, reason: "SOURCE_LOCALE_NOT_FOUND" });
      continue;
    }
    const target = targetByLocale.get(locale);
    if (!target) {
      skipped.push({ locale, reason: "TARGET_LOCALE_NOT_FOUND" });
      continue;
    }

    const attributes: LocalizationPatch = {};
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(source.attributes, field)) {
        const value = source.attributes[field];
        if (value !== undefined) attributes[field] = value;
      }
    }
    if (Object.keys(attributes).length === 0) {
      skipped.push({ locale, reason: "NO_SOURCE_FIELDS" });
      continue;
    }
    updates.push({ localizationId: target.id, locale, attributes });
  }

  return { updates, skipped, fields };
}
