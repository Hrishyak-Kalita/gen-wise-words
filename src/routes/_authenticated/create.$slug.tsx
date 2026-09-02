import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { generateContent, getProduct, getUsage } from "@/lib/content.functions";
import { DynamicForm } from "@/components/DynamicForm";
import { ResultCard } from "@/components/ResultCard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/create/$slug")({
  head: () => ({
    meta: [
      { title: "Generate — Draftwell" },
      {
        name: "description",
        content: "Fill in a few details and generate your content.",
      },
      { property: "og:title", content: "Generate — Draftwell" },
      {
        property: "og:description",
        content: "Fill in a few details and generate your content.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreatePage,
});

const SUBMIT_LABELS: Record<string, string> = {
  linkedin_post: "Generate Post",
  cold_email: "Generate Email",
  corporate_dm: "Make It Professional",
};

function CreatePage() {
  const { slug } = Route.useParams();

  const fetchProduct = useServerFn(getProduct);
  const generate = useServerFn(generateContent);
  const fetchUsage = useServerFn(getUsage);

  const [lastInputs, setLastInputs] = useState<Record<string, string> | null>(null);

  const [result, setResult] = useState<{
    generationId: string;
    output: Record<string, string>;
    inputs: Record<string, string>;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const productQuery = useQuery({
    queryKey: ["product", slug],
    queryFn: () => fetchProduct({ data: { slug } }),
  });

  const usageQuery = useQuery({
    queryKey: ["usage"],
    queryFn: () => fetchUsage(),
  });

  const mutation = useMutation({
    mutationFn: (inputs: Record<string, string>) =>
      generate({
        data: {
          slug,
          inputs,
        },
      }),

    onMutate: () => {
      setErrorMessage(null);
    },

    onSuccess: (data) => {
      if (data) {
        setResult({
          generationId: data.generationId,
          output: data.output,
          inputs: data.inputs,
        });
      }

      usageQuery.refetch();
    },

    onError: (error: Error) => {
      setErrorMessage(error.message || "Unable to generate content right now. Please try again.");

      usageQuery.refetch();
    },
  });

  useEffect(() => {
    setLastInputs(null);
    setResult(null);
    setErrorMessage(null);
    mutation.reset();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const submit = (inputs: Record<string, string>) => {
    setLastInputs(inputs);
    mutation.mutate(inputs);
  };

  if (productQuery.isLoading) {
    return <Skeleton className="h-72 w-full rounded-xl" />;
  }

  if (productQuery.error || !productQuery.data) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          That product isn&apos;t available.{" "}
          <Link to="/dashboard" className="text-foreground underline">
            Back to products
          </Link>
        </CardContent>
      </Card>
    );
  }

  const product = productQuery.data;
  const usage = usageQuery.data;

  const hasRemainingCredits = usage ? usage.remaining > 0 : true;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← All products
        </Link>

        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{product.name}</h1>

        <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
      </div>

      {usage ? (
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Monthly generations</p>

              <p className="text-xs text-muted-foreground">
                {usage.generation_count.toLocaleString()} used of{" "}
                {usage.monthly_limit.toLocaleString()}
              </p>
            </div>

            <p className="text-sm font-medium">{usage.remaining.toLocaleString()} remaining</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <DynamicForm
              key={slug}
              schema={product.inputSchema}
              submitLabel={SUBMIT_LABELS[slug] ?? "Generate"}
              loading={mutation.isPending}
              onSubmit={submit}
              disabled={!hasRemainingCredits}
            />

            {usage && usage.remaining === 0 ? (
              <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium">You&apos;ve reached your monthly limit.</p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Upgrade your plan to continue generating content.
                </p>

                <Link
                  to="/plans"
                  className="mt-3 inline-flex items-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
                >
                  View upgrade options
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {errorMessage ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-sm text-destructive">{errorMessage}</p>

                {usage?.remaining === 0 ? (
                  <Button asChild className="mt-4">
                    <Link to="/plans">Upgrade your plan</Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {mutation.isPending ? (
            <Card>
              <CardContent className="space-y-3 py-6">
                <p className="text-sm text-muted-foreground">Creating your content...</p>

                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </CardContent>
            </Card>
          ) : null}

          {result && !mutation.isPending ? (
            <ResultCard
              output={result.output}
              regenerating={mutation.isPending}
              meta={`v${product.version}`}
              onRegenerate={() => {
                const source = result.inputs ?? lastInputs;

                if (source && hasRemainingCredits) {
                  mutation.mutate(source);
                }
              }}
            />
          ) : null}

          {!result && !mutation.isPending && !errorMessage ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                Your generated content will appear here.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
