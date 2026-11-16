import { redirect } from "next/navigation";

import { ReviewClient } from "@/components/review/ReviewClient";
import { getServerUser } from "@/lib/auth/session";
import { getMode } from "@/lib/env";

export default async function ReviewPage() {
  const user = await getServerUser();
  if (!user) redirect("/sign-in");

  return <ReviewClient mode={getMode()} />;
}
