import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata = {
  title: "Create account",
  description: "Create a TaskFlow account",
};

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="h-96 w-full max-w-md animate-pulse rounded-2xl border border-border bg-card/50" />
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
