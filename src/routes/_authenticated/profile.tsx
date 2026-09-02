import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getProfile, saveProfile, type ProfileData } from "@/lib/content.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Draftwell" },
      {
        name: "description",
        content: "Manage your profile and writing preferences.",
      },
      { property: "og:title", content: "Profile — Draftwell" },
      {
        property: "og:description",
        content: "Manage your profile and writing preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const EMPTY: ProfileData = {
  name: "",
  profession: "",
  industry: "",
  company: "",
  expertise: "",
  preferred_tone: "",
  writing_style: "",
};

const TONE_OPTIONS = ["Professional", "Conversational", "Thoughtful", "Bold"];

function ProfilePage() {
  const fetchProfile = useServerFn(getProfile);
  const persist = useServerFn(saveProfile);
  const queryClient = useQueryClient();

  const [values, setValues] = useState<ProfileData>(EMPTY);
  const [saved, setSaved] = useState(false);

  const {
    data,
    isLoading,
    error: profileError,
  } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });

  useEffect(() => {
    if (data) {
      setValues(data);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      persist({
        data: {
          name: values.name,
          profession: values.profession,
          industry: values.industry,
          expertise: values.expertise,
          preferred_tone: values.preferred_tone,
        },
      }),

    onSuccess: async () => {
      setSaved(true);

      await queryClient.invalidateQueries({
        queryKey: ["profile"],
      });

      window.setTimeout(() => {
        setSaved(false);
      }, 2000);
    },
  });

  const updateValue = (field: keyof ProfileData, value: string) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));

    setSaved(false);
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl">
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="max-w-2xl">
        <Card>
          <CardContent className="py-8 text-sm text-destructive">
            Unable to load your profile. Please try again.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Add a few details to make your generated content more relevant.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">About you</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>

            <Input
              id="name"
              value={values.name}
              placeholder="Your name"
              maxLength={300}
              onChange={(event) => updateValue("name", event.target.value)}
            />
          </div>

          {/* Profession */}
          <div className="space-y-2">
            <Label htmlFor="profession">Profession</Label>

            <Input
              id="profession"
              value={values.profession}
              placeholder="e.g. Software Engineer"
              maxLength={300}
              onChange={(event) => updateValue("profession", event.target.value)}
            />
          </div>

          {/* Industry */}
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>

            <Input
              id="industry"
              value={values.industry}
              placeholder="e.g. Technology"
              maxLength={300}
              onChange={(event) => updateValue("industry", event.target.value)}
            />
          </div>

          {/* Expertise */}
          <div className="space-y-2">
            <Label htmlFor="expertise">Areas of expertise</Label>

            <Textarea
              id="expertise"
              rows={3}
              value={values.expertise}
              placeholder="e.g. AI, web development, system design"
              maxLength={1000}
              onChange={(event) => updateValue("expertise", event.target.value)}
            />
          </div>

          {/* Preferred Tone */}
          <div className="space-y-2">
            <Label htmlFor="preferred_tone">Preferred tone</Label>

            <select
              id="preferred_tone"
              value={values.preferred_tone}
              onChange={(event) => updateValue("preferred_tone", event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">Select a tone</option>

              {TONE_OPTIONS.map((tone) => (
                <option key={tone} value={tone}>
                  {tone}
                </option>
              ))}
            </select>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 border-t border-border pt-4">
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save profile"}
            </Button>

            {saved ? <span className="text-sm text-muted-foreground">Saved</span> : null}

            {mutation.error ? (
              <span className="text-sm text-destructive">Couldn't save. Please try again.</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Plan & Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan & Usage</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Manage your plan</p>

              <p className="mt-1 text-sm text-muted-foreground">
                View your current plan, generation limit, usage, and available upgrades.
              </p>
            </div>

            <Button asChild variant="outline">
              <Link to="/plans">Manage plan</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
