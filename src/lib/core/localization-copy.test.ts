import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalizationCopyUpdates } from "./localization-copy";

test("maps exact metadata from an older version by locale", () => {
  const result = buildLocalizationCopyUpdates({
    source: [
      { id: "old-en", locale: "en-US", attributes: { keywords: "old,good", description: "Old description" } },
      { id: "old-tr", locale: "tr", attributes: { keywords: "eski,iyi", description: "Eski açıklama" } },
    ],
    target: [
      { id: "new-en", locale: "en-US", attributes: { keywords: "bad" } },
      { id: "new-tr", locale: "tr", attributes: { keywords: "kötü" } },
    ],
    fields: ["keywords", "description"],
  });

  assert.deepEqual(result.updates, [
    {
      localizationId: "new-en",
      locale: "en-US",
      attributes: { keywords: "old,good", description: "Old description" },
    },
    {
      localizationId: "new-tr",
      locale: "tr",
      attributes: { keywords: "eski,iyi", description: "Eski açıklama" },
    },
  ]);
  assert.deepEqual(result.skipped, []);
});

test("reports missing locale matches without creating unsafe updates", () => {
  const result = buildLocalizationCopyUpdates({
    source: [{ id: "old-en", locale: "en-US", attributes: { keywords: "old" } }],
    target: [{ id: "new-tr", locale: "tr", attributes: { keywords: "new" } }],
    locales: ["en-US", "de-DE"],
    fields: ["keywords"],
  });
  assert.deepEqual(result.updates, []);
  assert.deepEqual(result.skipped, [
    { locale: "en-US", reason: "TARGET_LOCALE_NOT_FOUND" },
    { locale: "de-DE", reason: "SOURCE_LOCALE_NOT_FOUND" },
  ]);
});

test("rejects unsupported fields", () => {
  assert.throws(() => buildLocalizationCopyUpdates({
    source: [],
    target: [],
    fields: ["name"],
  }), /UNSUPPORTED_LOCALIZATION_FIELD/);
});
