"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Trash2, Plus, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropzoneP8 } from "@/components/dropzone-p8";
import { useT } from "@/components/i18n-provider";
import { interpolate } from "@/lib/i18n/dict";
import { formatDate } from "@/lib/utils";

const AddSchema = z.object({
  label: z.string().min(1, "Required").max(80),
  issuerId: z.string().min(10, "Invalid Issuer ID"),
  keyId: z.string().min(4, "Invalid Key ID").regex(/^[A-Z0-9]+$/i, "Letters and digits only"),
});

type AddInput = z.infer<typeof AddSchema>;

interface AccountSummary {
  id: string;
  label: string;
  issuerId: string;
  keyId: string;
  createdAt: number;
}

export default function AccountsPage() {
  const qc = useQueryClient();
  const t = useT();
  const [showForm, setShowForm] = useState(false);
  const [p8, setP8] = useState<string | null>(null);
  const [p8Name, setP8Name] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["accounts"],
    queryFn: async (): Promise<AccountSummary[]> => {
      const r = await fetch("/api/vault/accounts");
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || d.error || "FAILED");
      return d.accounts;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (input: AddInput & { p8: string }) => {
      const r = await fetch("/api/vault/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.message || e.error || "FAILED");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setShowForm(false);
      setP8(null);
      setP8Name(null);
      setFormError(null);
      reset();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch("/api/vault/accounts?id=" + encodeURIComponent(id), { method: "DELETE" });
      if (!r.ok) {
        const error = await r.json().catch(() => ({}));
        throw new Error(error.message || error.error || "FAILED");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddInput>({ resolver: zodResolver(AddSchema) });

  function onSubmit(values: AddInput) {
    setFormError(null);
    if (!p8) {
      setFormError(t.accounts.requireP8);
      return;
    }
    addMutation.mutate({ ...values, p8 });
  }

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.accounts.title}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{t.accounts.subtitle}</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> {t.accounts.addAccount}
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{t.accounts.newAccount}</CardTitle>
            <CardDescription>{t.accounts.newAccountHelp}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="label">{t.accounts.label}</Label>
                <Input id="label" placeholder={t.accounts.labelPh} {...register("label")} />
                {errors.label && <p className="text-xs text-[var(--destructive)]">{errors.label.message}</p>}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issuerId">{t.accounts.issuerId}</Label>
                  <Input id="issuerId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" {...register("issuerId")} />
                  {errors.issuerId && <p className="text-xs text-[var(--destructive)]">{errors.issuerId.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="keyId">{t.accounts.keyId}</Label>
                  <Input id="keyId" placeholder={t.accounts.keyIdPh} {...register("keyId")} />
                  {errors.keyId && <p className="text-xs text-[var(--destructive)]">{errors.keyId.message}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t.accounts.privateKey}</Label>
                <DropzoneP8
                  fileName={p8Name}
                  onLoaded={(content, name) => {
                    setP8(content);
                    setP8Name(name);
                  }}
                />
              </div>
              {formError && (
                <div className="text-sm text-[var(--destructive)] bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">{formError}</div>
              )}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setP8(null); setP8Name(null); setFormError(null); reset(); }}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? t.common.sending : t.common.save}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {isLoading && <Card><CardContent className="p-6 text-sm text-[var(--muted-foreground)]">{t.common.loading}</CardContent></Card>}
        {loadError && <Card><CardContent className="p-6 text-sm text-[var(--destructive)]">{(loadError as Error).message}</CardContent></Card>}
        {deleteMutation.isError && <Card><CardContent className="p-6 text-sm text-[var(--destructive)]">{(deleteMutation.error as Error).message}</CardContent></Card>}
        {data?.length === 0 && !showForm && (
          <Card>
            <CardContent className="p-10 text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto">
                <KeyRound className="h-6 w-6 text-[var(--muted-foreground)]" />
              </div>
              <div>
                <p className="font-medium">{t.accounts.empty}</p>
                <p className="text-sm text-[var(--muted-foreground)]">{t.accounts.emptyDesc}</p>
              </div>
              <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> {t.accounts.addAccount}</Button>
            </CardContent>
          </Card>
        )}
        {data?.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-[var(--muted)] flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{a.label}</p>
                  <p className="text-xs text-[var(--muted-foreground)] font-mono truncate">
                    Key ID: {a.keyId} · Issuer: {a.issuerId.slice(0, 8)}…
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">{t.accounts.addedAt}: {formatDate(a.createdAt)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (confirm(interpolate(t.accounts.deleteConfirm, { name: a.label }))) {
                    deleteMutation.mutate(a.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 text-[var(--destructive)]" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
