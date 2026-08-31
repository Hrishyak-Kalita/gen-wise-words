import { useState } from "react";
import { fieldLimit, TOO_LONG_MESSAGE, type InputSchema } from "@/lib/products/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DynamicFormProps {
  schema: InputSchema;
  submitLabel: string;
  loading: boolean;
  initialValues?: Record<string, string>;
  onSubmit: (values: Record<string, string>) => void;
}

/** One form component for every product, driven by the product input schema. */
export function DynamicForm({
  schema,
  submitLabel,
  loading,
  initialValues,
  onSubmit,
}: DynamicFormProps) {
  const [values, setValues] = useState<Record<string, string>>(initialValues ?? {});
  const [error, setError] = useState<string | null>(null);

  const setField = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    const missing = schema.fields.find(
      (field) => field.required && !(values[field.name] ?? "").trim(),
    );
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    const tooLong = schema.fields.find(
      (field) => (values[field.name] ?? "").trim().length > fieldLimit(field),
    );
    if (tooLong) {
      setError(TOO_LONG_MESSAGE);
      return;
    }
    setError(null);
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {schema.fields.map((field) => (
        <div key={field.name} className="space-y-2">
          <Label htmlFor={field.name}>
            {field.label}
            {field.required ? <span className="text-muted-foreground"> *</span> : null}
          </Label>

          {field.type === "textarea" ? (
            <Textarea
              id={field.name}
              rows={field.required ? 5 : 3}
              placeholder={field.placeholder ?? ""}
              value={values[field.name] ?? ""}
              onChange={(e) => setField(field.name, e.target.value)}
            />
          ) : field.type === "select" ? (
            <Select
              value={values[field.name] ?? ""}
              onValueChange={(value) => setField(field.name, value)}
            >
              <SelectTrigger id={field.name}>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {(field.options ?? []).map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={field.name}
              placeholder={field.placeholder ?? ""}
              value={values[field.name] ?? ""}
              onChange={(e) => setField(field.name, e.target.value)}
            />
          )}
        </div>
      ))}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? "Creating your content..." : submitLabel}
      </Button>
    </form>
  );
}
