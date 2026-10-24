import { jsonSuccess, jsonError, formatInternalErrorMessage } from "@/lib/api/http";
import { requireAuth, AuthError } from "@/lib/permissions/workspace";
import { markNotificationAsRead } from "@/lib/notifications/service";

type Context = {
  params: Promise<{ notificationId: string }>;
};

export async function PATCH(_request: Request, context: Context) {
  try {
    const user = await requireAuth();
    const { notificationId } = await context.params;

    const updated = await markNotificationAsRead(notificationId, user.id);

    if (!updated) {
      return jsonError("NOT_FOUND", "Notification not found or access denied.");
    }

    return jsonSuccess({ message: "Notification marked as read.", notification: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.code, error.message);
    }
    return jsonError(
      "INTERNAL_ERROR",
      formatInternalErrorMessage(error, "Failed to update notification.")
    );
  }
}
