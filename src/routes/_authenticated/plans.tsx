import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSubscription, listPlans } from "@/lib/content.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({
    meta: [
      { title: "Plans — Draftwell" },
      {
        name: "description",
        content: "Choose the Draftwell plan that fits your needs.",
      },
    ],
  }),
  component: PlansPage,
});

function formatPrice(amount: number, currency: string): string {
  if (amount === 0) {
    return "Free";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function PlansPage() {
  const fetchPlans = useServerFn(listPlans);
  const fetchSubscription = useServerFn(getSubscription);

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: () => fetchPlans(),
  });

  const subscriptionQuery = useQuery({
    queryKey: ["subscription"],
    queryFn: () => fetchSubscription(),
  });

  if (plansQuery.isLoading || subscriptionQuery.isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-72 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (plansQuery.error || subscriptionQuery.error) {
    return <p className="text-sm text-destructive">Couldn&apos;t load plans. Please refresh.</p>;
  }

  const plans = plansQuery.data ?? [];
  const currentPlan = subscriptionQuery.data?.plan;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Choose the plan that fits your writing needs.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Current plan</p>

        <div className="mt-1 flex items-center justify-between">
          <div>
            <p className="font-medium">{currentPlan?.name}</p>

            <p className="text-sm text-muted-foreground">
              {currentPlan?.monthly_generations.toLocaleString()} generations per month
            </p>
          </div>

          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">Active</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.slug === currentPlan?.slug;

          return (
            <Card key={plan.id} className={isCurrent ? "border-foreground" : undefined}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
              </CardHeader>

              <CardContent className="space-y-5">
                <div>
                  <span className="text-3xl font-semibold">
                    {formatPrice(plan.price_monthly, plan.currency)}
                  </span>

                  {plan.price_monthly > 0 ? (
                    <span className="text-sm text-muted-foreground"> / month</span>
                  ) : null}
                </div>

                <p className="text-sm text-muted-foreground">
                  {plan.monthly_generations.toLocaleString()} generations per month
                </p>

                <Button
                  className="w-full"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent}
                >
                  {isCurrent ? "Current plan" : "Upgrade"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Paid upgrades will be available soon.
      </p>
    </div>
  );
}
