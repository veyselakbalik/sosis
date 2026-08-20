"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, CreditCard } from "lucide-react";
import { useSubscription } from "@/hooks/use-asc";
import { useActiveAccountId } from "@/hooks/use-active-account";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubscriptionLocalizations } from "@/components/subscription-localizations";
import { SubscriptionPricing } from "@/components/subscription-pricing";
import { SubscriptionOffers } from "@/components/subscription-offers";
import { useT } from "@/components/i18n-provider";

export default function SubscriptionDetailPage({ params }: { params: Promise<{ appId: string; subId: string }> }) {
  const { appId, subId } = use(params);
  const accountId = useActiveAccountId();
  const t = useT();
  const { data: sub, isLoading } = useSubscription(accountId, subId);

  return (
    <div className="space-y-4">
      <Link
        href={`/apps/${appId}/subscriptions`}
        className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> {t.subscriptions.back}
      </Link>

      <Card>
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-[var(--muted)] flex items-center justify-center shrink-0">
            <CreditCard className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <div className="h-5 w-48 bg-[var(--muted)] rounded animate-pulse" />
            ) : (
              <>
                <h2 className="font-semibold tracking-tight truncate">{sub?.attributes?.name}</h2>
                <p className="text-xs text-[var(--muted-foreground)] font-mono truncate">
                  {sub?.attributes?.productId}
                </p>
              </>
            )}
          </div>
          {sub?.attributes?.subscriptionPeriod && (
            <Badge variant="outline">{sub.attributes.subscriptionPeriod.replace(/_/g, " ")}</Badge>
          )}
          {sub?.attributes?.state && (
            <Badge variant="info" className="text-[10px]">
              {sub.attributes.state.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
            </Badge>
          )}
        </CardContent>
      </Card>

      {accountId && (
        <>
          <SubscriptionLocalizations accountId={accountId} subId={subId} />
          <SubscriptionPricing accountId={accountId} subId={subId} />
          <SubscriptionOffers accountId={accountId} subId={subId} />
        </>
      )}
    </div>
  );
}
