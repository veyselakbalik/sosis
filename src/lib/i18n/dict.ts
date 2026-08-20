export type Locale = "en" | "tr" | "de" | "es" | "fr" | "ja";

export const LOCALES: Array<{ id: Locale; label: string; native: string }> = [
  { id: "en", label: "English", native: "English" },
  { id: "tr", label: "Turkish", native: "Türkçe" },
  { id: "de", label: "German", native: "Deutsch" },
  { id: "es", label: "Spanish", native: "Español" },
  { id: "fr", label: "French", native: "Français" },
  { id: "ja", label: "Japanese", native: "日本語" },
];

export const DEFAULT_LOCALE: Locale = "en";

export interface Messages {
  common: {
    save: string; cancel: string; delete: string; add: string; edit: string; close: string;
    loading: string; refresh: string; confirm: string; yes: string; no: string;
    saved: string; error: string; backToApps: string; back: string;
    optional: string; required: string; max: string; sending: string; applied: string;
    retry: string;
  };
  nav: {
    overview: string; apps: string; accounts: string;
  };
  dashboard: {
    welcome: string; subtitle: string; appsCard: string; appsDesc: string;
    accountsCard: string; accountsDesc: string; tipsTitle: string; tipMulti: string; tipLock: string;
    localTitle: string; localDesc: string; recentTitle: string; recentEmpty: string;
    restore: string; restored: string; restoreConfirm: string;
  };
  accounts: {
    title: string; subtitle: string; addAccount: string; newAccount: string; newAccountHelp: string;
    label: string; labelPh: string; issuerId: string; keyId: string; keyIdPh: string;
    privateKey: string; empty: string; emptyDesc: string; deleteConfirm: string;
    requireP8: string; addedAt: string;
    p8Invalid: string; p8DropHere: string; p8Reupload: string;
  };
  apps: {
    title: string; subtitle: string; empty: string; needAccount: string;
    goAccounts: string; loadFailed: string;
  };
  appTabs: {
    versions: string; testflight: string; metadata: string; reviews: string; subscriptions: string;
    release: string; testers: string; previews: string;
  };
  versions: {
    title: string; newVersion: string; empty: string; buildAttached: string; buildMissing: string;
    addBuild: string; changeBuild: string; submitReview: string; missingCompliance: string;
    suggestBuildFirst: string;
  };
  newVersion: {
    title: string; versionLabel: string; versionPh: string; versionFormatHint: string;
    platform: string; releaseType: string; afterApproval: string; manualRelease: string;
    scheduledRelease: string; scheduledDate: string; copyright: string; copyrightPh: string;
    create: string; creating: string;
  };
  attachBuild: {
    title: string; loading: string; noBuilds: string; noValid: string;
    valid: string; currentSelection: string; missingComp: string; complianceOk: string; nonExempt: string;
    hiddenBuilds: string; expired: string; processing: string; failed: string; invalid: string;
    complianceHeader: string; complianceDesc: string; complianceQuestion: string;
    exemptOption: string; exemptDesc: string; nonExemptOption: string; nonExemptDesc: string;
    save: string; saveWithComp: string; saving: string;
  };
  submitReview: {
    title: string; readyText: string;
    req1: string; req2: string; req3: string; req4: string;
    submit: string; submitting: string; sent: string; sentDesc: string;
    stepCreate: string; stepLink: string; stepSubmit: string;
  };
  testflight: {
    title: string; empty: string; whatToTest: string; close: string;
    noLocs: string; testNotesPh: string;
  };
  metadata: {
    title: string; version: string; locale: string; noVersions: string; loadingLocs: string;
    addLanguage: string; deleteLocalConfirm: string;
    description: string; whatsNew: string; keywords: string; keywordsHint: string;
    promotionalText: string; marketingUrl: string; supportUrl: string;
  };
  translateModal: {
    none: string; all: string;
  };
  addLocale: {
    title: string; searchPh: string; selected: string; available: string;
    addN: string; addNone: string;
    noResults: string; allAdded: string;
    completed: string; addedOk: string; addedErrors: string; waiting: string; cantDelete: string;
  };
  screenshots: {
    title: string; subtitle: string; refresh: string; loading: string;
    empty: string; imagesCount: string; pngJpgDrop: string; deleteConfirm: string;
    bulkButton: string; bulkTooltip: string; bulkTitle: string; bulkLocaleCount: string;
    bulkFolderHint: string; bulkChooseFolder: string; bulkReplace: string;
    bulkSetsCount: string; bulkFilesCount: string; bulkUploading: string;
    bulkUploadBtn: string; bulkUploadedOk: string; bulkIssues: string;
  };
  previews: {
    tabLabel: string; locale: string; noLocale: string; sectionTitle: string;
    createSet: string; previewType: string; create: string;
    setLabel: string; uploadVideo: string; uploadingVideo: string;
    noSets: string; videoState: string;
  };
  localePicker: {
    noMatch: string; searchPlaceholder: string; deleteTitle: string;
  };
  versionState: {
    READY_FOR_SALE: string; PENDING_DEVELOPER_RELEASE: string; PENDING_APPLE_RELEASE: string;
    IN_REVIEW: string; WAITING_FOR_REVIEW: string; PREPARE_FOR_SUBMISSION: string;
    READY_FOR_REVIEW: string; REJECTED: string; METADATA_REJECTED: string;
    INVALID_BINARY: string; DEVELOPER_REJECTED: string; WAITING_FOR_EXPORT_COMPLIANCE: string;
    PROCESSING_FOR_APP_STORE: string; DEVELOPER_REMOVED_FROM_SALE: string;
    REMOVED_FROM_SALE: string; REPLACED_WITH_NEW_VERSION: string;
  };
  accountSwitcher: {
    selectAccount: string;
  };
  reviews: {
    title: string; filterStarLabel: string; all: string; loadFailed: string;
    empty: string; reply: string; close: string;
    replyPh: string;
    send: string; sending: string;
  };
  subscriptions: {
    title: string; loading: string; noGroups: string; empty: string;
    groupRef: string; products: string; familySharing: string;
    edit: string; back: string;
    detailTitle: string; productId: string; subType: string; state: string;
    autoRenewable: string; nonRenewing: string;
    localizations: string; addLocale: string;
    name: string; nameMax: string; descriptionLabel: string; descMax: string;
    saveLoc: string; savingLoc: string;
    pricing: string; basePrice: string; baseTerritory: string; pricePoint: string;
    indexLocalize: string; indexBigMac: string; indexNetflix: string; indexParity: string;
    applyPrices: string; applyingPrices: string;
    priceTable: string; territory: string; currentPrice: string; suggested: string;
    apply: string; cancel: string;
  };
}

