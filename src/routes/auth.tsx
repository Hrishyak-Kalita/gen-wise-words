import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Draftwell" },
      { name: "description", content: "Sign in or create your Draftwell account to start writing." },
      { property: "og:title", content: "Sign in — Draftwell" },
      {
        property: "og:description",
        content: "Sign in or create your Draftwell account to start writing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "reset";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) throw signUpError;
        const { data } = await supabase.auth.getSession();
        if (data.session) navigate({ to: "/dashboard" });
        else setMessage("Check your email to confirm your account, then sign in.");
      } else if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        navigate({ to: "/dashboard" });
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (resetError) throw resetError;
        setMessage("Password reset email sent.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 block text-sm text-muted-foreground hover:text-foreground">
          ← Draftwell
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {mode === "signup"
                ? "Create your account"
                : mode === "reset"
                  ? "Reset your password"
                  : "Sign in"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {mode !== "reset" ? (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              ) : null}

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : mode === "signup"
                    ? "Create account"
                    : mode === "reset"
                      ? "Send reset link"
                      : "Sign in"}
              </Button>
            </form>

            {mode !== "reset" ? (
              <Button variant="outline" className="w-full" onClick={google}>
                Continue with Google
              </Button>
            ) : null}

            <div className="flex flex-col gap-1 pt-1 text-sm text-muted-foreground">
              {mode !== "signup" ? (
                <button type="button" className="text-left hover:text-foreground" onClick={() => setMode("signup")}>
                  Don't have an account? Sign up
                </button>
              ) : null}
              {mode !== "signin" ? (
                <button type="button" className="text-left hover:text-foreground" onClick={() => setMode("signin")}>
                  Already have an account? Sign in
                </button>
              ) : null}
              {mode !== "reset" ? (
                <button type="button" className="text-left hover:text-foreground" onClick={() => setMode("reset")}>
                  Forgot your password?
                </button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
