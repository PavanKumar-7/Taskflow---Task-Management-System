import { jsonSuccess } from "@/lib/api/http";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  await clearSessionCookie();
  return jsonSuccess({ message: "Successfully signed out." });
}
