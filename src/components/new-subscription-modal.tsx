"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, AlertCircle, Plus, CreditCard, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubscriptionGroups } from "@/hooks/use-asc";
import { ascFetch } from "@/lib/asc-client-fetch";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

const PERIODS = [
  { id: "ONE_WEEK", label: "1 week" },
  { id: "ONE_MONTH", label: "1 month" },
  { id: "TWO_MONTHS", label: "2 months" },
  { id: "THREE_MONTHS", label: "3 months" },
  { id: "SIX_MONTHS", label: "6 months" },
  { id: "ONE_YEAR", label: "1 year" },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  appId: string;
  defaultGroupId?: string;
}

export function NewSubscriptionModal({ open, onClose, accountId, appId, defaultGroupId }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const { data: groupData } = useSubscriptionGroups(accountId, appId);
  const existingGroups = groupData?.data ?? [];

  const [mode, setMode] = useState<"existing" | "new">(existingGroups.length > 0 ? "existing" : "new");
  const [groupId, setGroupId] = useState<string>(defaultGroupId ?? existingGroups[0]?.id ?? "");
  const [newGroupRef, setNewGroupRef] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [period, setPeriod] = useState<string>("ONE_MONTH");
  const [familySharable, setFamilySharable] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      setError(null);
      let finalGroupId = groupId;
      if (mode === "new") {
        if (!newGroupRef.trim()) throw new Error("Group reference name is required.");
        const groupResp = await ascFetch<{ data: { id: string } }>("v1/subscriptionGroups", {
          accountId,
          method: "POST",
          body: {
            data: {
              type: "subscriptionGroups",
              attributes: { referenceName: newGroupRef.trim() },
              relationships: { app: { data: { type: "apps", id: appId } } },
            },
          },
        });
        finalGroupId = groupResp.data.id;
      }
      if (!finalGroupId) throw new Error("Please pick or create a subscription group.");
      if (!productId.trim()) throw new Error("Product ID is required.");
      if (!name.trim()) throw new Error("Reference name is required.");

      await ascFetch("v1/subscriptions", {
        accountId,
        method: "POST",
        body: {
          data: {
            type: "subscriptions",
            attributes: {
              productId: productId.trim(),
              name: name.trim(),
              subscriptionPeriod: period,
              familySharable,
              groupLevel: 1,
            },
            relationships: {
              group: { data: { type: "subscriptionGroups", id: finalGroupId } },
            },
          },
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asc", accountId, "app", appId, "subscriptionGroups"] });
      onClose();
      setProductId("");
      setName("");
      setNewGroupRef("");
    },
    onError: (e: unknown) => {
      const err = e as { body?: { errors?: Array<{ title?: string; detail?: string }> }; message?: string };
      const apple = err?.body?.errors?.[0];
      setError([apple?.title, apple?.detail].filter(Boolean).join(" — ") || err?.message || t.common.error);
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <h2 className="font-semibold">New subscription</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Subscription group</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("existing")}
                disabled={existingGroups.length === 0}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border text-xs disabled:opacity-50",
                  mode === "existing" ? "border-[var(--foreground)] bg-[var(--muted)]" : "border-[var(--border)] hover:bg-[var(--muted)]",
                )}
              >
                <Layers className="h-4 w-4" />
                Existing
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border text-xs",
                  mode === "new" ? "border-[var(--foreground)] bg-[var(--muted)]" : "border-[var(--border)] hover:bg-[var(--muted)]",
                )}
              >
                <Plus className="h-4 w-4" />
                Create new group
              </button>
            </div>

            {mode === "existing" && existingGroups.length > 0 && (
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
              >
                {existingGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {(g.attributes as { referenceName?: string } | undefined)?.referenceName ?? g.id}
                  </option>
                ))}
              </select>
            )}
            {mode === "new" && (
              <Input
                placeholder="e.g. Pro Plans"
                value={newGroupRef}
                onChange={(e) => setNewGroupRef(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pid">Product ID</Label>
            <Input
              id="pid"
              placeholder="com.mycompany.app.pro_monthly"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            />
            <p className="text-[10px] text-[var(--muted-foreground)]">Reverse-DNS, must be unique app-wide. Cannot be changed later.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rname">Reference name</Label>
            <Input
              id="rname"
              placeholder="Pro Monthly"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-[10px] text-[var(--muted-foreground)]">Internal label. Customers see the localizations.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Period</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={cn(
                    "px-2 py-1.5 rounded-md text-xs border",
                    period === p.id ? "border-[var(--foreground)] bg-[var(--muted)]" : "border-[var(--border)] hover:bg-[var(--muted)]",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={familySharable}
              onChange={(e) => setFamilySharable(e.target.checked)}
              className="accent-[var(--foreground)]"
            />
            Family sharable
          </label>

          {error && (
            <div className="text-sm text-[var(--destructive)] bg-red-50 dark:bg-red-950/30 p-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-[var(--border)]">
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>{t.common.cancel}</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? t.common.loading : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
