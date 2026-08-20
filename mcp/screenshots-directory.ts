import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export type ScreenshotDirectoryLayout = "display-locale" | "locale-display";

export interface ScreenshotDirectoryLocale {
  id: string;
  locale: string;
}

export interface ScreenshotDirectoryFile {
  path: string;
  fileName: string;
  size: number;
}

export interface ScreenshotDirectoryItem {
  displayFolder: string;
  localeFolder: string;
  displayType: string;
  localizationId: string;
  locale: string;
  files: ScreenshotDirectoryFile[];
}

export interface ScreenshotDirectoryPlan {
  rootDir: string;
  layout: ScreenshotDirectoryLayout;
  items: ScreenshotDirectoryItem[];
  skipped: Array<{ path: string; reason: string }>;
  warnings: string[];
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const naturalSort = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const displayAliases = new Map<string, string>();

export function supportedScreenshotDisplayTypes(): string[] {
  return [...new Set(displayAliases.values())].sort();
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function addDisplayType(type: string, aliases: string[]): void {
  displayAliases.set(normalizeKey(type), type);
  for (const alias of aliases) displayAliases.set(normalizeKey(alias), type);
}

addDisplayType("APP_IPHONE_69", ["iphone 6.9", "iphone 6.9 inch", "iphone 6.9 inches", "iphone 69"]);
addDisplayType("APP_IPHONE_67", ["iphone 6.7", "iphone 6.7 inch", "iphone 6.7 inches", "iphone 67"]);
addDisplayType("APP_IPHONE_65", ["iphone 6.5", "iphone 6.5 inch", "iphone 6.5 inches", "iphone 65"]);
addDisplayType("APP_IPHONE_61", ["iphone 6.1", "iphone 6.1 inch", "iphone 6.1 inches", "iphone 61"]);
addDisplayType("APP_IPHONE_58", ["iphone 5.8", "iphone 5.8 inch", "iphone 5.8 inches", "iphone 58"]);
addDisplayType("APP_IPHONE_55", ["iphone 5.5", "iphone 5.5 inch", "iphone 5.5 inches", "iphone 55"]);
addDisplayType("APP_IPHONE_47", ["iphone 4.7", "iphone 4.7 inch", "iphone 4.7 inches", "iphone 47"]);
addDisplayType("APP_IPHONE_40", ["iphone 4", "iphone 4.0", "iphone 4 inch", "iphone 40"]);
addDisplayType("APP_IPHONE_35", ["iphone 3.5", "iphone 3.5 inch", "iphone 3.5 inches", "iphone 35"]);
addDisplayType("APP_IPAD_PRO_3GEN_129", ["ipad pro 12.9 3rd", "ipad pro 12.9 3rd gen", "ipad pro 12.9 3rd generation", "ipad pro 12.9 3gen"]);
addDisplayType("APP_IPAD_PRO_129", ["ipad pro 12.9", "ipad 12.9", "ipad 12.9 inch"]);
addDisplayType("APP_IPAD_PRO_3GEN_11", ["ipad pro 11", "ipad 11", "ipad pro 11 inch"]);
addDisplayType("APP_IPAD_105", ["ipad 10.5", "ipad 10.5 inch"]);
addDisplayType("APP_IPAD_97", ["ipad 9.7", "ipad 9.7 inch"]);
addDisplayType("APP_DESKTOP", ["mac", "macos", "desktop"]);
addDisplayType("APP_APPLE_TV", ["apple tv", "appletv", "tvos", "tv"]);
addDisplayType("APP_APPLE_VISION_PRO", ["vision pro", "apple vision pro", "visionos"]);
addDisplayType("APP_WATCH_ULTRA", ["watch ultra", "apple watch ultra"]);
addDisplayType("APP_WATCH_SERIES_10", ["watch series 10", "apple watch series 10", "watch s10"]);
addDisplayType("APP_WATCH_SERIES_7", ["watch series 7", "apple watch series 7", "watch s7"]);
addDisplayType("APP_WATCH_SERIES_4", ["watch series 4", "watch series 5", "watch series 6", "watch s4", "watch s5", "watch s6"]);
addDisplayType("APP_WATCH_SERIES_3", ["watch series 3", "apple watch series 3", "watch s3"]);

const localeAliases: Record<string, string[]> = {
  english: ["en-US", "en-GB", "en-AU", "en-CA"],
  usenglish: ["en-US"],
  americanenglish: ["en-US"],
  britishenglish: ["en-GB"],
  turkish: ["tr"],
  turkce: ["tr"],
  german: ["de-DE"],
  deutsch: ["de-DE"],
  french: ["fr-FR", "fr-CA"],
  canadianfrench: ["fr-CA"],
  spanish: ["es-ES", "es-MX"],
  mexicanspanish: ["es-MX"],
  italian: ["it"],
  portuguese: ["pt-BR", "pt-PT"],
  brazilianportuguese: ["pt-BR"],
  japanese: ["ja"],
  korean: ["ko"],
  chinese: ["zh-Hans", "zh-Hant"],
  simplifiedchinese: ["zh-Hans"],
  traditionalchinese: ["zh-Hant"],
  arabic: ["ar-SA"],
  dutch: ["nl-NL"],
  danish: ["da"],
  finnish: ["fi"],
  norwegian: ["no"],
  swedish: ["sv"],
  russian: ["ru"],
  polish: ["pl"],
  ukrainian: ["uk"],
  indonesian: ["id"],
  malay: ["ms"],
  thai: ["th"],
  vietnamese: ["vi"],
  hindi: ["hi"],
  hebrew: ["he"],
  greek: ["el"],
  czech: ["cs"],
  hungarian: ["hu"],
  romanian: ["ro"],
  slovak: ["sk"],
  croatian: ["hr"],
  catalan: ["ca"],
};

function asOverrideMap(value: Record<string, string> | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(value ?? {})) {
    if (typeof k === "string" && typeof v === "string") map.set(normalizeKey(k), v);
  }
  return map;
}

function resolveDisplayType(folderName: string, overrides: Map<string, string>): string | null {
  const direct = folderName.trim().toUpperCase();
  if (/^APP_[A-Z0-9_]+$/.test(direct)) return direct;
  const key = normalizeKey(folderName);
  return overrides.get(key) ?? displayAliases.get(key) ?? null;
}

function findLocaleByCode(code: string, locales: ScreenshotDirectoryLocale[]): ScreenshotDirectoryLocale | null {
  const normalized = normalizeKey(code);
  return locales.find((l) => l.locale.toLowerCase() === code.toLowerCase() || normalizeKey(l.locale) === normalized) ?? null;
}

function resolveLocale(
  folderName: string,
  locales: ScreenshotDirectoryLocale[],
  overrides: Map<string, string>,
): { locale?: ScreenshotDirectoryLocale; error?: string } {
  const key = normalizeKey(folderName);
  const override = overrides.get(key);
  if (override) {
    const found = findLocaleByCode(override, locales);
    return found ? { locale: found } : { error: `localeMap points "${folderName}" to "${override}", but that locale is not on this version` };
  }

  const direct = findLocaleByCode(folderName.trim(), locales);
  if (direct) return { locale: direct };

  const candidates = localeAliases[key] ?? [];
  const exactMatches = candidates
    .map((candidate) => findLocaleByCode(candidate, locales))
    .filter((l): l is ScreenshotDirectoryLocale => Boolean(l));
  if (exactMatches.length === 1) return { locale: exactMatches[0] };
  if (exactMatches.length > 1) {
    return { error: `"${folderName}" matches multiple locales (${exactMatches.map((l) => l.locale).join(", ")}); use a locale code or localeMap` };
  }

  const prefix = candidates[0]?.split("-")[0];
  if (prefix) {
    const prefixMatches = locales.filter((l) => l.locale.toLowerCase() === prefix || l.locale.toLowerCase().startsWith(`${prefix}-`));
    if (prefixMatches.length === 1) return { locale: prefixMatches[0] };
    if (prefixMatches.length > 1) {
      return { error: `"${folderName}" matches multiple locales (${prefixMatches.map((l) => l.locale).join(", ")}); use a locale code or localeMap` };
    }
  }

  return { error: `"${folderName}" does not match any locale on this version` };
}

async function readDirectories(dir: string): Promise<Array<{ name: string; path: string }>> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => ({ name: entry.name, path: path.join(dir, entry.name) }))
    .sort((a, b) => naturalSort.compare(a.name, b.name));
}

