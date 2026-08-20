"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, AlertCircle, Rocket, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ascFetch } from "@/lib/asc-client-fetch";
import { useT } from "@/components/i18n-provider";
import { interpolate } from "@/lib/i18n/dict";

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  appId: string;
  versionId: string;
  versionString: string;
  platform: string;
}

export function SubmitReviewModal({ open, onClose, accountId, appId, versionId, versionString, platform }: Props) {
  const qc = useQueryClient();
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      setError(null);
      setStep(t.submitReview.stepCreate);
      const sub = await ascFetch<{ data: { id: string } }>("v1/reviewSubmissions", {
        accountId,
        method: "POST",
        body: {
          data: {
            type: "reviewSubmissions",
            attributes: { platform },
            relationships: { app: { data: { type: "apps", id: appId } } },
          },
        },
      });
      setStep(t.submitReview.stepLink);
      await ascFetch("v1/reviewSubmissionItems", {
        accountId,
        method: "POST",
        body: {
          data: {
            type: "reviewSubmissionItems",
            relationships: {
              reviewSubmission: { data: { type: "reviewSubmissions", id: sub.data.id } },
              appStoreVersion: { data: { type: "appStoreVersions", id: versionId } },
            },
          },
        },
      });
      setStep(t.submitReview.stepSubmit);
      await ascFetch(`v1/reviewSubmissions/${sub.data.id}`, {
        accountId,
        method: "PATCH",
        body: {
          data: {
            id: sub.data.id,
            type: "reviewSubmissions",
            attributes: { submitted: true },
          },
        },
      });
      setStep(null);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asc", accountId, "app", appId, "versions"] });
      qc.invalidateQueries({ queryKey: ["asc", accountId, "version", versionId] });
      // close after a short success display
      setTimeout(onClose, 1500);
    },
    onError: (e: unknown) => {
      const err = e as { body?: { errors?: Array<{ detail?: string; title?: string; code?: string }> }; message?: string };
      const apple = err?.body?.errors?.[0];
      const parts = [apple?.title, apple?.detail].filter(Boolean);
      setError(parts.length ? parts.join(" — ") : err?.message || t.common.error);
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            <h2 className="font-semibold">{t.submitReview.title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={submit.isPending}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-5 space-y-3 text-sm">
          {submit.isSuccess ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <p className="font-medium">{t.submitReview.sent}</p>
              <p className="text-xs text-[var(--muted-foreground)] text-center">
                {interpolate(t.submitReview.sentDesc, { version: versionString })}
              </p>
            </div>
          ) : (
            <>
              <p>{interpolate(t.submitReview.readyText, { version: versionString })}</p>
              <ul className="text-xs text-[var(--muted-foreground)] space-y-1 bg-[var(--muted)] rounded-lg p-3">
                <li>• {t.submitReview.req1}</li>
                <li>• {t.submitReview.req2}</li>
                <li>• {t.submitReview.req3}</li>
                <li>• {t.submitReview.req4}</li>
              </ul>
              {submit.isPending && step && (
                <p className="text-xs text-[var(--muted-foreground)] italic">{step}</p>
              )}
              {error && (
                <div className="text-sm text-[var(--destructive)] bg-red-50 dark:bg-red-950/30 p-3 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {!submit.isSuccess && (
          <div className="flex items-center justify-end gap-2 p-5 border-t border-[var(--border)]">
            <Button variant="outline" onClick={onClose} disabled={submit.isPending}>{t.common.cancel}</Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
              <Rocket className="h-4 w-4" />
              {submit.isPending ? t.submitReview.submitting : t.submitReview.submit}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
