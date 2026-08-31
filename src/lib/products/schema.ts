import { AppError } from "@/lib/errors";

/**
 * Product input schema: a product is defined by its fields, prompt and output
 * schema — all stored in the database (products / product_versions).
 * Adding a product means adding rows, not code.
 */
export type FieldType = "text" | "textarea" | "select";

export interface ProductField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  /** Optional per-field character limit (overrides the configured defaults). */
  maxLength?: number;
}

export interface InputSchema {
  fields: ProductField[];
}

export interface OutputSchema {
  /** Names of the string fields the model must return. */
  fields: string[];
}

export type GenerationInputs = Record<string, string>;

/**
 * Configurable V1 input-length limits (characters). Long-document processing is
 * intentionally out of scope: oversized input is rejected before Gemini is called.
 */
export const INPUT_LIMITS = {
  /** Long-form fields: main topic, message, additional context. */
  textarea: 5000,
  /** Short single-line fields: recipient, audience, outcome. */
  text: 300,
  /** Select values. */
  select: 100,
  /** Cap on the total characters across all fields in one request. */
  totalRequest: 12000,
};

export const TOO_LONG_MESSAGE = "Your input is too long. Please shorten it and try again.";

export function fieldLimit(field: ProductField): number {
  return field.maxLength ?? INPUT_LIMITS[field.type] ?? INPUT_LIMITS.textarea;
}

export function parseInputSchema(raw: unknown): InputSchema {
  const fields = (raw as InputSchema | null)?.fields;
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new AppError("INTERNAL_ERROR", "Product input schema is empty or malformed");
  }
  return { fields };
}

export function parseOutputSchema(raw: unknown): OutputSchema {
  const fields = (raw as OutputSchema | null)?.fields;
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new AppError("INTERNAL_ERROR", "Product output schema is empty or malformed");
  }
  return { fields };
}

/** Validate + normalize raw form values against the product input schema. */
export function validateInputs(schema: InputSchema, raw: unknown): GenerationInputs {
  if (!raw || typeof raw !== "object") {
    throw new AppError("INVALID_INPUT", "Inputs must be an object");
  }
  const source = raw as Record<string, unknown>;
  const clean: GenerationInputs = {};

  for (const field of schema.fields) {
    const value = source[field.name];
    if (value === undefined || value === null || value === "") {
      if (field.required) {
        throw new AppError("INVALID_INPUT", `Missing required field: ${field.name}`, `${field.label} is required.`);
      }
      continue;
    }
    if (typeof value !== "string") {
      throw new AppError("INVALID_INPUT", `Field ${field.name} must be a string`);
    }
    const trimmed = value.trim();
    if (trimmed === "") {
      if (field.required) {
        throw new AppError("INVALID_INPUT", `Empty required field: ${field.name}`, `${field.label} is required.`);
      }
      continue;
    }
    const limit = fieldLimit(field);
    if (trimmed.length > limit) {
      throw new AppError(
        "INVALID_INPUT",
        `Field ${field.name} too long: ${trimmed.length} > ${limit}`,
        TOO_LONG_MESSAGE,
      );
    }
    if (field.type === "select" && field.options && !field.options.includes(trimmed)) {
      throw new AppError("INVALID_INPUT", `Invalid option for ${field.name}`, `Please pick a valid ${field.label}.`);
    }
    clean[field.name] = trimmed;
  }

  const total = Object.values(clean).reduce((sum, value) => sum + value.length, 0);
  if (total > INPUT_LIMITS.totalRequest) {
    throw new AppError(
      "INVALID_INPUT",
      `Request too long: ${total} > ${INPUT_LIMITS.totalRequest}`,
      TOO_LONG_MESSAGE,
    );
  }

  return clean;
}

/** Validate the model's structured output against the product output schema. */
export function validateOutput(schema: OutputSchema, raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AppError("OUTPUT_VALIDATION_ERROR", "Model output is not an object");
  }
  const source = raw as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const key of schema.fields) {
    const value = source[key];
    if (typeof value !== "string" || value.trim() === "") {
      throw new AppError("OUTPUT_VALIDATION_ERROR", `Model output missing field: ${key}`);
    }
    result[key] = value.trim();
  }
  return result;
}
