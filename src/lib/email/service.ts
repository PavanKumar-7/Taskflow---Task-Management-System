import { getEnv } from "@/lib/validation/env";
import { recordCapturedEmail } from "@/lib/email/dev-inbox";
import { resolveEmailProvider } from "@/lib/email/provider";
import type {
  SendInvitationEmailParams,
  EmailDeliveryResult,
  DevEmailPreview,
} from "@/lib/email/types";

export * from "@/lib/email/types";
export * from "@/lib/email/provider";

/**
 * Escapes special HTML characters to prevent HTML/script injection in email clients.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sends a workspace invitation email using the configured provider (Gmail SMTP, Resend API, or Local Preview).
 * Never crashes the caller. Returns truthful outcome status and sanitized errors.
 */
export async function sendWorkspaceInvitationEmail({
  to,
  inviterName,
  workspaceName,
  role,
  rawToken,
}: SendInvitationEmailParams): Promise<EmailDeliveryResult> {
  const env = getEnv();
  const isDev = env.NODE_ENV === "development" || env.NODE_ENV === "test";

  // In production, strictly refuse to generate and dispatch links with localhost fallback
  if (!isDev && (!env.APP_URL || !env.APP_URL.startsWith("https://"))) {
    return {
      sent: false,
      outcome: "failed",
      provider: "none",
      reason: "PROVIDER_ERROR",
      error:
        "APP_URL must be configured with a valid HTTPS URL (e.g. https://taskflow.yourdomain.com) to send invitations in production.",
    };
  }

  const baseUrl = env.APP_URL || "http://localhost:3000";
  const inviteUrl = `${baseUrl.replace(/\/$/, "")}/invite/${rawToken}`;

  const roleLabel = role === "ADMIN" ? "Admin" : "Team Member";
  const safeInviterName = escapeHtml(inviterName);
  const safeWorkspaceName = escapeHtml(workspaceName);
  const safeRoleLabel = escapeHtml(roleLabel);
  const safeInviteUrl = escapeHtml(inviteUrl);

  const subject = `You've been invited to join ${workspaceName} on TaskFlow`;
  const text = `Hi,\n\n${inviterName} has invited you to join the "${workspaceName}" workspace on TaskFlow as a ${roleLabel}.\n\nClick the link below to accept your invitation:\n${inviteUrl}\n\nThis invitation will expire in 7 days.\n\nBest,\nThe TaskFlow Team`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h2 style="color: #111827; margin-top: 0;">You're invited to TaskFlow</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 24px;">
        <strong>${safeInviterName}</strong> has invited you to join the <strong>${safeWorkspaceName}</strong> workspace on TaskFlow as a <strong>${safeRoleLabel}</strong>.
      </p>
      <div style="margin: 28px 0;">
        <a href="${safeInviteUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px; display: inline-block;">
          Accept Invitation
        </a>
      </div>
      <p style="color: #6b7280; font-size: 13px; line-height: 20px;">
        Or copy and paste this link in your browser:<br/>
        <a href="${safeInviteUrl}" style="color: #2563eb; word-break: break-all;">${safeInviteUrl}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">This invitation will expire in 7 days. If you didn't expect this email, you can ignore it.</p>
    </div>
  `;

  // Standard from address representation for preview and Resend
  const fromDisplay = env.GMAIL_USER
    ? `TaskFlow <${env.GMAIL_USER}>`
    : (env.EMAIL_FROM || "TaskFlow <onboarding@resend.dev>");

  const preview: DevEmailPreview = {
    to,
    from: fromDisplay,
    subject,
    html,
    text,
    inviteUrl,
    timestamp: new Date().toISOString(),
  };

  // 1. Resolve Provider
  const resolution = resolveEmailProvider(env);

  if (!resolution.success) {
    if (isDev) {
      recordCapturedEmail({
        to,
        from: fromDisplay,
        subject,
        html,
        text,
        inviteUrl,
      });
    }
    return {
      sent: false,
      outcome: "failed",
      provider: "none",
      reason: resolution.reason,
      error: resolution.error,
      devInviteUrl: isDev ? inviteUrl : undefined,
      devEmailPreview: isDev ? preview : undefined,
    };
  }

  // 2. Dispatch through chosen provider
  const result = await resolution.provider.sendEmail({
    to,
    subject,
    html,
    text,
    from: fromDisplay,
    inviteUrl,
  });

  // For external providers in dev, record a local copy for UI inspection
  if (isDev && resolution.provider.name !== "preview") {
    recordCapturedEmail({
      to,
      from: fromDisplay,
      subject,
      html,
      text,
      inviteUrl,
    });
  }

  if (result.outcome === "accepted") {
    return {
      sent: true,
      outcome: "accepted",
      provider: result.provider,
      providerId: result.messageId,
      devInviteUrl: isDev ? inviteUrl : undefined,
      devEmailPreview: isDev ? preview : undefined,
    };
  }

  if (result.outcome === "preview") {
    return {
      sent: false,
      outcome: "preview",
      provider: "preview",
      reason: "DEV_PREVIEW_MODE",
      error: "Email captured in local preview mode; no real email was sent.",
      devInviteUrl: isDev ? inviteUrl : undefined,
      devEmailPreview: isDev ? preview : undefined,
    };
  }

  // Outcome is "failed"
  const isTimeout = Boolean(result.error && /timed? ?out/i.test(result.error));
  return {
    sent: false,
    outcome: "failed",
    provider: result.provider,
    reason: isTimeout ? "TIMEOUT" : "PROVIDER_ERROR",
    error: result.error || "Email provider rejected message dispatch.",
    devInviteUrl: isDev ? inviteUrl : undefined,
    devEmailPreview: isDev ? preview : undefined,
  };
}
