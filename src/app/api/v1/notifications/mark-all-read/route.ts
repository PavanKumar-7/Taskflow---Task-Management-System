import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { requireAuth, AuthError } from "@/lib/permissions/workspace";
import { markAllNotificationsAsRead } from "@/lib/notifications/service";

export async function POST() {
  try {
    const user = await requireAuth();
    const count = await markAllNotificationsAsRead(user.id);
    return jsonSuccess({ message: "All notifications marked as read.", count });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to mark notifications as read.")
    );
  }
}
