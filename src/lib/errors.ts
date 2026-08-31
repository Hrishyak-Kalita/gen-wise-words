/**
 * Centralized error handling.
 *
 * Internal code + technical detail stays server-side (logged), while the
 * `message` is always safe to show to a user.
 */
export type ErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "PRODUCT_NOT_FOUND"
  | "AI_PROVIDER_ERROR"
  | "AI_TIMEOUT"
  | "INVALID_AI_RESPONSE"
  | "OUTPUT_VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const USER_MESSAGES: Record<ErrorCode, string> = {
  INVALID_INPUT: "Please check the form and try again.",
  UNAUTHORIZED: "Please sign in to continue.",
  PRODUCT_NOT_FOUND: "That product isn't available right now.",
  AI_PROVIDER_ERROR: "Unable to generate content right now. Please try again.",
  AI_TIMEOUT: "That took too long. Please try again.",
  INVALID_AI_RESPONSE: "Unable to generate content right now. Please try again.",
  OUTPUT_VALIDATION_ERROR: "Unable to generate content right now. Please try again.",
  RATE_LIMITED: "You've made a lot of requests. Please wait a moment and try again.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly userMessage: string;

  constructor(code: ErrorCode, technicalMessage?: string, userMessage?: string) {
    super(technicalMessage ?? code);
    this.name = "AppError";
    this.code = code;
    this.userMessage = userMessage ?? USER_MESSAGES[code];
  }

  /** Shape returned across the RPC boundary — never includes stack traces. */
  toClient() {
    return { code: this.code, message: this.userMessage } as const;
  }
}

export function userMessageFor(code: ErrorCode): string {
  return USER_MESSAGES[code];
}

/** Extract a safe, user-facing message from anything thrown client-side. */
export function toUserMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const maybe = error as { code?: string; message?: string };
    if (maybe.code && maybe.code in USER_MESSAGES) {
      return USER_MESSAGES[maybe.code as ErrorCode];
    }
    if (typeof maybe.message === "string" && maybe.message.startsWith("APP_ERROR:")) {
      const code = maybe.message.replace("APP_ERROR:", "").trim() as ErrorCode;
      if (code in USER_MESSAGES) return USER_MESSAGES[code];
    }
  }
  return USER_MESSAGES.INTERNAL_ERROR;
}