const en: Messages = {
  common: {
    save: "Save", cancel: "Cancel", delete: "Delete", add: "Add", edit: "Edit", close: "Close",
    loading: "Loading…", refresh: "Refresh", confirm: "Confirm", yes: "Yes", no: "No",
    saved: "Saved.", error: "An error occurred", backToApps: "Apps", back: "Back",
    optional: "optional", required: "required", max: "Max", sending: "Sending…", applied: "Applied",
    retry: "Retry",
  },
  nav: {
    overview: "Overview", apps: "Apps", accounts: "Accounts",
  },
  dashboard: {
    welcome: "Welcome", subtitle: "Sosis — local, agent-native App Store Connect control.",
    appsCard: "Apps", appsDesc: "All your apps and version states",
    accountsCard: "Accounts", accountsDesc: "Manage ASC API keys",
    tipsTitle: "Tips",
    tipMulti: "Add multiple accounts and switch between them in the top right.",
    tipLock: "Agents plan changes; Sosis validates, snapshots, applies, and verifies them locally.",
    localTitle: "Local MCP is ready",
    localDesc: "ASC credentials stay on this device. The visual app is optional; core MCP tools run directly over stdio.",
    recentTitle: "Recent protected changes",
    recentEmpty: "No protected metadata changes yet.",
    restore: "Restore",
    restored: "Restored",
    restoreConfirm: "Restore the previous values for this change? A new safety snapshot will be created.",
  },
  accounts: {
    title: "Accounts", subtitle: "App Store Connect private keys protected by Keychain-backed encryption.",
    addAccount: "Add account", newAccount: "New account",
    newAccountHelp: "Generate one in App Store Connect → Users and Access → Integrations → API Keys.",
    label: "Label", labelPh: "e.g. Acme Inc", issuerId: "Issuer ID", keyId: "Key ID", keyIdPh: "ABC123XYZ",
    privateKey: "Private Key (.p8)", empty: "No accounts yet",
    emptyDesc: "Add your first App Store Connect account to get started.",
    deleteConfirm: 'Delete account "{name}"?', requireP8: "Please upload a .p8 file.", addedAt: "Added",
    p8Invalid: "Invalid P8 — PRIVATE KEY header not found.",
    p8DropHere: "Drop your .p8 file here",
    p8Reupload: "Click or drag to re-upload",
  },
  apps: {
    title: "Apps", subtitle: "All apps in your App Store Connect account",
    empty: "No apps in this account.", needAccount: "You need to add an account first.",
    goAccounts: "Go to Accounts →", loadFailed: "Failed to load: {message}",
  },
  appTabs: {
    versions: "Versions", testflight: "TestFlight", metadata: "Metadata", reviews: "Reviews",
    subscriptions: "Subscriptions", release: "Release", testers: "Testers", previews: "Previews",
  },
  versions: {
    title: "Versions", newVersion: "New version",
    empty: "No versions yet. Create the first one above.",
    buildAttached: "Build", buildMissing: "No build attached",
    addBuild: "Add build", changeBuild: "Change build",
    submitReview: "Submit for review", missingCompliance: "Missing Compliance",
    suggestBuildFirst: "Attach a build first",
  },
  newVersion: {
    title: "New version",
    versionLabel: "Version", versionPh: "e.g. 1.5 or 2.0.1",
    versionFormatHint: "Format: X.Y or X.Y.Z (e.g. 1.5 / 2.0.1)",
    platform: "Platform", releaseType: "Release",
    afterApproval: "Automatically release after approval",
    manualRelease: "Release manually after approval",
    scheduledRelease: "Release at a specific date",
    scheduledDate: "Release date",
    copyright: "Copyright", copyrightPh: "© 2026 …",
    create: "Create", creating: "Creating…",
  },
  attachBuild: {
    title: "Attach build to version",
    loading: "Loading builds…",
    noBuilds: "No builds uploaded for this app yet.",
    noValid: "No valid (VALID, not expired) build available. Upload a new one from Xcode.",
    valid: "VALID", currentSelection: "Currently attached",
    missingComp: "Missing Compliance", complianceOk: "Compliance OK", nonExempt: "Non-exempt",
    hiddenBuilds: "{n} build(s) hidden (processing or expired)",
    expired: "Expired", processing: "Processing", failed: "Failed", invalid: "Invalid",
    complianceHeader: "Export Compliance required",
    complianceDesc: "This build hasn't been answered yet. Apple won't let it through review without it.",
    complianceQuestion: "Does this build use encryption?",
    exemptOption: "No, or only standard encryption (HTTPS / TLS)",
    exemptDesc: "Most apps choose this. ITSAppUsesNonExemptEncryption = false. No extra paperwork.",
    nonExemptOption: "Yes, proprietary / non-exempt encryption",
    nonExemptDesc: "ITSAppUsesNonExemptEncryption = true. May require BIS notification / ARN for US export.",
    save: "Attach build", saveWithComp: "Compliance + attach", saving: "Saving…",
  },
  submitReview: {
    title: "Submit for review",
    readyText: "Version {version} will be sent to Apple Review.",
    req1: "A build must be attached",
    req2: "All required metadata (description, screenshots, …) must be complete",
    req3: "Export compliance / encryption must be declared",
    req4: "Review usually takes 24–48 hours",
    submit: "Submit for review", submitting: "Submitting…",
    sent: "Submitted!", sentDesc: "Version {version} is now in Apple review.",
    stepCreate: "Creating reviewSubmission…",
    stepLink: "Linking version…",
    stepSubmit: "Submitting…",
  },
  testflight: {
    title: "TestFlight", empty: "No builds yet.",
    whatToTest: "What to test", close: "Close",
    noLocs: "This build has no localizations yet.",
    testNotesPh: "What to test…",
  },
  metadata: {
    title: "Metadata",
    version: "Version", locale: "Locale", noVersions: "No versions yet.", loadingLocs: "Loading localizations…",
    addLanguage: "Add language",
    deleteLocalConfirm: 'Delete localization "{locale}"? All its metadata will be lost.',
    description: "Description", whatsNew: "What's New", keywords: "Keywords",
    keywordsHint: "Keywords (comma separated)",
    promotionalText: "Promotional Text", marketingUrl: "Marketing URL", supportUrl: "Support URL",
  },
  translateModal: {
    none: "None", all: "All",
  },
  addLocale: {
    title: "Add language",
    searchPh: "Search language (e.g. Türkçe, tr, German, de-DE)",
    selected: "Selected", available: "Addable",
    addN: "Add {n} languages", addNone: "Add language",
    noResults: "No results for this search.", allAdded: "All supported languages are already added.",
    completed: "{n} added", addedOk: "added", addedErrors: "error",
    waiting: "Waiting…", cantDelete: "{n}/{total} done",
  },
  screenshots: {
    title: "Screenshots",
    subtitle: "Drag and drop images. ASC validates file size/aspect ratio automatically.",
    refresh: "Refresh", loading: "Loading…",
    empty: "No screenshot sets yet. Once you create the first set in App Store Connect, it appears here.",
    imagesCount: "{n} images", pngJpgDrop: "Drop PNG / JPG",
    deleteConfirm: "Delete this screenshot?",
    bulkButton: "Upload from folder",
    bulkTooltip: "Upload to all locales from a folder",
    bulkTitle: "Bulk screenshot upload from folder",
    bulkLocaleCount: "{n} locales",
    bulkFolderHint: "Folder layout: root/display/locale/files or root/locale/display/files. Display folder accepts aliases like iphone67, ipad129, APP_IPHONE_67.",
    bulkChooseFolder: "Choose folder",
    bulkReplace: "Replace existing",
    bulkSetsCount: "{n} sets",
    bulkFilesCount: "{n} files",
    bulkUploading: "Uploading…",
    bulkUploadBtn: "Upload planned screenshots",
    bulkUploadedOk: "{n} screenshots uploaded",
    bulkIssues: "{n} issue(s)",
  },
  previews: {
    tabLabel: "Previews",
    locale: "Locale",
    noLocale: "No locales for this version yet.",
    sectionTitle: "App previews",
    createSet: "Create preview set",
    previewType: "Preview type",
    create: "Create",
    setLabel: "{n} previews",
    uploadVideo: "Upload MOV / MP4",
    uploadingVideo: "Uploading…",
    noSets: "No preview sets yet.",
    videoState: "uploaded",
  },
  localePicker: {
    noMatch: "No matching languages.",
    searchPlaceholder: "Search in {n} languages…",
    deleteTitle: "Delete {code} language",
  },
  versionState: {
    READY_FOR_SALE: "Live",
    PENDING_DEVELOPER_RELEASE: "Awaiting release",
    PENDING_APPLE_RELEASE: "Awaiting Apple release",
    IN_REVIEW: "In review",
    WAITING_FOR_REVIEW: "Queued for review",
    PREPARE_FOR_SUBMISSION: "Preparing",
    READY_FOR_REVIEW: "Ready for review",
    REJECTED: "Rejected",
    METADATA_REJECTED: "Metadata rejected",
    INVALID_BINARY: "Invalid binary",
    DEVELOPER_REJECTED: "Developer rejected",
    WAITING_FOR_EXPORT_COMPLIANCE: "Awaiting export compliance",
    PROCESSING_FOR_APP_STORE: "Processing",
    DEVELOPER_REMOVED_FROM_SALE: "Removed by developer",
    REMOVED_FROM_SALE: "Removed from sale",
    REPLACED_WITH_NEW_VERSION: "Replaced by newer version",
  },
  accountSwitcher: {
    selectAccount: "Select account",
  },
  reviews: {
    title: "Reviews", filterStarLabel: "Rating", all: "All",
    loadFailed: "Failed to load",
    empty: "No reviews for this filter.",
    reply: "Reply", close: "Close",
    replyPh: "Developer reply…",
    send: "Send", sending: "Sending…",
  },
  subscriptions: {
    title: "Subscriptions", loading: "Loading subscriptions…",
    noGroups: "No subscription groups yet. Create one in App Store Connect first.",
    empty: "No subscriptions in this group.",
    groupRef: "Reference name", products: "{n} product(s)",
    familySharing: "Family sharing", edit: "Edit", back: "Back to subscriptions",
    detailTitle: "Subscription details",
    productId: "Product ID", subType: "Type", state: "State",
    autoRenewable: "Auto-renewable", nonRenewing: "Non-renewing",
    localizations: "Localizations", addLocale: "Add localization",
    name: "Display name", nameMax: "Max 30", descriptionLabel: "Description", descMax: "Max 45",
    saveLoc: "Save localization", savingLoc: "Saving…",
    pricing: "Pricing", basePrice: "Base price", baseTerritory: "Base territory",
    pricePoint: "Price point",
    indexLocalize: "Localize prices by economic index",
    indexBigMac: "Big Mac index (purchasing power)",
    indexNetflix: "Netflix subscription index",
    indexParity: "Purchasing power parity (PPP)",
    applyPrices: "Apply prices", applyingPrices: "Applying prices…",
    priceTable: "Price table", territory: "Territory",
    currentPrice: "Current", suggested: "Suggested",
    apply: "Apply", cancel: "Cancel",
  },
};

