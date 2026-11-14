import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/AuthForm";
import { getServerUser } from "@/lib/auth/session";
import { getMode } from "@/lib/env";

export default async function SignInPage() {
  const user = await getServerUser();
  if (user) redirect("/dashboard");
  return <AuthForm variant="sign-in" mode={getMode()} />;
}
