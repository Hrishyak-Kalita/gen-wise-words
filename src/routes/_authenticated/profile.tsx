import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getProfile, saveProfile, type ProfileData } from "@/lib/content.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
        content: "Optional background that gives your drafts more relevant context.",
      },
      { property: "og:title", content: "Profile — Draftwell" },
      {
        property: "og:description",
        content: "Optional background that gives your drafts more relevant context.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const FIELDS: Array<{ key: keyof ProfileData; label: string; long?: boolean }> = [
  { key: "name", label: "Name" },
  { key: "profession", label: "Profession / Role" },
  { key: "industry", label: "Industry" },
  { key: "company", label: "Company" },
  { key: "expertise", label: "Expertise", long: true },
  { key: "preferred_tone", label: "Preferred Tone" },
  { key: "writing_style", label: "Writing Style", long: true },
];

const EMPTY: ProfileData = {
  name: "",
  profession: "",
  industry: "",
  company: "",
  expertise: "",
  preferred_tone: "",
  writing_style: "",
};

function ProfilePage() {
  const fetchProfile = useServerFn(getProfile);
  const persist = useServerFn(saveProfile);
  const queryClient = useQueryClient();
  const [values, setValues] = useState<ProfileData>(EMPTY);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });

  useEffect(() => {
    if (data) setValues(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => persist({ data: values }),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional. This adds context to your drafts — it's never treated as personal experience.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-5 pt-6">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              {field.long ? (
                <Textarea
                  id={field.key}
                  rows={3}
                  value={values[field.key]}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                />
              ) : (
                <Input
                  id={field.key}
                  value={values[field.key]}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                />
              )}
            </div>
          ))}

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
    </div>
  );
}
