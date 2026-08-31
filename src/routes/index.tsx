import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Draftwell — Professional content in seconds" },
      {
        name: "description",
        content:
          "Turn your ideas into polished LinkedIn posts, cold emails and professional messages.",
      },
      { property: "og:title", content: "Draftwell — Professional content in seconds" },
      {
        property: "og:description",
        content:
          "Turn your ideas into polished LinkedIn posts, cold emails and professional messages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const PRODUCTS = [
  {
    name: "LinkedIn Post",
    description: "Turn your ideas into natural, professional LinkedIn posts.",
  },
  {
    name: "Cold Email",
    description: "Create concise and personalized cold emails.",
  },
  {
    name: "Professional DM",
    description: "Turn your thoughts into polished professional messages.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="font-semibold tracking-tight">Draftwell</span>
          <Link to="/auth">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        <section className="py-20 sm:py-28">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Create professional content in seconds.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Turn your ideas into polished LinkedIn posts, cold emails and professional messages.
          </p>
          <div className="mt-8">
            <Link to="/auth">
              <Button size="lg">Start Creating</Button>
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-3">
          {PRODUCTS.map((product) => (
            <Card key={product.name}>
              <CardHeader>
                <CardTitle className="text-base">{product.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{product.description}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <p className="mx-auto max-w-5xl px-4 text-sm text-muted-foreground sm:px-6">
          Draftwell writes from what you tell it. Nothing is invented on your behalf.
        </p>
      </footer>
    </div>
  );
}
