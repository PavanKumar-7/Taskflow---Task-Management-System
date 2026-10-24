import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { requireAuth, AuthError } from "@/lib/permissions/workspace";
import {
  getNotificationsForUser,
  getUnreadNotificationCount,
} from "@/lib/notifications/service";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30", 10)));
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const [notifications, unreadCount] = await Promise.all([
      getNotificationsForUser(user.id, { limit, unreadOnly }),
      getUnreadNotificationCount(user.id),
    ]);

    return jsonSuccess({
      notifications,
      unreadCount,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to load notifications.")
    );
  }
}
