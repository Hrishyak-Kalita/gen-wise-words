import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProducts } from "@/lib/content.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Create — Draftwell" },
      { name: "description", content: "Pick a product and generate professional content." },
      { property: "og:title", content: "Create — Draftwell" },
      { property: "og:description", content: "Pick a product and generate professional content." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const fetchProducts = useServerFn(listProducts);
  const { data, isLoading, error } = useQuery({
    queryKey: ["products"],
    queryFn: () => fetchProducts(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">What do you want to write?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a product, add a few details, and get a draft you can use.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">Couldn't load products. Please refresh.</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {isLoading
          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
          : (data ?? []).map((product) => (
              <Link key={product.slug} to="/create/$slug" params={{ slug: product.slug }}>
                <Card className="h-full transition-colors hover:border-foreground/20">
                  <CardHeader>
                    <CardTitle className="text-base">{product.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{product.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>
    </div>
  );
}
