import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/AuthForm";
import { getServerUser } from "@/lib/auth/session";
import { getMode } from "@/lib/env";

export default async function SignUpPage() {
  const user = await getServerUser();
  if (user) redirect("/dashboard");
  return <AuthForm variant="sign-up" mode={getMode()} />;
}
