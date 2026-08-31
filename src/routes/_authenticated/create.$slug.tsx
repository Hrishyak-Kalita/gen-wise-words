import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { generateContent, getProduct } from "@/lib/content.functions";
import { DynamicForm } from "@/components/DynamicForm";
import { ResultCard } from "@/components/ResultCard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/create/$slug")({
  head: () => ({
    meta: [
      { title: "Generate — Draftwell" },
      { name: "description", content: "Fill in a few details and generate your content." },
      { property: "og:title", content: "Generate — Draftwell" },
      { property: "og:description", content: "Fill in a few details and generate your content." },
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

  const [lastInputs, setLastInputs] = useState<Record<string, string> | null>(null);
  const [result, setResult] = useState<{
    generationId: string;
    output: Record<string, string>;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Request isolation: switching products keeps this route component mounted,
  // so every piece of per-product state must be cleared when the slug changes.
  // Without this, a previous product's form values / result could leak into the
  // next generation.
  useEffect(() => {
    setLastInputs(null);
    setResult(null);
    setErrorMessage(null);
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const productQuery = useQuery({
    queryKey: ["product", slug],
    queryFn: () => fetchProduct({ data: { slug } }),
  });

  const mutation = useMutation({
    mutationFn: (inputs: Record<string, string>) => generate({ data: { slug, inputs } }),
    onMutate: () => setErrorMessage(null),
    onSuccess: (data) => {
      if (data) setResult({ generationId: data.generationId, output: data.output });
    },
    onError: (error: Error) =>
      setErrorMessage(error.message || "Unable to generate content right now. Please try again."),
  });

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
          That product isn't available.{" "}
          <Link to="/dashboard" className="text-foreground underline">
            Back to products
          </Link>
        </CardContent>
      </Card>
    );
  }

  const product = productQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← All products
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{product.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <DynamicForm
              key={slug}
              schema={product.inputSchema}
              submitLabel={SUBMIT_LABELS[slug] ?? "Generate"}
              loading={mutation.isPending}
              onSubmit={submit}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {errorMessage ? (
            <Card>
              <CardContent className="py-6 text-sm text-destructive">{errorMessage}</CardContent>
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
                if (lastInputs) mutation.mutate(lastInputs);
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
