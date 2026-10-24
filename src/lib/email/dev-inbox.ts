/**
 * In-memory captured emails store for local development and automated testing.
 * Strictly used in development and test environments; never in production.
 */

export type CapturedEmail = {
  id: string;
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  inviteUrl: string;
  timestamp: string;
};

const MAX_CAPTURED = 50;
const capturedEmails: CapturedEmail[] = [];

/**
 * Records a composed email in memory for developer inspection and testing.
 */
export function recordCapturedEmail(
  email: Omit<CapturedEmail, "id" | "timestamp">
): CapturedEmail {
  const record: CapturedEmail = {
    ...email,
    id: `dev_mail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };

  capturedEmails.unshift(record);
  if (capturedEmails.length > MAX_CAPTURED) {
    capturedEmails.pop();
  }

  return record;
}

/**
 * Retrieves all captured emails in memory (newest first).
 */
export function getCapturedEmails(): CapturedEmail[] {
  return [...capturedEmails];
}

/**
 * Retrieves the most recently captured email.
 */
export function getLatestCapturedEmail(): CapturedEmail | undefined {
  return capturedEmails[0];
}

/**
 * Clears the in-memory captured email buffer.
 */
export function clearCapturedEmails(): void {
  capturedEmails.length = 0;
}