async function readImageFiles(dir: string): Promise<ScreenshotDirectoryFile[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => ({ name: entry.name, path: path.join(dir, entry.name) }))
    .sort((a, b) => naturalSort.compare(a.name, b.name));

  const withSizes: ScreenshotDirectoryFile[] = [];
  for (const file of files) {
    const info = await stat(file.path);
    withSizes.push({ path: file.path, fileName: file.name, size: info.size });
  }
  return withSizes;
}

export async function planScreenshotDirectoryUploads(input: {
  rootDir: string;
  layout: ScreenshotDirectoryLayout;
  locales: ScreenshotDirectoryLocale[];
  localeMap?: Record<string, string>;
  displayTypeMap?: Record<string, string>;
}): Promise<ScreenshotDirectoryPlan> {
  const rootDir = path.resolve(input.rootDir);
  const rootInfo = await stat(rootDir).catch(() => null);
  if (!rootInfo?.isDirectory()) throw new Error(`rootDir is not a directory: ${rootDir}`);

  const localeOverrides = asOverrideMap(input.localeMap);
  const displayOverrides = asOverrideMap(input.displayTypeMap);
  const skipped: ScreenshotDirectoryPlan["skipped"] = [];
  const warnings: string[] = [];
  const items: ScreenshotDirectoryItem[] = [];

  const firstLevel = await readDirectories(rootDir);
  for (const first of firstLevel) {
    if (input.layout === "display-locale") {
      const displayType = resolveDisplayType(first.name, displayOverrides);
      if (!displayType) {
        skipped.push({ path: first.path, reason: `"${first.name}" is not a known screenshot display type` });
        continue;
      }

      for (const second of await readDirectories(first.path)) {
        const resolved = resolveLocale(second.name, input.locales, localeOverrides);
        if (!resolved.locale) {
          skipped.push({ path: second.path, reason: resolved.error ?? `"${second.name}" is not a known locale` });
          continue;
        }
        const files = await readImageFiles(second.path);
        if (files.length === 0) {
          warnings.push(`No PNG/JPG files found in ${second.path}`);
          continue;
        }
        items.push({
          displayFolder: first.name,
          localeFolder: second.name,
          displayType,
          localizationId: resolved.locale.id,
          locale: resolved.locale.locale,
          files,
        });
      }
    } else {
      const resolved = resolveLocale(first.name, input.locales, localeOverrides);
      if (!resolved.locale) {
        skipped.push({ path: first.path, reason: resolved.error ?? `"${first.name}" is not a known locale` });
        continue;
      }

      for (const second of await readDirectories(first.path)) {
        const displayType = resolveDisplayType(second.name, displayOverrides);
        if (!displayType) {
          skipped.push({ path: second.path, reason: `"${second.name}" is not a known screenshot display type` });
          continue;
        }
        const files = await readImageFiles(second.path);
        if (files.length === 0) {
          warnings.push(`No PNG/JPG files found in ${second.path}`);
          continue;
        }
        items.push({
          displayFolder: second.name,
          localeFolder: first.name,
          displayType,
          localizationId: resolved.locale.id,
          locale: resolved.locale.locale,
          files,
        });
      }
    }
  }

  return { rootDir, layout: input.layout, items, skipped, warnings };
}
