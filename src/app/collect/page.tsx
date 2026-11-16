import { redirect } from "next/navigation";

import { CollectClient } from "@/components/collect/CollectClient";
import { getServerUser } from "@/lib/auth/session";
import { todayUtcDate } from "@/lib/dates";
import { getMode } from "@/lib/env";

export default async function CollectPage() {
  const user = await getServerUser();
  if (!user) redirect("/sign-in");

  const today = todayUtcDate();
  return (
    <CollectClient
      initialFrom={`${today.slice(0, 7)}-01`}
      initialTo={today}
      mode={getMode()}
    />
  );
}
