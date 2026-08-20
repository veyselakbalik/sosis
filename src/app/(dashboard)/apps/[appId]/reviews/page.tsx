"use client";

import { use, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, MessageSquare, Send } from "lucide-react";
import { useReviews } from "@/hooks/use-asc";
import { useActiveAccountId } from "@/hooks/use-active-account";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { ascFetch } from "@/lib/asc-client-fetch";
import { useT } from "@/components/i18n-provider";

const RESP_MAX = 5970;

export default function ReviewsPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = use(params);
  const accountId = useActiveAccountId();
  const t = useT();
  const [rating, setRating] = useState<number | undefined>(undefined);
  const { data, isLoading, error } = useReviews(accountId, appId, { rating });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] mr-1">{t.reviews.filterStarLabel}</span>
          <button
            onClick={() => setRating(undefined)}
            className={`px-2.5 py-1 rounded-md text-xs border ${rating === undefined ? "border-[var(--foreground)] bg-[var(--muted)]" : "border-[var(--border)] hover:bg-[var(--muted)]"}`}
          >
            {t.reviews.all}
          </button>
          {[5, 4, 3, 2, 1].map((r) => (
            <button
              key={r}
              onClick={() => setRating(r)}
              className={`px-2.5 py-1 rounded-md text-xs border flex items-center gap-1 ${
                rating === r ? "border-[var(--foreground)] bg-[var(--muted)]" : "border-[var(--border)] hover:bg-[var(--muted)]"
              }`}
            >
              {r} <Star className="h-3 w-3 fill-current" />
            </button>
          ))}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 h-24 bg-[var(--muted)] animate-pulse" /></Card>
          ))}
        </div>
      )}
      {error && <Card><CardContent className="p-6 text-sm text-[var(--destructive)]">{t.reviews.loadFailed}: {(error as Error).message}</CardContent></Card>}
      {data && data.length === 0 && <Card><CardContent className="p-10 text-center text-[var(--muted-foreground)]">{t.reviews.empty}</CardContent></Card>}

      {data?.map((r) => (
        <ReviewItem key={r.id} accountId={accountId!} appId={appId} review={r} />
      ))}
    </div>
  );
}

function ReviewItem({
  accountId,
  appId,
  review,
}: {
  accountId: string;
  appId: string;
  review: { id: string; attributes?: { rating?: number; title?: string; body?: string; reviewerNickname?: string; createdDate?: string; territory?: string } };
}) {
  const qc = useQueryClient();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const respond = useMutation({
    mutationFn: async () => {
      await ascFetch("v1/customerReviewResponses", {
        accountId,
        method: "POST",
        body: {
          data: {
            type: "customerReviewResponses",
            attributes: { responseBody: text },
            relationships: { review: { data: { id: review.id, type: "customerReviews" } } },
          },
        },
      });
    },
    onSuccess: () => {
      setOpen(false);
      setText("");
      qc.invalidateQueries({ queryKey: ["asc", accountId, "app", appId, "reviews"] });
    },
  });

  const rating = review.attributes?.rating ?? 0;

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-3.5 w-3.5 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-[var(--border)]"}`} />
                ))}
              </div>
              <span className="text-xs font-mono text-[var(--muted-foreground)]">{review.attributes?.territory}</span>
              <span className="text-xs text-[var(--muted-foreground)]">{formatDateTime(review.attributes?.createdDate)}</span>
            </div>
            {review.attributes?.title && <p className="font-medium mt-1">{review.attributes.title}</p>}
            <p className="text-xs text-[var(--muted-foreground)]">{review.attributes?.reviewerNickname}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
            <MessageSquare className="h-4 w-4" />
            {open ? t.reviews.close : t.reviews.reply}
          </Button>
        </div>
        {review.attributes?.body && <p className="text-sm whitespace-pre-wrap">{review.attributes.body}</p>}

        {open && (
          <div className="border-t border-[var(--border)] pt-3 space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              maxLength={RESP_MAX}
              placeholder={t.reviews.replyPh}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] resize-y"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">{text.length} / {RESP_MAX}</span>
              <Button size="sm" disabled={!text.trim() || respond.isPending} onClick={() => respond.mutate()}>
                <Send className="h-4 w-4" />
                {respond.isPending ? t.reviews.sending : t.reviews.send}
              </Button>
            </div>
            {respond.isError && <p className="text-xs text-[var(--destructive)]">{(respond.error as Error).message}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
