export interface AscResource<T, R = Record<string, unknown>> {
  type: string;
  id: string;
  attributes?: T;
  relationships?: R;
  links?: { self?: string };
}

export interface AscListResponse<T> {
  data: T[];
  included?: Array<AscResource<Record<string, unknown>>>;
  links?: { self?: string; next?: string; first?: string };
  meta?: { paging?: { total: number; limit: number } };
}

export interface AscSingleResponse<T> {
  data: T;
  included?: Array<AscResource<Record<string, unknown>>>;
}

export interface AppAttributes {
  name: string;
  bundleId: string;
  sku: string;
  primaryLocale: string;
}

export type App = AscResource<AppAttributes>;

export interface AppStoreVersionAttributes {
  versionString: string;
  appStoreState:
    | "DEVELOPER_REMOVED_FROM_SALE"
    | "DEVELOPER_REJECTED"
    | "IN_REVIEW"
    | "INVALID_BINARY"
    | "METADATA_REJECTED"
    | "PENDING_APPLE_RELEASE"
    | "PENDING_CONTRACT"
    | "PENDING_DEVELOPER_RELEASE"
    | "PREPARE_FOR_SUBMISSION"
    | "PREORDER_READY_FOR_SALE"
    | "PROCESSING_FOR_APP_STORE"
    | "READY_FOR_REVIEW"
    | "READY_FOR_SALE"
    | "REJECTED"
    | "REMOVED_FROM_SALE"
    | "WAITING_FOR_EXPORT_COMPLIANCE"
    | "WAITING_FOR_REVIEW"
    | "REPLACED_WITH_NEW_VERSION"
    | string;
  platform: "IOS" | "MAC_OS" | "TV_OS" | "VISION_OS" | string;
  releaseType?: string;
  createdDate?: string;
  earliestReleaseDate?: string | null;
  downloadable?: boolean;
}

export type AppStoreVersion = AscResource<AppStoreVersionAttributes>;

export interface BuildAttributes {
  version: string;
  uploadedDate: string;
  expirationDate?: string;
  expired?: boolean;
  processingState?: "PROCESSING" | "FAILED" | "INVALID" | "VALID" | string;
  buildAudienceType?: string;
  usesNonExemptEncryption?: boolean | null;
  minOsVersion?: string;
}

export type Build = AscResource<BuildAttributes>;

export interface PreReleaseVersionAttributes {
  version: string;
  platform?: string;
}
export type PreReleaseVersion = AscResource<PreReleaseVersionAttributes>;

export interface CustomerReviewAttributes {
  rating: number;
  title?: string;
  body?: string;
  reviewerNickname?: string;
  createdDate?: string;
  territory?: string;
}

export type CustomerReview = AscResource<CustomerReviewAttributes>;

export interface AppStoreVersionLocalizationAttributes {
  description?: string | null;
  locale: string;
  keywords?: string | null;
  marketingUrl?: string | null;
  promotionalText?: string | null;
  supportUrl?: string | null;
  whatsNew?: string | null;
}
export type AppStoreVersionLocalization = AscResource<AppStoreVersionLocalizationAttributes>;

// App Info Localizations (where title + subtitle live — they are NOT on version localizations)
export interface AppInfoLocalizationAttributes {
  locale: string;
  name?: string | null;        // App title (max 30 chars)
  subtitle?: string | null;    // App subtitle (max 30 chars)
  privacyPolicyUrl?: string | null;
  privacyChoicesUrl?: string | null;
  privacyPolicyText?: string | null;
}
export type AppInfoLocalization = AscResource<AppInfoLocalizationAttributes>;

export interface AppInfoAttributes {
  appStoreState?: string;
  appStoreAgeRating?: string;
  brazilAgeRating?: string;
  kidsAgeBand?: string | null;
}
export type AppInfo = AscResource<AppInfoAttributes>;

// Subscriptions
export interface SubscriptionGroupAttributes {
  referenceName: string;
}
export type SubscriptionGroup = AscResource<SubscriptionGroupAttributes>;

export interface SubscriptionAttributes {
  productId: string;
  name: string;
  state?: "MISSING_METADATA" | "READY_TO_SUBMIT" | "WAITING_FOR_REVIEW" | "IN_REVIEW" | "PENDING_BINARY_APPROVAL" | "APPROVED" | "DEVELOPER_ACTION_NEEDED" | "DEVELOPER_REMOVED_FROM_SALE" | "REMOVED_FROM_SALE" | "REJECTED" | string;
  subscriptionPeriod?: "ONE_WEEK" | "ONE_MONTH" | "TWO_MONTHS" | "THREE_MONTHS" | "SIX_MONTHS" | "ONE_YEAR" | string;
  familySharable?: boolean;
  reviewNote?: string | null;
  groupLevel?: number;
}
export type Subscription = AscResource<SubscriptionAttributes>;

export interface SubscriptionLocalizationAttributes {
  locale: string;
  name?: string | null;
  description?: string | null;
  state?: string;
}
export type SubscriptionLocalization = AscResource<SubscriptionLocalizationAttributes>;

export interface SubscriptionPriceAttributes {
  startDate?: string | null;
  endDate?: string | null;
  preserveCurrentPrice?: boolean;
}
export interface SubscriptionPricePointAttributes {
  customerPrice: string;
  proceeds: string;
}
export type SubscriptionPricePoint = AscResource<SubscriptionPricePointAttributes>;

export interface TerritoryAttributes {
  currency: string;
}
export type Territory = AscResource<TerritoryAttributes>;
