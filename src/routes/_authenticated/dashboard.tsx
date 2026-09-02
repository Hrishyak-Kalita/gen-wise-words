import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUsage, listPlans, listProducts } from "@/lib/content.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Create — Draftwell" },
      {
        name: "description",
        content: "Pick a product and generate professional content.",
      },
      { property: "og:title", content: "Create — Draftwell" },
      {
        property: "og:description",
        content: "Pick a product and generate professional content.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const fetchProducts = useServerFn(listProducts);
  const fetchUsage = useServerFn(getUsage);
  const fetchPlans = useServerFn(listPlans);

  const {
    data: products,
    isLoading: productsLoading,
    error: productsError,
  } = useQuery({
    queryKey: ["products"],
    queryFn: () => fetchProducts(),
  });

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ["usage"],
    queryFn: () => fetchUsage(),
  });

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: () => fetchPlans(),
  });

  const isLoading = productsLoading || usageLoading;

  const upgradePlans = (plans ?? []).filter(
    (plan) => plan.slug === "pro" || plan.slug === "pro_plus",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">What do you want to write?</h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Pick a product, add a few details, and get a draft you can use.
        </p>
      </div>

      {usage ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Monthly generations</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-2xl font-semibold">{usage.remaining.toLocaleString()}</p>

                <p className="text-sm text-muted-foreground">
                  remaining of {usage.monthly_limit.toLocaleString()}
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                {usage.generation_count.toLocaleString()} used
              </p>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground transition-all"
                style={{
                  width: `${Math.min((usage.generation_count / usage.monthly_limit) * 100, 100)}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {usage?.remaining === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">You&apos;ve reached your monthly limit</CardTitle>

            <p className="text-sm text-muted-foreground">
              Upgrade your plan to continue generating content.
            </p>
          </CardHeader>

          <CardContent>
            {plansLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-36 w-full rounded-lg" />
                <Skeleton className="h-36 w-full rounded-lg" />
              </div>
            ) : upgradePlans.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {upgradePlans.map((plan) => (
                  <Card key={plan.id}>
                    <CardContent className="space-y-3 p-4">
                      <div>
                        <p className="font-medium">{plan.name}</p>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {plan.monthly_generations.toLocaleString()} generations per month
                        </p>
                      </div>

                      <Link
                        to="/plans"
                        className="inline-flex w-full items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
                      >
                        Upgrade to {plan.name}
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Paid plans are currently unavailable. Please try again later.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {productsError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load products. Please refresh.</p>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {(products ?? []).map((product) => (
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
      )}
    </div>
  );
}
