import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listGenerations, type HistoryItem } from "@/lib/content.functions";
import { ResultCard } from "@/components/ResultCard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "History — Draftwell" },
      { name: "description", content: "Every draft you've generated, saved in one place." },
      { property: "og:title", content: "History — Draftwell" },
      { property: "og:description", content: "Every draft you've generated, saved in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function HistoryPage() {
  const fetchHistory = useServerFn(listGenerations);
  const [selected, setSelected] = useState<HistoryItem | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["generations"],
    queryFn: () => fetchHistory(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your last 50 generations.</p>
      </div>

      {error ? <p className="text-sm text-destructive">Couldn't load your history.</p> : null}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Nothing here yet. Generate something from Create.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {(data ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground/20"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{item.productName}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {item.status === "success" ? item.preview : "Generation failed"}
                </p>
              </button>
            ))}
          </div>

          <div>
            {selected?.output ? (
              <ResultCard output={selected.output} meta={selected.productName} />
            ) : (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                  Select a generation to view it.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
