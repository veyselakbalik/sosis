"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, Sparkles, Loader2, Check, AlertCircle, X } from "lucide-react";
import { useSubscriptionPrices } from "@/hooks/use-asc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n-provider";
import { ascFetch } from "@/lib/asc-client-fetch";
import { cn } from "@/lib/utils";
import { INDICES, TERRITORY_KEYS, suggestLocalPrice, localToUsd, snapToNearest, type IndexType } from "@/lib/pricing/indices";

interface Props {
  accountId: string;
  subId: string;
}

interface PricePoint {
  id: string;
  type: string;
  attributes?: { customerPrice?: string; proceeds?: string };
  relationships?: { territory?: { data?: { id?: string } } };
}

interface PricePointResp {
  data: PricePoint[];
  links?: { next?: string };
}

interface Suggestion {
  territory: string;
  current: number | null;
  suggested: number;
  pricePointId: string | null;
  customerPrice: string | null;
  state: "pending" | "applying" | "ok" | "error";
  error?: string;
}

export function SubscriptionPricing({ accountId, subId }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const { data: priceData } = useSubscriptionPrices(accountId, subId);

  const [open, setOpen] = useState(false);
  const [basePrice, setBasePrice] = useState<number>(9.99);
  const [baseTerritory, setBaseTerritory] = useState<string>("USA");
  const [indexType, setIndexType] = useState<IndexType>("ppp");
  const [userChangedBase, setUserChangedBase] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [computing, setComputing] = useState(false);
  const [applying, setApplying] = useState(false);

  // existing prices map
  const currentByTerritory = useMemo(() => {
    const map = new Map<string, { customerPrice?: string; pricePointId: string; currency?: string }>();
    if (!priceData) return map;
    const pricePointById = new Map<string, { customerPrice?: string }>();
    for (const inc of priceData.included ?? []) {
      if (inc.type === "subscriptionPricePoints") {
        const attrs = inc.attributes as { customerPrice?: string } | undefined;
        pricePointById.set(inc.id, { customerPrice: attrs?.customerPrice });
      }
    }
    for (const p of priceData.data) {
      const tRel = (p.relationships as { territory?: { data?: { id?: string } } })?.territory?.data?.id;
      const ppRel = (p.relationships as { subscriptionPricePoint?: { data?: { id?: string } } })?.subscriptionPricePoint?.data?.id;
      if (tRel && ppRel) {
        const pp = pricePointById.get(ppRel);
        map.set(tRel, { customerPrice: pp?.customerPrice, pricePointId: ppRel });
      }
    }
    return map;
  }, [priceData]);

  const [computeError, setComputeError] = useState<string | null>(null);

  const existingBasePrice = useMemo(() => {
    const usPrice = currentByTerritory.get("USA")?.customerPrice
      || currentByTerritory.get(baseTerritory)?.customerPrice;
    if (usPrice) {
      const parsed = parseFloat(usPrice);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return null;
  }, [currentByTerritory, baseTerritory]);
  const effectiveBasePrice = userChangedBase ? basePrice : (existingBasePrice ?? basePrice);

  async function compute() {
    setComputing(true);
    setComputeError(null);
    setSuggestions([]);

    // ALGORITHM (FX + index based, per-territory snap)
    // ──────────────────────────────────────────────
    // Apple's price ladders are listed in LOCAL CURRENCY for each territory.
    // Apple's tier indices are NOT 1:1 PPP-equivalent across territories, so
    // we cannot rely on "same index = same buying power".
    //
    // Instead:
    //   1. Normalize the base price to USD (using base territory FX rate).
    //   2. For each target, compute the PPP-localized USD value:
    //        usd_target = base_usd × (target_index / base_index)
    //   3. Convert that USD value to the target's LOCAL currency using FX:
    //        local_target = usd_target × target_fx
    //   4. Fetch the target's ladder and snap to the nearest LOCAL price.
    interface Point { id: string; price: number }

    async function fetchLadder(terr: string): Promise<Point[]> {
      const out: Point[] = [];
      let path = `v1/subscriptions/${subId}/pricePoints?filter%5Bterritory%5D=${terr}&limit=200`;
      for (let i = 0; i < 5; i++) {
        const resp = await ascFetch<PricePointResp>(path, { accountId });
        for (const p of resp.data ?? []) {
          const price = parseFloat(p.attributes?.customerPrice ?? "0");
          if (!Number.isFinite(price) || price <= 0) continue;
          out.push({ id: p.id, price });
        }
        const next = resp.links?.next;
        if (!next) break;
        const u = new URL(next);
        path = u.pathname.replace(/^\/?v1\//, "v1/") + u.search;
      }
      out.sort((a, b) => a.price - b.price);
      return out;
    }

    // 1) Normalize the base price to USD
    const baseUsd = localToUsd(effectiveBasePrice, baseTerritory) ?? effectiveBasePrice;

    // 2) Build target plans (USD + LOCAL targets)
    interface Plan { territory: string; usdEquiv: number; localTarget: number }
    const plans: Plan[] = [];
    for (const terr of TERRITORY_KEYS.filter((k) => k !== baseTerritory)) {
      const s = suggestLocalPrice(baseUsd, baseTerritory, terr, indexType);
      if (!s || s.localPrice <= 0) continue;
      plans.push({ territory: terr, usdEquiv: s.usdEquivalent, localTarget: s.localPrice });
    }

    if (plans.length === 0) {
      setComputeError("No target territories to compute.");
      setComputing(false);
      return;
    }

    // 3) Fetch each target ladder in parallel
    const targetLadders = new Map<string, Point[]>();
    let lastError: unknown = null;
    await Promise.all(
      plans.map(async (plan) => {
        try {
          targetLadders.set(plan.territory, await fetchLadder(plan.territory));
        } catch (e) {
          lastError = e;
        }
      }),
    );

    // 4) Snap to nearest LOCAL price in target ladder
    const out: Suggestion[] = [];
    for (const plan of plans) {
      const ladder = targetLadders.get(plan.territory) ?? [];
      const cur = currentByTerritory.get(plan.territory);
      const currentPrice = cur?.customerPrice ? parseFloat(cur.customerPrice) : null;

      if (ladder.length === 0) {
        out.push({
          territory: plan.territory,
          current: currentPrice,
          suggested: plan.usdEquiv,
          pricePointId: null,
          customerPrice: null,
          state: "error",
          error: "no price points",
        });
        continue;
      }

      const nearestLocal = snapToNearest(plan.localTarget, ladder.map((p) => p.price));
      const pick = ladder.find((p) => p.price === nearestLocal)!;

      out.push({
        territory: plan.territory,
        current: currentPrice,
        suggested: plan.usdEquiv,
        pricePointId: pick.id,
        customerPrice: pick.price.toFixed(2),
        state: "pending",
      });
    }

    if (lastError && out.every((s) => !s.pricePointId)) {
      const lastErr = lastError as { status?: number; body?: { errors?: Array<{ title?: string; detail?: string }> }; message?: string };
      const apple = lastErr?.body?.errors?.[0];
      const detail = apple ? `${apple.title ?? ""} — ${apple.detail ?? ""}`.trim() : null;
      setComputeError(detail ? `Apple ${lastErr?.status ?? ""}: ${detail}` : lastErr?.message ?? "Failed to fetch target ladders");
    }

    out.sort((a, b) => a.territory.localeCompare(b.territory));
    setSuggestions(out);
    setComputing(false);
  }

  async function applyAll() {
    setApplying(true);
    const toApply = suggestions.filter((s) => s.pricePointId && s.state !== "ok");
    await Promise.all(
      toApply.map(async (s) => {
        setSuggestions((arr) => arr.map((x) => x.territory === s.territory ? { ...x, state: "applying" } : x));
        try {
          await ascFetch("v1/subscriptionPrices", {
            accountId,
            method: "POST",
            body: {
              data: {
                type: "subscriptionPrices",
                relationships: {
                  subscription: { data: { type: "subscriptions", id: subId } },
                  subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: s.pricePointId } },
                  territory: { data: { type: "territories", id: s.territory } },
                },
              },
            },
          });
          setSuggestions((arr) => arr.map((x) => x.territory === s.territory ? { ...x, state: "ok" } : x));
        } catch (e) {
          const err = e as { body?: { errors?: Array<{ detail?: string }> }; message?: string };
          const msg = err?.body?.errors?.[0]?.detail || err?.message || "PATCH failed";
          setSuggestions((arr) => arr.map((x) => x.territory === s.territory ? { ...x, state: "error", error: msg } : x));
        }
      }),
    );
    qc.invalidateQueries({ queryKey: ["asc", accountId, "subscription", subId, "prices"] });
    setApplying(false);
  }

  const validSuggestions = suggestions.filter((s) => s.pricePointId);

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold flex items-center gap-2">
            <CircleDollarSign className="h-4 w-4" /> {t.subscriptions.pricing}
          </h3>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Sparkles className="h-4 w-4" />
            {t.subscriptions.indexLocalize}
          </Button>
        </div>

        {/* Current prices snapshot */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 max-h-72 overflow-auto pr-1">
          {currentByTerritory.size === 0 && (
            <p className="text-xs text-[var(--muted-foreground)] col-span-full">—</p>
          )}
          {Array.from(currentByTerritory.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([terr, p]) => (
            <div key={terr} className="flex items-center justify-between text-xs px-2 py-1 rounded border border-[var(--border)]">
              <span className="font-mono text-[var(--muted-foreground)]">{terr}</span>
              <span className="font-medium">{p.customerPrice ?? "—"}</span>
            </div>
          ))}
        </div>
      </CardContent>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <h2 className="font-semibold">{t.subscriptions.indexLocalize}</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setOpen(false); setSuggestions([]); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>{t.subscriptions.basePrice} ({INDICES[baseTerritory]?.currency ?? "USD"})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={effectiveBasePrice}
                    onChange={(e) => {
                      setBasePrice(parseFloat(e.target.value) || 0);
                      setUserChangedBase(true);
                    }}
                  />
                  {!userChangedBase && currentByTerritory.has(baseTerritory) && (
                    <p className="text-[10px] text-[var(--muted-foreground)]">From current {baseTerritory} price</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{t.subscriptions.baseTerritory}</Label>
                  <select
                    value={baseTerritory}
                    onChange={(e) => { setBaseTerritory(e.target.value); setUserChangedBase(false); }}
                    className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
                  >
                    {TERRITORY_KEYS.map((k) => (
                      <option key={k} value={k}>{INDICES[k].name} ({k})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Index</Label>
                  <div className="space-y-1">
                    <label className={cn(
                      "flex items-center gap-2 p-1.5 rounded border text-xs cursor-pointer",
                      indexType === "ppp" ? "border-[var(--foreground)] bg-[var(--muted)]" : "border-[var(--border)]",
                    )}>
                      <input type="radio" checked={indexType === "ppp"} onChange={() => setIndexType("ppp")} className="accent-[var(--foreground)]" />
                      {t.subscriptions.indexParity}
                    </label>
                    <label className={cn(
                      "flex items-center gap-2 p-1.5 rounded border text-xs cursor-pointer",
                      indexType === "bigmac" ? "border-[var(--foreground)] bg-[var(--muted)]" : "border-[var(--border)]",
                    )}>
                      <input type="radio" checked={indexType === "bigmac"} onChange={() => setIndexType("bigmac")} className="accent-[var(--foreground)]" />
                      {t.subscriptions.indexBigMac}
                    </label>
                    <label className={cn(
                      "flex items-center gap-2 p-1.5 rounded border text-xs cursor-pointer",
                      indexType === "netflix" ? "border-[var(--foreground)] bg-[var(--muted)]" : "border-[var(--border)]",
                    )}>
                      <input type="radio" checked={indexType === "netflix"} onChange={() => setIndexType("netflix")} className="accent-[var(--foreground)]" />
                      {t.subscriptions.indexNetflix}
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={compute} disabled={computing || !effectiveBasePrice}>
                  {computing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {computing ? t.common.loading : "Compute suggestions"}
                </Button>
              </div>

              {computeError && (
                <div className="text-sm text-[var(--destructive)] bg-red-50 dark:bg-red-950/30 p-3 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{computeError}</span>
                </div>
              )}

              {validSuggestions.length > 0 && (
                <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-[var(--muted)]">
                      <tr>
                        <th className="text-left px-3 py-2">{t.subscriptions.territory}</th>
                        <th className="text-right px-3 py-2">{t.subscriptions.currentPrice}</th>
                        <th className="text-right px-3 py-2">{t.subscriptions.suggested}</th>
                        <th className="text-right px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validSuggestions.map((s) => {
                        const currency = INDICES[s.territory]?.currency ?? "";
                        return (
                          <tr key={s.territory} className="border-t border-[var(--border)]">
                            <td className="px-3 py-1.5 font-mono">
                              {s.territory} <span className="text-[var(--muted-foreground)]">· {INDICES[s.territory]?.name}</span>
                            </td>
                            <td className="px-3 py-1.5 text-right text-[var(--muted-foreground)]">
                              {s.current?.toFixed(2) ?? "—"}
                            </td>
                            <td className="px-3 py-1.5 text-right font-medium">
                              {s.customerPrice} <span className="text-[10px] text-[var(--muted-foreground)] font-normal">{currency}</span>
                              <span className="block text-[10px] text-[var(--muted-foreground)] font-normal">~${s.suggested.toFixed(2)}</span>
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              {s.state === "applying" && <Loader2 className="h-3 w-3 animate-spin inline" />}
                              {s.state === "ok" && <Check className="h-3 w-3 text-green-600 inline" />}
                              {s.state === "error" && <Badge variant="destructive" className="text-[10px]" title={s.error}><AlertCircle className="h-2.5 w-2.5 mr-0.5 inline" />err</Badge>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {suggestions.filter((s) => !s.pricePointId).length > 0 && (
                <details className="text-xs text-[var(--muted-foreground)]">
                  <summary className="cursor-pointer">
                    {suggestions.filter((s) => !s.pricePointId).length} territories without compatible price points
                  </summary>
                  <p className="mt-2">These usually mean Apple doesn&apos;t support that territory for this subscription yet.</p>
                </details>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-5 border-t border-[var(--border)]">
              <Button variant="outline" onClick={() => { setOpen(false); setSuggestions([]); }}>{t.subscriptions.cancel}</Button>
              <Button
                disabled={applying || validSuggestions.length === 0}
                onClick={applyAll}
              >
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {applying ? t.subscriptions.applyingPrices : t.subscriptions.applyPrices + ` (${validSuggestions.length})`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
