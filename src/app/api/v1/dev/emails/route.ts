import { jsonSuccess, jsonError } from "@/lib/api/http";
import { getCapturedEmails, clearCapturedEmails } from "@/lib/email/dev-inbox";

/**
 * Development & testing endpoint for inspecting captured outbound emails.
 * Strictly disabled in production.
 */
export async function GET(_request: Request) {
  void _request;
  if (process.env.NODE_ENV === "production") {
    return jsonError("NOT_FOUND", "Endpoint not available in production.");
  }

  const emails = getCapturedEmails();
  return jsonSuccess(emails);
}

export async function DELETE(_request: Request) {
  void _request;
  if (process.env.NODE_ENV === "production") {
    return jsonError("NOT_FOUND", "Endpoint not available in production.");
  }

  clearCapturedEmails();
  return jsonSuccess({ cleared: true });
}
