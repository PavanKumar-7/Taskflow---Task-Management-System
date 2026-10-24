import { z } from "zod";

function emptyToUndefined(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  let trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed.length === 0 ? undefined : trimmed;
}

const postgresConnectionString = z
  .string()
  .refine(
    (value) => /^(postgres(ql)?|prisma\+postgres):\/\//i.test(value),
    "DATABASE_URL must be a PostgreSQL connection string (postgres://, postgresql://, or prisma+postgres://).",
  );

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_URL: z.preprocess(emptyToUndefined, z.url().optional()),
    DATABASE_URL: z.preprocess(
      emptyToUndefined,
      postgresConnectionString.optional(),
    ),
    AUTH_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
    RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    EMAIL_FROM: z.preprocess(emptyToUndefined, z.string().optional()),
    EMAIL_DEV_MODE: z.preprocess(emptyToUndefined, z.string().optional()),
    EMAIL_PROVIDER: z.preprocess(
      emptyToUndefined,
      z.enum(["gmail", "resend", "preview"]).optional()
    ),
    GMAIL_USER: z.preprocess(emptyToUndefined, z.string().optional()),
    GMAIL_APP_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
    RUN_REAL_EMAIL_TEST: z.preprocess(emptyToUndefined, z.string().optional()),
    REAL_EMAIL_TEST_RECIPIENT: z.preprocess(emptyToUndefined, z.string().optional()),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (!data.AUTH_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_SECRET"],
          message:
            "AUTH_SECRET is mandatory in production and cannot use a fallback secret.",
        });
      } else if (data.AUTH_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_SECRET"],
          message:
            "AUTH_SECRET must be at least 32 characters long in production.",
        });
      }

      if (!data.DATABASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["DATABASE_URL"],
          message: "DATABASE_URL is mandatory in production.",
        });
      }

      if (
        data.APP_URL &&
        !data.APP_URL.startsWith("https://") &&
        !data.APP_URL.includes("localhost") &&
        !data.APP_URL.includes("127.0.0.1")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["APP_URL"],
          message:
            "APP_URL must use HTTPS in production (e.g. https://taskflow.yourdomain.com).",
        });
      }

      if (data.EMAIL_PROVIDER === "preview") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["EMAIL_PROVIDER"],
          message:
            "EMAIL_PROVIDER cannot be set to 'preview' in production. Use 'gmail' or 'resend'.",
        });
      }
    }
  })
  .transform((data) => ({
    ...data,
    AUTH_SECRET:
      data.AUTH_SECRET ||
      (data.NODE_ENV === "production"
        ? ""
        : "taskflow-default-development-secret-key-32chars!"),
  }));

export type AppEnv = z.infer<typeof envSchema>;

function formatZodError(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "env";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    APP_URL: process.env.APP_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_DEV_MODE: process.env.EMAIL_DEV_MODE,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    RUN_REAL_EMAIL_TEST: process.env.RUN_REAL_EMAIL_TEST,
    REAL_EMAIL_TEST_RECIPIENT: process.env.REAL_EMAIL_TEST_RECIPIENT,
  });

  if (!parsed.success) {
    throw new Error(`Invalid environment variables. ${formatZodError(parsed.error)}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}

export function isDatabaseConfigured(env: AppEnv = getEnv()) {
  return Boolean(env.DATABASE_URL);
}
