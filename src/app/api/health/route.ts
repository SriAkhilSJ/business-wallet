import { getMode } from "@/lib/env";

export async function GET() {
  return Response.json({
    status: "ok",
    app: "BusinessVault",
    mode: getMode(),
    time: new Date().toISOString(),
  });
}
