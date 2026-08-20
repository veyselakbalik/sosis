"use client";

import { useQuery } from "@tanstack/react-query";
import { ascFetch } from "@/lib/asc-client-fetch";
import type {
  AscListResponse,
  AscSingleResponse,
  App,
  AppStoreVersion,
  Build,
  CustomerReview,
  AppStoreVersionLocalization,
  AppInfo,
  AppInfoLocalization,
  SubscriptionGroup,
  Subscription,
  SubscriptionLocalization,
} from "@/lib/asc/types";

export function useApps(accountId: string | null) {
  return useQuery({
    queryKey: ["asc", accountId, "apps"],
    enabled: !!accountId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const data = await ascFetch<AscListResponse<App>>("v1/apps?limit=200&sort=name", { accountId: accountId! });
      return data.data;
    },
  });
}

export function useApp(accountId: string | null, appId: string | null) {
  return useQuery({
    queryKey: ["asc", accountId, "app", appId],
    enabled: !!accountId && !!appId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const data = await ascFetch<AscSingleResponse<App>>(`v1/apps/${appId}`, { accountId: accountId! });
      return data.data;
    },
  });
}

export function useVersion(accountId: string | null, versionId: string | null) {
  return useQuery({
    queryKey: ["asc", accountId, "version", versionId],
    enabled: !!accountId && !!versionId,
    staleTime: 60_000,
    queryFn: async () => {
      const data = await ascFetch<AscSingleResponse<AppStoreVersion>>(
        `v1/appStoreVersions/${versionId}?include=build`,
        { accountId: accountId! },
      );
      return data;
    },
  });
}

export function useVersions(accountId: string | null, appId: string | null) {
  return useQuery({
    queryKey: ["asc", accountId, "app", appId, "versions"],
    enabled: !!accountId && !!appId,
    staleTime: 60_000,
    queryFn: async () => {
      const data = await ascFetch<AscListResponse<AppStoreVersion>>(
        `v1/apps/${appId}/appStoreVersions?limit=50&include=build`,
        { accountId: accountId! },
      );
      data.data.sort((a, b) => {
        const da = a.attributes?.createdDate ? new Date(a.attributes.createdDate).getTime() : 0;
        const db = b.attributes?.createdDate ? new Date(b.attributes.createdDate).getTime() : 0;
        return db - da;
      });
      return data;
    },
  });
}

export function useBuilds(accountId: string | null, appId: string | null) {
  return useQuery({
    queryKey: ["asc", accountId, "app", appId, "builds"],
    enabled: !!accountId && !!appId,
    staleTime: 60_000,
    queryFn: async () => {
      const data = await ascFetch<AscListResponse<Build>>(
        `v1/builds?filter[app]=${appId}&limit=50&sort=-uploadedDate&include=buildBetaDetail,betaBuildLocalizations,preReleaseVersion`,
        { accountId: accountId! },
      );
      return data;
    },
  });
}

export function useReviews(accountId: string | null, appId: string | null, opts: { territory?: string; rating?: number } = {}) {
  return useQuery({
    queryKey: ["asc", accountId, "app", appId, "reviews", opts],
    enabled: !!accountId && !!appId,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "50");
      params.set("sort", "-createdDate");
      if (opts.territory) params.set("filter[territory]", opts.territory);
      if (opts.rating) params.set("filter[rating]", String(opts.rating));
      const data = await ascFetch<AscListResponse<CustomerReview>>(
        `v1/apps/${appId}/customerReviews?${params.toString()}`,
        { accountId: accountId! },
      );
      return data.data;
    },
  });
}

export function useAppInfos(accountId: string | null, appId: string | null) {
  return useQuery({
    queryKey: ["asc", accountId, "app", appId, "appInfos"],
    enabled: !!accountId && !!appId,
    staleTime: 60_000,
    queryFn: async () => {
      const data = await ascFetch<AscListResponse<AppInfo>>(
        `v1/apps/${appId}/appInfos?limit=10`,
        { accountId: accountId! },
      );
      return data.data;
    },
  });
}

export function useAppInfoLocalizations(accountId: string | null, appInfoId: string | null) {
  return useQuery({
    queryKey: ["asc", accountId, "appInfo", appInfoId, "localizations"],
    enabled: !!accountId && !!appInfoId,
    staleTime: 60_000,
    queryFn: async () => {
      const data = await ascFetch<AscListResponse<AppInfoLocalization>>(
        `v1/appInfos/${appInfoId}/appInfoLocalizations?limit=50`,
        { accountId: accountId! },
      );
      return data.data;
    },
  });
}

export function useSubscriptionGroups(accountId: string | null, appId: string | null) {
  return useQuery({
    queryKey: ["asc", accountId, "app", appId, "subscriptionGroups"],
    enabled: !!accountId && !!appId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const data = await ascFetch<AscListResponse<SubscriptionGroup>>(
        `v1/apps/${appId}/subscriptionGroups?include=subscriptions&limit=50`,
        { accountId: accountId! },
      );
      return data;
    },
  });
}

export function useSubscription(accountId: string | null, subId: string | null) {
  return useQuery({
    queryKey: ["asc", accountId, "subscription", subId],
    enabled: !!accountId && !!subId,
    staleTime: 60_000,
    queryFn: async () => {
      const data = await ascFetch<AscSingleResponse<Subscription>>(
        `v1/subscriptions/${subId}`,
        { accountId: accountId! },
      );
      return data.data;
    },
  });
}

export function useSubscriptionLocalizations(accountId: string | null, subId: string | null) {
  return useQuery({
    queryKey: ["asc", accountId, "subscription", subId, "localizations"],
    enabled: !!accountId && !!subId,
    staleTime: 60_000,
    queryFn: async () => {
      const data = await ascFetch<AscListResponse<SubscriptionLocalization>>(
        `v1/subscriptions/${subId}/subscriptionLocalizations?limit=50`,
        { accountId: accountId! },
      );
      return data.data;
    },
  });
}

export function useSubscriptionPrices(accountId: string | null, subId: string | null) {
  return useQuery({
    queryKey: ["asc", accountId, "subscription", subId, "prices"],
    enabled: !!accountId && !!subId,
    staleTime: 60_000,
    queryFn: async () => {
      const data = await ascFetch<AscListResponse<{ id: string; type: string; attributes?: Record<string, unknown>; relationships?: Record<string, unknown> }>>(
        `v1/subscriptions/${subId}/prices?include=subscriptionPricePoint,territory&limit=200`,
        { accountId: accountId! },
      );
      return data;
    },
  });
}

export function useVersionLocalizations(accountId: string | null, versionId: string | null) {
  return useQuery({
    queryKey: ["asc", accountId, "version", versionId, "localizations"],
    enabled: !!accountId && !!versionId,
    staleTime: 60_000,
    queryFn: async () => {
      const data = await ascFetch<AscListResponse<AppStoreVersionLocalization>>(
        `v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=50`,
        { accountId: accountId! },
      );
      return data.data;
    },
  });
}