const tr: Messages = {
  common: {
    save: "Kaydet", cancel: "Vazgeç", delete: "Sil", add: "Ekle", edit: "Düzenle", close: "Kapat",
    loading: "Yükleniyor…", refresh: "Yenile", confirm: "Onayla", yes: "Evet", no: "Hayır",
    saved: "Kaydedildi.", error: "Bir hata oluştu", backToApps: "Uygulamalar", back: "Geri",
    optional: "opsiyonel", required: "zorunlu", max: "Max", sending: "Gönderiliyor…", applied: "Uygulandı",
    retry: "Tekrar dene",
  },
  nav: {
    overview: "Genel bakış", apps: "Uygulamalar", accounts: "Hesaplar",
  },
  dashboard: {
    welcome: "Hoş geldin", subtitle: "Sosis — lokal, agent-native App Store Connect kontrolü.",
    appsCard: "Uygulamalar", appsDesc: "Tüm uygulamaların ve versiyon durumları",
    accountsCard: "Hesaplar", accountsDesc: "ASC API anahtarlarını yönet",
    tipsTitle: "İpuçları",
    tipMulti: "Birden fazla hesap ekleyebilir, üst sağdaki menüden geçiş yapabilirsin.",
    tipLock: "Agent değişikliği planlar; Sosis lokalde doğrular, snapshot alır, uygular ve sonucu kontrol eder.",
    localTitle: "Lokal MCP hazır",
    localDesc: "ASC credential'ları bu cihazda kalır. Görsel uygulama opsiyoneldir; temel MCP araçları doğrudan stdio ile çalışır.",
    recentTitle: "Son korumalı değişiklikler",
    recentEmpty: "Henüz snapshot alınmış metadata değişikliği yok.",
    restore: "Geri al",
    restored: "Geri alındı",
    restoreConfirm: "Bu değişiklikten önceki değerler geri yüklensin mi? Geri alma için de yeni bir güvenlik snapshot'ı oluşturulacak.",
  },
  accounts: {
    title: "Hesaplar", subtitle: "Keychain destekli şifrelemeyle korunan App Store Connect private key'leri.",
    addAccount: "Hesap ekle", newAccount: "Yeni hesap",
    newAccountHelp: "App Store Connect → Users and Access → Integrations → API Keys ekranından alabilirsin.",
    label: "Etiket", labelPh: "Örn. Acme Inc", issuerId: "Issuer ID", keyId: "Key ID", keyIdPh: "ABC123XYZ",
    privateKey: "Private Key (.p8)", empty: "Henüz hesap eklenmedi",
    emptyDesc: "Başlamak için ilk App Store Connect hesabını ekle.",
    deleteConfirm: '"{name}" hesabını silmek istediğine emin misin?',
    requireP8: ".p8 dosyası yükle.", addedAt: "Eklendi",
    p8Invalid: "Geçersiz P8 — PRIVATE KEY header'ı bulunamadı.",
    p8DropHere: ".p8 dosyasını buraya bırak",
    p8Reupload: "Tekrar yüklemek için tıkla veya sürükle",
  },
  apps: {
    title: "Uygulamalar", subtitle: "App Store Connect hesabındaki tüm uygulamalar",
    empty: "Bu hesapta uygulama yok.", needAccount: "Önce bir hesap eklemen gerek.",
    goAccounts: "Hesaplara git →", loadFailed: "Yüklenemedi: {message}",
  },
  appTabs: {
    versions: "Versiyonlar", testflight: "TestFlight", metadata: "Metadata", reviews: "Yorumlar",
    subscriptions: "Abonelikler", release: "Yayın", testers: "Test Edenler", previews: "Önizlemeler",
  },
  versions: {
    title: "Versiyonlar", newVersion: "Yeni versiyon",
    empty: "Henüz versiyon yok. Yukarıdan ilk versiyonu oluşturabilirsin.",
    buildAttached: "Build", buildMissing: "Build atanmadı",
    addBuild: "Build ekle", changeBuild: "Build değiştir",
    submitReview: "İncelemeye yolla", missingCompliance: "Missing Compliance",
    suggestBuildFirst: "Önce bir build ekle",
  },
  newVersion: {
    title: "Yeni versiyon",
    versionLabel: "Versiyon", versionPh: "örn. 1.5 veya 2.0.1",
    versionFormatHint: "Format: X.Y veya X.Y.Z (ör. 1.5 / 2.0.1)",
    platform: "Platform", releaseType: "Yayınlanma şekli",
    afterApproval: "Onay sonrası otomatik yayınla",
    manualRelease: "Manuel yayınla (onay sonrası bekle)",
    scheduledRelease: "Belirli bir tarihte yayınla",
    scheduledDate: "Yayınlanma tarihi",
    copyright: "Copyright", copyrightPh: "© 2026 …",
    create: "Oluştur", creating: "Oluşturuluyor…",
  },
  attachBuild: {
    title: "Versiyona build ekle",
    loading: "Buildler yükleniyor…",
    noBuilds: "Bu app için henüz build yüklenmemiş.",
    noValid: "Geçerli (VALID, expire olmamış) build yok. Yeni bir build Xcode'dan upload et.",
    valid: "VALID", currentSelection: "Şu an seçili",
    missingComp: "Missing Compliance", complianceOk: "Compliance OK", nonExempt: "Non-exempt",
    hiddenBuilds: "{n} build gizlendi (processing veya expired)",
    expired: "Expired", processing: "İşleniyor", failed: "Failed", invalid: "Invalid",
    complianceHeader: "Export Compliance gerekli",
    complianceDesc: "Bu build için henüz cevaplanmamış. Apple bunu bilmeden incelemeye yollanamaz.",
    complianceQuestion: "Bu build encryption kullanıyor mu?",
    exemptOption: "Hayır, veya yalnızca standart şifreleme (HTTPS / TLS)",
    exemptDesc: "Çoğu app bunu seçer. ITSAppUsesNonExemptEncryption = false. Ekstra dökümantasyon gerekmez.",
    nonExemptOption: "Evet, özel/non-exempt encryption",
    nonExemptDesc: "ITSAppUsesNonExemptEncryption = true. ABD ihracat kontrolü için ayrıca BIS bildirimi/ARN'i gerekebilir.",
    save: "Build'i ekle", saveWithComp: "Compliance + build", saving: "Kaydediliyor…",
  },
  submitReview: {
    title: "İncelemeye yolla",
    readyText: "Versiyon {version} Apple incelemesine gönderilecek.",
    req1: "Build atanmış olmalı",
    req2: "Tüm zorunlu metadata (description, screenshots, vs.) eksiksiz olmalı",
    req3: "Export compliance / encryption beyanı verilmiş olmalı",
    req4: "İnceleme 24-48 saat sürebilir",
    submit: "İncelemeye yolla", submitting: "Gönderiliyor…",
    sent: "Gönderildi!", sentDesc: "Versiyon {version} Apple incelemesine girdi.",
    stepCreate: "reviewSubmission oluşturuluyor…",
    stepLink: "versiyon bağlanıyor…",
    stepSubmit: "submit ediliyor…",
  },
  testflight: {
    title: "TestFlight", empty: "Henüz build yok.",
    whatToTest: "What to test", close: "Kapat",
    noLocs: "Bu build için henüz lokalizasyon yok.",
    testNotesPh: "Test edilecekler…",
  },
  metadata: {
    title: "Metadata",
    version: "Versiyon", locale: "Locale", noVersions: "Henüz versiyon yok.",
    loadingLocs: "Lokalizasyonlar yükleniyor…",
    addLanguage: "Dil ekle",
    deleteLocalConfirm: '"{locale}" lokalizasyonunu sil? Bu lokalizasyondaki tüm metadata kaybolur.',
    description: "Açıklama", whatsNew: "What's New", keywords: "Keywords",
    keywordsHint: "Keywords (virgülle ayır)",
    promotionalText: "Promotional Text", marketingUrl: "Marketing URL", supportUrl: "Support URL",
  },
  translateModal: {
    none: "Hiçbiri", all: "Hepsi",
  },
  addLocale: {
    title: "Yeni dil ekle",
    searchPh: "Dil ara (örn. Türkçe, tr, German, de-DE)",
    selected: "Seçili", available: "Eklenebilecek",
    addN: "{n} dil ekle", addNone: "Dil ekle",
    noResults: "Bu arama için sonuç yok.", allAdded: "Tüm desteklenen diller zaten ekli.",
    completed: "{n} eklendi", addedOk: "eklendi", addedErrors: "hata",
    waiting: "Bekleniyor…", cantDelete: "{n}/{total} tamamlandı",
  },
  screenshots: {
    title: "Screenshot'lar",
    subtitle: "Görselleri sürükle bırak ile yükle. ASC dosya boyutu/oranlarını otomatik kontrol eder.",
    refresh: "Yenile", loading: "Yükleniyor…",
    empty: "Bu lokalizasyonda henüz screenshot set yok. App Store Connect'te ilk seti oluşturduktan sonra burada görünür.",
    imagesCount: "{n} görsel", pngJpgDrop: "PNG / JPG sürükle",
    deleteConfirm: "Bu screenshot'ı silmek istediğine emin misin?",
    bulkButton: "Klasörden yükle",
    bulkTooltip: "Tüm locale'lere klasörden toplu yükle",
    bulkTitle: "Klasörden toplu screenshot yükleme",
    bulkLocaleCount: "{n} locale",
    bulkFolderHint: "Klasör yapısı: root/display/locale/files veya root/locale/display/files. Display klasörü iphone67, ipad129, APP_IPHONE_67 gibi alias'ları kabul eder.",
    bulkChooseFolder: "Klasör seç",
    bulkReplace: "Mevcutları değiştir",
    bulkSetsCount: "{n} set",
    bulkFilesCount: "{n} dosya",
    bulkUploading: "Yükleniyor…",
    bulkUploadBtn: "Planlanan screenshot'ları yükle",
    bulkUploadedOk: "{n} screenshot yüklendi",
    bulkIssues: "{n} sorun",
  },
  previews: {
    tabLabel: "Previews",
    locale: "Locale",
    noLocale: "Bu versiyon için locale yok.",
    sectionTitle: "App preview videoları",
    createSet: "Preview set oluştur",
    previewType: "Preview tipi",
    create: "Oluştur",
    setLabel: "{n} preview",
    uploadVideo: "MOV / MP4 yükle",
    uploadingVideo: "Yükleniyor…",
    noSets: "Henüz preview set yok.",
    videoState: "yüklendi",
  },
  localePicker: {
    noMatch: "Eşleşen dil yok.",
    searchPlaceholder: "{n} dilde ara…",
    deleteTitle: "{code} dilini sil",
  },
  versionState: {
    READY_FOR_SALE: "Yayında",
    PENDING_DEVELOPER_RELEASE: "Yayın bekliyor",
    PENDING_APPLE_RELEASE: "Apple onayı",
    IN_REVIEW: "İncelemede",
    WAITING_FOR_REVIEW: "İnceleme sırası",
    PREPARE_FOR_SUBMISSION: "Hazırlanıyor",
    READY_FOR_REVIEW: "İncelemeye hazır",
    REJECTED: "Reddedildi",
    METADATA_REJECTED: "Metadata reddedildi",
    INVALID_BINARY: "Geçersiz binary",
    DEVELOPER_REJECTED: "Geliştirici reddetti",
    WAITING_FOR_EXPORT_COMPLIANCE: "Export compliance bekleniyor",
    PROCESSING_FOR_APP_STORE: "İşleniyor",
    DEVELOPER_REMOVED_FROM_SALE: "Satıştan kaldırıldı",
    REMOVED_FROM_SALE: "Satıştan kaldırıldı",
    REPLACED_WITH_NEW_VERSION: "Yeni sürümle değiştirildi",
  },
  accountSwitcher: {
    selectAccount: "Hesap seç",
  },
  reviews: {
    title: "Yorumlar", filterStarLabel: "Yıldız", all: "Tümü",
    loadFailed: "Yüklenemedi",
    empty: "Bu filtreyle yorum bulunmadı.",
    reply: "Yanıtla", close: "Kapat",
    replyPh: "Geliştirici yanıtı…",
    send: "Gönder", sending: "Gönderiliyor…",
  },
  subscriptions: {
    title: "Abonelikler", loading: "Abonelikler yükleniyor…",
    noGroups: "Henüz subscription group yok. Önce App Store Connect'te bir tane oluştur.",
    empty: "Bu group'ta abonelik yok.",
    groupRef: "Referans adı", products: "{n} ürün",
    familySharing: "Aile paylaşımı", edit: "Düzenle", back: "Aboneliklere geri dön",
    detailTitle: "Abonelik detayı",
    productId: "Ürün ID", subType: "Tip", state: "Durum",
    autoRenewable: "Otomatik yenilenen", nonRenewing: "Yenilenmeyen",
    localizations: "Lokalizasyonlar", addLocale: "Lokalizasyon ekle",
    name: "Görünen ad", nameMax: "Max 30", descriptionLabel: "Açıklama", descMax: "Max 45",
    saveLoc: "Lokalizasyonu kaydet", savingLoc: "Kaydediliyor…",
    pricing: "Fiyatlandırma", basePrice: "Baz fiyat", baseTerritory: "Baz ülke",
    pricePoint: "Fiyat seviyesi",
    indexLocalize: "Ekonomik indeks ile fiyat lokalize et",
    indexBigMac: "Big Mac indeksi (alım gücü)",
    indexNetflix: "Netflix abonelik indeksi",
    indexParity: "Satın alma gücü paritesi (PPP)",
    applyPrices: "Fiyatları uygula", applyingPrices: "Fiyatlar uygulanıyor…",
    priceTable: "Fiyat tablosu", territory: "Ülke",
    currentPrice: "Mevcut", suggested: "Önerilen",
    apply: "Uygula", cancel: "Vazgeç",
  },
};

// Other locales fall back to English for now — can be filled in incrementally.
const MESSAGES: Record<Locale, Messages> = { en, tr, de: en, es: en, fr: en, ja: en };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale] ?? en;
}

export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
