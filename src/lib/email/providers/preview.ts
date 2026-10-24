import { recordCapturedEmail } from "@/lib/email/dev-inbox";
import type { EmailProvider, SendEmailOptions, SendEmailResult } from "@/lib/email/types";

/**
 * Preview email provider.
 * Captures email in memory for local developer inspection and testing.
 * Makes ZERO external network requests. Never reports preview as delivered.
 */
export class PreviewEmailProvider implements EmailProvider {
  readonly name = "preview" as const;

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    recordCapturedEmail({
      to: options.to,
      from: options.from || "TaskFlow Preview <preview@taskflow.local>",
      subject: options.subject,
      html: options.html,
      text: options.text,
      inviteUrl: options.inviteUrl || options.to,
    });

    return {
      outcome: "preview",
      provider: "preview",
      messageId: `preview_${Date.now()}`,
    };
  }
}
