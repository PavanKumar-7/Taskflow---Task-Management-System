import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { requireAuth, AuthError } from "@/lib/permissions/workspace";
import { getUnreadNotificationCount } from "@/lib/notifications/service";

export async function GET() {
  try {
    const user = await requireAuth();
    const count = await getUnreadNotificationCount(user.id);
    return jsonSuccess({ unreadCount: count });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to get unread count.")
    );
  }
}
