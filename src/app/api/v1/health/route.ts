import { jsonSuccess } from "@/lib/api/http";
import { getDatabaseStatus } from "@/lib/db";
import { getEnv } from "@/lib/validation/env";

export async function GET(_request: Request) {
  void _request;
  const env = getEnv();
  const database = await getDatabaseStatus();

  return jsonSuccess({
    status: "ok",
    service: "taskflow",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    database,
  });
}
