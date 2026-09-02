import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { InputSchema } from "@/lib/products/schema";

interface DynamicFormProps {
  schema: InputSchema;
  submitLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  onSubmit: (values: Record<string, string>) => void;
}

export function DynamicForm({
  schema,
  submitLabel = "Generate",
  loading = false,
  disabled = false,
  onSubmit,
}: DynamicFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  const updateValue = (name: string, value: string) => {
    setValues((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading || disabled) {
      return;
    }

    onSubmit(values);
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {schema.fields.map((field) => {
        const value = values[field.name] ?? "";

        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required ? <span className="ml-1 text-destructive">*</span> : null}
            </Label>

            {field.type === "textarea" ? (
              <Textarea
                id={field.name}
                value={value}
                required={field.required}
                disabled={disabled || loading}
                onChange={(event) => updateValue(field.name, event.target.value)}
              />
            ) : (
              <Input
                id={field.name}
                value={value}
                required={field.required}
                disabled={disabled || loading}
                onChange={(event) => updateValue(field.name, event.target.value)}
              />
            )}
          </div>
        );
      })}

      <Button type="submit" className="w-full" disabled={disabled || loading}>
        {loading ? "Generating..." : submitLabel}
      </Button>
    </form>
  );
}
