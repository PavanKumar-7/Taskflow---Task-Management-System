import { getEnv, type AppEnv } from "@/lib/validation/env";
import type { EmailProvider, SendEmailOptions, SendEmailResult } from "@/lib/email/types";
import { PreviewEmailProvider } from "@/lib/email/providers/preview";
import { GmailEmailProvider } from "@/lib/email/providers/gmail";
import { ResendEmailProvider } from "@/lib/email/providers/resend";

export type ProviderResolutionResult =
  | { success: true; provider: EmailProvider }
  | { success: false; reason: "PROVIDER_NOT_CONFIGURED" | "PROVIDER_ERROR"; error: string };

/**
 * Resolves the appropriate email provider following explicit precedence rules.
 *
 * Precedence:
 * 1. Explicit `EMAIL_PROVIDER` ("gmail" | "resend" | "preview").
 * 2. Omitted `EMAIL_PROVIDER`:
 *    a. If `EMAIL_DEV_MODE === "preview"` -> preview provider.
 *    b. If `GMAIL_USER` and `GMAIL_APP_PASSWORD` are defined -> gmail provider.
 *    c. If `RESEND_API_KEY` is defined -> resend provider.
 *    d. If in development/test mode -> preview provider fallback.
 *    e. If in production -> unconfigured error.
 */
export function resolveEmailProvider(currentEnv?: AppEnv): ProviderResolutionResult {
  const env = currentEnv || getEnv();
  const isDev = env.NODE_ENV === "development" || env.NODE_ENV === "test";

  // 1. Explicit EMAIL_PROVIDER setting
  if (env.EMAIL_PROVIDER) {
    switch (env.EMAIL_PROVIDER) {
      case "gmail": {
        if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
          return {
            success: false,
            reason: "PROVIDER_NOT_CONFIGURED",
            error:
              "Gmail provider selected (EMAIL_PROVIDER=gmail), but GMAIL_USER or GMAIL_APP_PASSWORD is not set in environment.",
          };
        }
        return {
          success: true,
          provider: new GmailEmailProvider(env.GMAIL_USER, env.GMAIL_APP_PASSWORD),
        };
      }
      case "resend": {
        if (!env.RESEND_API_KEY) {
          return {
            success: false,
            reason: "PROVIDER_NOT_CONFIGURED",
            error:
              "Resend provider selected (EMAIL_PROVIDER=resend), but RESEND_API_KEY is not set in environment.",
          };
        }
        return {
          success: true,
          provider: new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM),
        };
      }
      case "preview": {
        return {
          success: true,
          provider: new PreviewEmailProvider(),
        };
      }
      default: {
        return {
          success: false,
          reason: "PROVIDER_NOT_CONFIGURED",
          error: `Unknown EMAIL_PROVIDER: "${env.EMAIL_PROVIDER}". Valid options are 'gmail', 'resend', or 'preview'.`,
        };
      }
    }
  }

  // 2. Omitted EMAIL_PROVIDER — automatic resolution
  if (
    env.EMAIL_DEV_MODE === "preview" ||
    env.EMAIL_DEV_MODE === "true" ||
    env.EMAIL_DEV_MODE === "mock"
  ) {
    return {
      success: true,
      provider: new PreviewEmailProvider(),
    };
  }

  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
    return {
      success: true,
      provider: new GmailEmailProvider(env.GMAIL_USER, env.GMAIL_APP_PASSWORD),
    };
  }

  if (env.RESEND_API_KEY) {
    return {
      success: true,
      provider: new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM),
    };
  }

  // In development/test, fallback to local preview
  if (isDev) {
    return {
      success: true,
      provider: new PreviewEmailProvider(),
    };
  }

  return {
    success: false,
    reason: "PROVIDER_NOT_CONFIGURED",
    error:
      "No email provider configured. Set EMAIL_PROVIDER=gmail (with GMAIL_USER and GMAIL_APP_PASSWORD) or EMAIL_PROVIDER=resend (with RESEND_API_KEY).",
  };
}

/**
 * Common entry point for sending emails across configured providers.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const resolution = resolveEmailProvider();

  if (!resolution.success) {
    return {
      outcome: "failed",
      provider: "none",
      error: resolution.error,
    };
  }

  return resolution.provider.sendEmail(options);
}
