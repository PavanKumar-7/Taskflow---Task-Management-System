import nodemailer from "nodemailer";
import type { EmailProvider, SendEmailOptions, SendEmailResult } from "@/lib/email/types";

/**
 * Sanitizes error messages by stripping out sensitive credential patterns,
 * app passwords, tokens, or raw paths.
 */
function sanitizeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unknown Gmail SMTP transmission error.";
  }

  let message = error.message;

  // Mask any accidental email passwords or auth tokens
  message = message.replace(/(?:password|pass|auth|key|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=***");
  message = message.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer ***");

  // Friendly common Gmail SMTP error mapping
  if (/535|534|invalid credentials|username and password not accepted/i.test(message)) {
    return "Gmail SMTP authentication failed: Invalid GMAIL_USER or GMAIL_APP_PASSWORD. Ensure Google 2-Step Verification is active and a 16-character App Password is used.";
  }

  if (/ETIMEDOUT|ESOCKETTIMEDOUT|greeting timeout/i.test(message)) {
    return "Gmail SMTP connection timed out while reaching smtp.gmail.com:465.";
  }

  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET/i.test(message)) {
    return `Gmail SMTP network error: ${error.message}`;
  }

  return message;
}

export class GmailEmailProvider implements EmailProvider {
  readonly name = "gmail" as const;
  private readonly user: string;
  private readonly pass: string;

  constructor(user: string, pass: string) {
    if (!user || !pass) {
      throw new Error("Gmail provider requires valid GMAIL_USER and GMAIL_APP_PASSWORD.");
    }
    this.user = user.trim();
    // App passwords often have spaces copied from Google UI, e.g. "abcd efgh ijkl mnop"
    this.pass = pass.replace(/\s+/g, "");
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true, // SSL/TLS
        auth: {
          user: this.user,
          pass: this.pass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      // Use the authenticated Gmail address as sender
      const fromHeader = `TaskFlow <${this.user}>`;

      const info = await transporter.sendMail({
        from: fromHeader,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      return {
        outcome: "accepted",
        provider: "gmail",
        messageId: info.messageId || `gmail_${Date.now()}`,
      };
    } catch (error) {
      const sanitized = sanitizeErrorMessage(error);
      return {
        outcome: "failed",
        provider: "gmail",
        error: sanitized,
      };
    }
  }
}
