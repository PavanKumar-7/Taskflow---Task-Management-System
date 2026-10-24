export type EmailProviderType = "gmail" | "resend" | "preview";

export type EmailOutcome = "accepted" | "preview" | "failed";

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  inviteUrl?: string;
};

export type SendInvitationEmailParams = {
  to: string;
  inviterName: string;
  workspaceName: string;
  role: string;
  rawToken: string;
};

export type SendEmailResult = {
  outcome: EmailOutcome;
  provider: EmailProviderType | "none";
  messageId?: string;
  error?: string;
};

export interface EmailProvider {
  readonly name: EmailProviderType;
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
}

export type DevEmailPreview = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  inviteUrl: string;
  timestamp?: string;
};

export type EmailDeliveryResult = {
  sent: boolean; // True only when accepted by SMTP/API
  outcome: EmailOutcome;
  provider: EmailProviderType | "none";
  providerId?: string;
  reason?: "PROVIDER_NOT_CONFIGURED" | "PROVIDER_ERROR" | "TIMEOUT" | "DEV_PREVIEW_MODE";
  error?: string;
  devInviteUrl?: string; // Strictly development/test only
  devEmailPreview?: DevEmailPreview; // Strictly development/test only
};
