import { getMode } from "../env";
import { createSupabaseServerClient } from "../auth/supabase-server";
import { LocalDevDocumentStore } from "./local-store";
import { SupabaseDocumentStore } from "./supabase-store";
import type { DocumentStore } from "./types";

/**
 * Resolve the active store for the current request.
 * Supabase mode uses the caller's cookie-scoped (RLS) client.
 */
export async function getStore(): Promise<DocumentStore> {
  if (getMode() === "supabase") {
    const supabase = await createSupabaseServerClient();
    return new SupabaseDocumentStore(supabase);
  }
  return new LocalDevDocumentStore();
}

export type { DocumentStore } from "./types";
