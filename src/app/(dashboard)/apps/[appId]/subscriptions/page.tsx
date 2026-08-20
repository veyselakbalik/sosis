"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ChevronRight, Layers, CreditCard, Users, Plus } from "lucide-react";
import { useSubscriptionGroups } from "@/hooks/use-asc";
import { useActiveAccountId } from "@/hooks/use-active-account";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewSubscriptionModal } from "@/components/new-subscription-modal";
import { useT } from "@/components/i18n-provider";
import { interpolate } from "@/lib/i18n/dict";
import type { Subscription, AscResource } from "@/lib/asc/types";

export default function SubscriptionsPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = use(params);
  const accountId = useActiveAccountId();
  const t = useT();
  const [newOpen, setNewOpen] = useState(false);
  const { data, isLoading, error } = useSubscriptionGroups(accountId, appId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4 h-20 bg-[var(--muted)] animate-pulse" /></Card>
        ))}
      </div>
    );
  }

  const header = (
    <div className="flex items-center justify-end -mt-2 mb-2">
      {accountId && (
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4" /> New subscription
        </Button>
      )}
    </div>
  );

  if (error) return <>{header}<Card><CardContent className="p-6 text-sm text-[var(--destructive)]">{(error as Error).message}</CardContent></Card></>;
  if (!data || data.data.length === 0) {
    return (
      <>
        {header}
        <Card><CardContent className="p-10 text-center text-[var(--muted-foreground)]">{t.subscriptions.noGroups}</CardContent></Card>
        {accountId && newOpen && (
          <NewSubscriptionModal open={newOpen} onClose={() => setNewOpen(false)} accountId={accountId} appId={appId} />
        )}
      </>
    );
  }

  const subsById = new Map<string, Subscription>();
  for (const inc of (data.included as Array<AscResource<Record<string, unknown>>> | undefined) ?? []) {
    if (inc.type === "subscriptions") subsById.set(inc.id, inc as unknown as Subscription);
  }

  return (
    <div className="space-y-4">
      {header}
      {data.data.map((g) => {
        const subRel = (g.relationships as { subscriptions?: { data?: Array<{ id: string }> } })?.subscriptions?.data ?? [];
        const subs = subRel.map((r) => subsById.get(r.id)).filter(Boolean) as Subscription[];
        return (
          <Card key={g.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[var(--muted)] flex items-center justify-center shrink-0">
                  <Layers className="h-5 w-5 text-[var(--muted-foreground)]" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{g.attributes?.referenceName}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {interpolate(t.subscriptions.products, { n: subs.length })}
                  </p>
                </div>
              </div>
              {subs.length > 0 && (
                <div className="space-y-1.5 pl-2 border-l-2 border-[var(--border)] ml-3">
                  {subs.map((s) => (
                    <Link
                      key={s.id}
                      href={`/apps/${appId}/subscriptions/${s.id}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-[var(--muted)] group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CreditCard className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">{s.attributes?.name || "—"}</p>
                            {s.attributes?.familySharable && (
                              <Badge variant="outline" className="text-[10px]"><Users className="h-2.5 w-2.5 mr-0.5 inline" />{t.subscriptions.familySharing}</Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-[var(--muted-foreground)] font-mono truncate">
                            {s.attributes?.productId} · {s.attributes?.subscriptionPeriod}
                          </p>
                        </div>
                      </div>
                      <SubscriptionStateBadge state={s.attributes?.state} />
                      <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      {accountId && newOpen && (
        <NewSubscriptionModal open={newOpen} onClose={() => setNewOpen(false)} accountId={accountId} appId={appId} />
      )}
    </div>
  );
}

function SubscriptionStateBadge({ state }: { state: string | undefined }) {
  if (!state) return null;
  const variant = state === "APPROVED" || state === "READY_TO_SUBMIT" ? "success"
    : state === "IN_REVIEW" || state === "WAITING_FOR_REVIEW" ? "info"
    : state === "REJECTED" || state === "DEVELOPER_ACTION_NEEDED" ? "destructive"
    : "default";
  const label = state.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return <Badge variant={variant} className="text-[10px] shrink-0">{label}</Badge>;
}
