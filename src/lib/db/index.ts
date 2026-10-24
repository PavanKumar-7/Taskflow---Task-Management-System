import { PrismaClient } from "@prisma/client";
import { isDatabaseConfigured } from "@/lib/validation/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type DatabaseStatus = {
  configured: boolean;
  connected: boolean;
  provider: string | null;
  message: string;
};

export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  const configured = isDatabaseConfigured();
  if (!configured) {
    return {
      configured: false,
      connected: false,
      provider: null,
      message:
        "DATABASE_URL is not set. Provision PostgreSQL through the Vercel Marketplace (Prisma Postgres recommended) and add the connection string.",
    };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      configured: true,
      connected: true,
      provider: "postgresql",
      message: "Connected to PostgreSQL database.",
    };
  } catch (error) {
    const isProd = process.env.NODE_ENV === "production";
    return {
      configured: true,
      connected: false,
      provider: "postgresql",
      message: isProd
        ? "Database connection failed."
        : `Database connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
