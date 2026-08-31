/**
 * Provider-agnostic AI abstraction. The generation engine only knows this
 * interface, so another provider can be added without touching product logic.
 */
export interface GenerateRequest {
  prompt: string;
  /** Object keys the provider must return as strings. */
  outputFields: string[];
  timeoutMs?: number;
}

export interface GenerateResult {
  /** Raw text returned by the model (expected to be JSON). */
  text: string;
  model: string;
  usage?: { promptTokens?: number | undefined; completionTokens?: number | undefined };
}

export interface AIProvider {
  readonly model: string;
  generate(request: GenerateRequest): Promise<GenerateResult>;
}
