import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_ERROR";

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

const statusByCode: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
};

export function jsonSuccess<T>(data: T, status = 200, init?: { headers?: HeadersInit }) {
  return NextResponse.json({ success: true, data } satisfies ApiSuccess<T>, {
    status,
    headers: init?.headers,
  });
}

export function jsonError(
  code: ApiErrorCode,
  message: string,
  init?: { headers?: HeadersInit }
) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    } satisfies ApiFailure,
    {
      status: statusByCode[code],
      headers: init?.headers,
    },
  );
}

/**
 * Safely formats internal error messages.
 * In production, masks raw database or infrastructure details to prevent information disclosure.
 */
export function formatInternalErrorMessage(
  error: unknown,
  fallbackMessage = "An internal server error occurred."
): string {
  if (error) {
    console.error("[TaskFlow Server Error]:", error);
  }
  if (process.env.NODE_ENV === "production") {
    return fallbackMessage;
  }
  return error instanceof Error ? error.message : fallbackMessage;
}
