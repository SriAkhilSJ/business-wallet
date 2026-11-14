/**
 * Uploads the generated sample documents from sample-data/ into a real
 * Supabase project, for an EXISTING user (created by signing up in the app).
 *
 * Requires the SERVICE ROLE key (server-side script only — never ship this
 * key to the browser). Nothing runs automatically; the target user is chosen
 * explicitly, so samples never mix into a real customer's records by
 * accident.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npm run samples:upload -- --email=you@example.com
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sampleDir = join(root, "sample-data");

function arg(name) {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : null;
}

function die(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const email = (arg("email") || "").toLowerCase();

  if (!url || !serviceKey) {
    die(
      "Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  if (!email) {
    die("Pass the target user explicitly: --email=you@example.com");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Find the user (must already exist — sign up in the app first).
  let userId = null;
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) die(`Could not list users: ${error.message}`);
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) userId = found.id;
    if (data.users.length < 200) break;
  }
  if (!userId) die(`No user found for ${email}. Sign up in the app first.`);

  // 2. Find the business created at sign-up.
  const { data: business, error: bizError } = await admin
    .from("businesses")
    .select("id, business_name")
    .eq("owner_id", userId)
    .maybeSingle();
  if (bizError) die(`Could not load business: ${bizError.message}`);
  if (!business) die("This user has no business row. Sign in to the app once.");

  // 3. Load the sample manifest.
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(sampleDir, "manifest.json"), "utf8"));
  } catch {
    die("sample-data/manifest.json missing. Run `npm run samples:generate` first.");
  }

  const { data: existing, error: listError } = await admin
    .from("documents")
    .select("original_filename")
    .eq("business_id", business.id);
  if (listError) die(`Could not list documents: ${listError.message}`);
  const have = new Set(existing.map((d) => d.original_filename));

  let uploaded = 0;
  let skipped = 0;
  for (const entry of manifest) {
    if (have.has(entry.file)) {
      console.log(`– ${entry.file} (already present, skipped)`);
      skipped += 1;
      continue;
    }
    const bytes = await readFile(join(sampleDir, entry.file));
    const [year, month] = entry.documentDate.split("-");
    const storagePath = `${business.id}/${year}/${month}/${randomUUID()}.pdf`;

    const { error: uploadError } = await admin.storage
      .from("business-documents")
      .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) {
      console.error(`✗ ${entry.file}: storage upload failed (${uploadError.message})`);
      continue;
    }

    const { error: insertError } = await admin.from("documents").insert({
      business_id: business.id,
      uploaded_by: userId,
      original_filename: entry.file,
      storage_path: storagePath,
      mime_type: "application/pdf",
      file_size: bytes.length,
      document_date: entry.documentDate,
      category: entry.category,
    });
    if (insertError) {
      await admin.storage.from("business-documents").remove([storagePath]);
      console.error(`✗ ${entry.file}: DB insert failed (${insertError.message})`);
      continue;
    }
    console.log(`✓ ${entry.file}`);
    uploaded += 1;
  }

  console.log(
    `\nDone: ${uploaded} uploaded, ${skipped} skipped → business "${business.business_name}" (${business.id}).`,
  );
}

main().catch((err) => {
  console.error("Sample upload failed:", err);
  process.exit(1);
});
