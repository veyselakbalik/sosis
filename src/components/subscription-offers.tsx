"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift, Megaphone, RefreshCcw, Ticket, TimerReset } from "lucide-react";
import { ascFetch } from "@/lib/asc-client-fetch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  accountId: string;
  subId: string;
}

interface AscRef {
  id: string;
  type: string;
}

interface AscIncluded extends AscRef {
  attributes?: Record<string, unknown>;
}

interface SubscriptionOffersResponse {
  data: {
    id: string;
    relationships?: Record<string, { data?: AscRef[] | AscRef | null }>;
  };
  included?: AscIncluded[];
}

const OFFER_SECTIONS = [
  { key: "introductoryOffers", label: "Introductory", icon: Gift },
  { key: "promotionalOffers", label: "Promotional", icon: Megaphone },
  { key: "offerCodes", label: "Offer codes", icon: Ticket },
  { key: "winBackOffers", label: "Win-back", icon: TimerReset },
] as const;

const PREFERRED_FIELDS = [
  "name",
  "referenceName",
  "offerCode",
  "customCode",
  "offerMode",
  "duration",
  "numberOfPeriods",
  "state",
  "startDate",
  "endDate",
];

function relatedIds(response: SubscriptionOffersResponse, key: string): string[] {
  const data = response.data.relationships?.[key]?.data;
  if (!data) return [];
  return Array.isArray(data) ? data.map((item) => item.id) : [data.id];
}

function formatValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function offerTitle(offer: AscIncluded): string {
  const attrs = offer.attributes ?? {};
  const fromAttrs = formatValue(attrs.name)
    ?? formatValue(attrs.referenceName)
    ?? formatValue(attrs.offerCode)
    ?? formatValue(attrs.customCode);
  return fromAttrs ?? offer.id;
}

function offerDetails(offer: AscIncluded): Array<{ label: string; value: string }> {
  const attrs = offer.attributes ?? {};
  return PREFERRED_FIELDS
    .map((key) => ({ label: key, value: formatValue(attrs[key]) }))
    .filter((item): item is { label: string; value: string } => Boolean(item.value));
}

export function SubscriptionOffers({ accountId, subId }: Props) {
  const { data, error, isLoading } = useQuery({
    queryKey: ["asc", accountId, "subscription", subId, "offers"],
    queryFn: async () => ascFetch<SubscriptionOffersResponse>(
      `v1/subscriptions/${subId}?include=introductoryOffers,promotionalOffers,offerCodes,winBackOffers`,
      { accountId },
    ),
  });

  const includedById = useMemo(() => {
    const map = new Map<string, AscIncluded>();
    for (const item of data?.included ?? []) map.set(item.id, item);
    return map;
  }, [data]);

  const sections = OFFER_SECTIONS.map((section) => {
    const ids = data ? relatedIds(data, section.key) : [];
    return {
      ...section,
      offers: ids.map((id) => includedById.get(id) ?? { id, type: section.key }),
    };
  });

  const total = sections.reduce((sum, section) => sum + section.offers.length, 0);

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold flex items-center gap-2">
            <RefreshCcw className="h-4 w-4" /> Offers
          </h3>
          <Badge variant="outline">{isLoading ? "..." : `${total} total`}</Badge>
        </div>

        {error && <p className="text-sm text-[var(--destructive)]">{(error as Error).message}</p>}

        <div className="grid md:grid-cols-2 gap-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.key} className="rounded-lg border border-[var(--border)] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium flex items-center gap-2">
                    <Icon className="h-4 w-4" /> {section.label}
                  </p>
                  <Badge variant={section.offers.length ? "info" : "outline"}>{section.offers.length}</Badge>
                </div>

                {isLoading && (
                  <div className="space-y-2">
                    <div className="h-4 w-3/4 rounded bg-[var(--muted)] animate-pulse" />
                    <div className="h-4 w-1/2 rounded bg-[var(--muted)] animate-pulse" />
                  </div>
                )}

                {!isLoading && section.offers.length === 0 && (
                  <p className="text-sm text-[var(--muted-foreground)]">No active records.</p>
                )}

                {!isLoading && section.offers.map((offer) => (
                  <div key={offer.id} className="rounded-md bg-[var(--muted)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{offerTitle(offer)}</p>
                      <span className="text-[10px] font-mono text-[var(--muted-foreground)] shrink-0">{offer.type}</span>
                    </div>
                    <p className="text-[11px] font-mono text-[var(--muted-foreground)] truncate mt-1">{offer.id}</p>
                    {offerDetails(offer).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {offerDetails(offer).slice(0, 5).map((detail) => (
                          <span
                            key={`${offer.id}-${detail.label}`}
                            className="rounded border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[10px]"
                          >
                            {detail.label}: {detail.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
