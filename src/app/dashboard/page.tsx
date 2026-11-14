import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getServerUser } from "@/lib/auth/session";
import { todayUtcDate } from "@/lib/dates";
import { getMode } from "@/lib/env";
import { getStore } from "@/lib/store";

export default async function DashboardPage() {
  const user = await getServerUser();
  if (!user) redirect("/sign-in");

  const store = await getStore();
  const business = await store.getBusinessForUser(user.id);
  const today = todayUtcDate();
  const initialYear = Number(today.slice(0, 4));
  const initialMonth = Number(today.slice(5, 7));

  return (
    <DashboardClient
      user={{ email: user.email, fullName: user.fullName }}
      businessName={business?.businessName ?? "My Business"}
      mode={getMode()}
      initialMonth={initialMonth}
      initialYear={initialYear}
    />
  );
}
