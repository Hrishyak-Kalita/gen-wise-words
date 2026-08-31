import { describe, expect, it } from "vitest";
import { validateInputs, validateOutput, type InputSchema } from "@/lib/products/schema";
import { AppError } from "@/lib/errors";

const schema: InputSchema = {
  fields: [
    { name: "topic", label: "Topic", type: "textarea", required: true },
    { name: "tone", label: "Tone", type: "select", options: ["Professional", "Bold"] },
    { name: "audience", label: "Target Audience", type: "text" },
  ],
};

describe("validateInputs", () => {
  it("keeps and trims provided values", () => {
    expect(validateInputs(schema, { topic: "  fundamentals  ", audience: "devs" })).toEqual({
      topic: "fundamentals",
      audience: "devs",
    });
  });

  it("rejects a missing required field", () => {
    expect(() => validateInputs(schema, { audience: "devs" })).toThrowError(AppError);
  });

  it("rejects an empty required field", () => {
    expect(() => validateInputs(schema, { topic: "   " })).toThrowError(/required/i);
  });

  it("rejects an invalid select option", () => {
    expect(() => validateInputs(schema, { topic: "x", tone: "Sassy" })).toThrowError(AppError);
  });

  it("rejects oversized input", () => {
    expect(() => validateInputs(schema, { topic: "a".repeat(5000) })).toThrowError(AppError);
  });

  it("drops unknown fields", () => {
    expect(validateInputs(schema, { topic: "x", secret: "y" })).toEqual({ topic: "x" });
  });
});

describe("validateOutput", () => {
  const output = { fields: ["subject", "content"] };

  it("accepts a valid structured response", () => {
    expect(validateOutput(output, { subject: "Hi", content: "Body", extra: 1 })).toEqual({
      subject: "Hi",
      content: "Body",
    });
  });

  it("rejects a missing field", () => {
    expect(() => validateOutput(output, { subject: "Hi" })).toThrowError(AppError);
  });

  it("rejects an empty field", () => {
    expect(() => validateOutput(output, { subject: "Hi", content: "  " })).toThrowError(AppError);
  });

  it("rejects a non-object response", () => {
    expect(() => validateOutput(output, "text")).toThrowError(AppError);
  });
});
