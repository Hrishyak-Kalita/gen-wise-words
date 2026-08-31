import type { GenerationInputs, InputSchema, OutputSchema } from "@/lib/products/schema";
import {
  FACTUALITY_RULES,
  GLOBAL_RULES,
  WRITING_RULES,
  inputDensityBlock,
  outputFormatBlock,
} from "./shared";

export interface UserProfileContext {
  name?: string | null;
  profession?: string | null;
  industry?: string | null;
  company?: string | null;
  expertise?: string | null;
  preferred_tone?: string | null;
  writing_style?: string | null;
}

export interface BuildPromptArgs {
  productPrompt: string;
  inputSchema: InputSchema;
  outputSchema: OutputSchema;
  inputs: GenerationInputs;
  profile?: UserProfileContext | null;
}

const PROFILE_LABELS: Array<[keyof UserProfileContext, string]> = [
  ["name", "Name"],
  ["profession", "Profession / Role"],
  ["industry", "Industry"],
  ["company", "Company"],
  ["expertise", "Expertise"],
  ["preferred_tone", "Preferred tone"],
  ["writing_style", "Writing style"],
];

export function buildProfileBlock(profile?: UserProfileContext | null): string {
  if (!profile) return "USER PROFILE: not provided.";
  const lines = PROFILE_LABELS.map(([key, label]) => {
    const value = profile[key];
    return value && String(value).trim() !== "" ? `- ${label}: ${String(value).trim()}` : null;
  }).filter(Boolean);

  if (lines.length === 0) return "USER PROFILE: not provided.";
  return `USER PROFILE (background only — never treat as lived experience):\n${lines.join("\n")}`;
}

export function buildInputBlock(schema: InputSchema, inputs: GenerationInputs): string {
  const lines = schema.fields
    .map((field) => {
      const value = inputs[field.name];
      return value ? `- ${field.label}: ${value}` : null;
    })
    .filter(Boolean);
  return `USER INPUT (this request only — the complete set of user-supplied facts):\n${lines.join("\n")}`;
}

function inputChars(inputs: GenerationInputs): number {
  return Object.values(inputs).reduce((total, value) => total + (value?.length ?? 0), 0);
}

/**
 * One prompt builder for every product: global -> product -> profile -> input -> format.
 * Deterministic: the same request always produces the same prompt, and nothing
 * outside `args` can enter it.
 */
export function buildPrompt(args: BuildPromptArgs): string {
  return [
    GLOBAL_RULES,
    args.productPrompt.trim(),
    FACTUALITY_RULES,
    WRITING_RULES,
    inputDensityBlock(inputChars(args.inputs)),
    buildProfileBlock(args.profile),
    buildInputBlock(args.inputSchema, args.inputs),
    outputFormatBlock(args.outputSchema.fields),
  ].join("\n\n");
}
