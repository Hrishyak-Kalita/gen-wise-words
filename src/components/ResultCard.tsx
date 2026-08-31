import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ResultCardProps {
  output: Record<string, string>;
  onRegenerate?: () => void;
  regenerating?: boolean;
  meta?: string;
}

function copyText(output: Record<string, string>) {
  if (output["subject"]) {
    return `Subject: ${output["subject"]}\n\n${output["content"] ?? ""}`.trim();
  }
  return output["content"] ?? "";
}

export function ResultCard({ output, onRegenerate, regenerating, meta }: ResultCardProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(copyText(output));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Result</CardTitle>
        {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {output["subject"] ? (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Subject
            </p>
            <p className="font-medium text-foreground">{output["subject"]}</p>
          </div>
        ) : null}

        <div className="space-y-1">
          {output["subject"] ? (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Email
            </p>
          ) : null}
          <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-foreground">
            {output["content"]}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </Button>
          {onRegenerate ? (
            <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={regenerating}>
              {regenerating ? "Regenerating..." : "Regenerate"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
