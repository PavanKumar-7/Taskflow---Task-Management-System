import type { EmailProvider, SendEmailOptions, SendEmailResult } from "@/lib/email/types";

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;
  private readonly apiKey: string;
  private readonly defaultFrom: string;

  constructor(apiKey: string, defaultFrom?: string) {
    if (!apiKey) {
      throw new Error("Resend provider requires valid RESEND_API_KEY.");
    }
    this.apiKey = apiKey.trim();
    this.defaultFrom = defaultFrom?.trim() || "TaskFlow <onboarding@resend.dev>";
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const from = options.from || this.defaultFrom;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [options.to],
          subject: options.subject,
          text: options.text,
          html: options.html,
        }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.id) {
        const errorMessage =
          (typeof data?.message === "string" && data.message) ||
          (typeof data?.error?.message === "string" && data.error.message) ||
          `Resend API error with status ${res.status}.`;

        return {
          outcome: "failed",
          provider: "resend",
          error: errorMessage,
        };
      }

      return {
        outcome: "accepted",
        provider: "resend",
        messageId: data.id,
      };
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      return {
        outcome: "failed",
        provider: "resend",
        error: isTimeout
          ? "Resend API connection timed out."
          : (err instanceof Error ? err.message : "Unknown Resend network error."),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
