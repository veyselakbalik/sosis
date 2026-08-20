"use client";

import { useQuery } from "@tanstack/react-query";
import { ascFetch } from "@/lib/asc-client-fetch";
import type { AscListResponse, Build } from "@/lib/asc/types";

interface ImageAsset {
  templateUrl?: string;
  width?: number;
  height?: number;
}

/**
 * Fetch the icon URL for an app by reading the most recent VALID build's iconAssetToken.
 * App Store Connect doesn't expose an icon directly on the App resource — it lives on the build.
 */
export function useAppIcon(accountId: string | null, appId: string | null, size = 128): string | null {
  const { data } = useQuery({
    queryKey: ["asc", accountId, "app", appId, "iconBuild"],
    enabled: !!accountId && !!appId,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    queryFn: async () => {
      const data = await ascFetch<AscListResponse<Build>>(
        `v1/builds?filter[app]=${appId}&filter[processingState]=VALID&limit=1&sort=-uploadedDate&fields[builds]=iconAssetToken,version`,
        { accountId: accountId! },
      );
      return data.data[0] ?? null;
    },
  });
  const asset = data?.attributes as (Build["attributes"] & { iconAssetToken?: ImageAsset }) | undefined;
  const token = asset?.iconAssetToken;
  if (!token?.templateUrl) return null;
  const w = Math.min(token.width ?? size, size);
  const h = Math.round(((token.height ?? size) / (token.width ?? size)) * w);
  return token.templateUrl.replace("{w}", String(w)).replace("{h}", String(h)).replace("{f}", "png");
}
