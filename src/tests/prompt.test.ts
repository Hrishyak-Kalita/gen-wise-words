import { describe, expect, it } from "vitest";
import { buildPrompt } from "@/lib/prompts/build-prompt";
import type { InputSchema } from "@/lib/products/schema";

const inputSchema: InputSchema = {
  fields: [
    { name: "topic", label: "Topic", type: "textarea", required: true },
    { name: "tone", label: "Tone", type: "select", options: ["Bold"] },
  ],
};

const base = {
  productPrompt: "PRODUCT: LinkedIn Post\nFocus on one idea.",
  inputSchema,
  outputSchema: { fields: ["content"] },
};

describe("buildPrompt", () => {
  it("includes global rules, product prompt, inputs and output format", () => {
    const prompt = buildPrompt({ ...base, inputs: { topic: "fundamentals", tone: "Bold" } });
    expect(prompt).toContain("FACTUALITY");
    expect(prompt).toContain("PRODUCT: LinkedIn Post");
    expect(prompt).toContain("- Topic: fundamentals");
    expect(prompt).toContain("- Tone: Bold");
    expect(prompt).toContain('"content": "..."');
    expect(prompt).not.toContain("undefined");
  });

  it("includes profile as background only", () => {
    const prompt = buildPrompt({
      ...base,
      inputs: { topic: "x" },
      profile: { profession: "Software Engineer", company: null },
    });
    expect(prompt).toContain("never treat as lived experience");
    expect(prompt).toContain("- Profession / Role: Software Engineer");
    expect(prompt).not.toContain("Company:");
  });

  it("states when no profile exists", () => {
    const prompt = buildPrompt({ ...base, inputs: { topic: "x" } });
    expect(prompt).toContain("USER PROFILE: not provided.");
  });

  it("omits optional fields the user left blank", () => {
    const prompt = buildPrompt({ ...base, inputs: { topic: "x" } });
    expect(prompt).not.toContain("- Tone:");
  });
});
