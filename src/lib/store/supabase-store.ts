/**
 * Supabase-backed document store. Uses the caller's RLS-scoped client for
 * everything (database AND storage) — combined with the explicit ownership
 * checks in each method, this is defense in depth. The service-role key is
 * never used by the application.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { STORAGE_BUCKET, SIGNED_URL_TTL_SECONDS } from "../config";
import { todayUtcDate } from "../dates";
import { AppError } from "../errors";
import { buildStoragePath, extensionOf } from "../filenames";
import type { Category } from "../config";
import type { BusinessInfo, DocumentRecord, SessionUser } from "../types";
import type {
  CreateResult,
  DocumentStore,
  NewDocumentInput,
  StoredBytes,
} from "./types";

interface DocumentRow {
  id: string;
  business_id: string;
  uploaded_by: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  file_size: number | string;
  document_date: string | null;
  category: string;
  created_at: string;
  updated_at: string;
}

function toRecord(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    uploadedBy: row.uploaded_by,
    originalFilename: row.original_filename,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size),
    documentDate: row.document_date
      ? String(row.document_date).slice(0, 10)
      : null,
    category: row.category as Category,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class SupabaseDocumentStore implements DocumentStore {
  constructor(private readonly supabase: SupabaseClient) {}

  async provisionUser(
    user: SessionUser,
    options?: { businessName?: string },
  ): Promise<BusinessInfo> {
    const { error: profileError } = await this.supabase.from("profiles").upsert(
      {
        id: user.id,
        full_name: user.fullName ?? "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (profileError) {
      throw new AppError(
        500,
        "provision_failed",
        "Could not set up your profile. Please try again.",
      );
    }

    const { data: existing, error: selectError } = await this.supabase
      .from("businesses")
      .select("id, business_name")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (selectError) {
      throw new AppError(
        500,
        "provision_failed",
        "Could not load your business profile. Please try again.",
      );
    }

    if (existing) {
      if (options?.businessName?.trim()) {
        const name = options.businessName.trim();
        await this.supabase
          .from("businesses")
          .update({ business_name: name, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        return { id: existing.id, businessName: name };
      }
      return { id: existing.id, businessName: existing.business_name };
    }

    const name = options?.businessName?.trim() || "My Business";
    const { data: created, error: insertError } = await this.supabase
      .from("businesses")
      .insert({ owner_id: user.id, business_name: name })
      .select("id, business_name")
      .single();
    if (insertError || !created) {
      throw new AppError(
        500,
        "provision_failed",
        "Could not create your business profile. Please try again.",
      );
    }
    return { id: created.id, businessName: created.business_name };
  }

  async getBusinessForUser(userId: string): Promise<BusinessInfo | null> {
    const { data, error } = await this.supabase
      .from("businesses")
      .select("id, business_name")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return { id: data.id, businessName: data.business_name };
  }

  async listDocuments(userId: string): Promise<DocumentRecord[]> {
    const business = await this.getBusinessForUser(userId);
    if (!business) return [];
    const { data, error } = await this.supabase
      .from("documents")
      .select("*")
      .eq("business_id", business.id);
    if (error) {
      throw new AppError(
        500,
        "list_failed",
        "Could not load documents. Please try again.",
      );
    }
    return (data ?? []).map((row) => toRecord(row as DocumentRow));
  }

  async createDocuments(
    userId: string,
    inputs: NewDocumentInput[],
  ): Promise<CreateResult> {
    const business = await this.getBusinessForUser(userId);
    if (!business) {
      throw new AppError(
        400,
        "no_business",
        "Your business profile is not set up. Please sign out and in again.",
      );
    }

    const created: DocumentRecord[] = [];
    const errors: { filename: string; error: string }[] = [];

    for (const input of inputs) {
      try {
        const ext = extensionOf(input.originalFilename) || "bin";
        const effectiveDate = input.documentDate ?? todayUtcDate();
        const id = crypto.randomUUID();
        const storagePath = buildStoragePath(business.id, effectiveDate, ext, id);

        const { error: uploadError } = await this.supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, input.bytes, {
            contentType: input.mimeType,
            upsert: false,
          });
        if (uploadError) {
          errors.push({
            filename: input.originalFilename,
            error: "Could not store the file. Please try again.",
          });
          continue;
        }

        const { data: row, error: insertError } = await this.supabase
          .from("documents")
          .insert({
            business_id: business.id,
            uploaded_by: userId,
            original_filename: input.originalFilename,
            storage_path: storagePath,
            mime_type: input.mimeType,
            file_size: input.fileSize,
            document_date: input.documentDate,
            category: input.category,
          })
          .select("*")
          .single();
        if (insertError || !row) {
          // Roll back the orphan object so storage and DB stay consistent.
          await this.supabase.storage
            .from(STORAGE_BUCKET)
            .remove([storagePath]);
          errors.push({
            filename: input.originalFilename,
            error: "Could not save the document record. Please try again.",
          });
          continue;
        }
        created.push(toRecord(row as DocumentRow));
      } catch {
        errors.push({
          filename: input.originalFilename,
          error: "Could not store the file. Please try again.",
        });
      }
    }

    return { created, errors };
  }

  async getDocument(userId: string, docId: string): Promise<DocumentRecord | null> {
    const { data, error } = await this.supabase
      .from("documents")
      .select("*")
      .eq("id", docId)
      .maybeSingle();
    if (error || !data) return null;
    const record = toRecord(data as DocumentRow);

    // Explicit ownership check on top of RLS.
    const business = await this.getBusinessForUser(userId);
    if (!business || record.businessId !== business.id) return null;
    return record;
  }

  async deleteDocument(userId: string, docId: string): Promise<boolean> {
    const doc = await this.getDocument(userId, docId);
    if (!doc) return false;

    // Remove the DB row first: if storage cleanup fails afterwards, the only
    // side effect is an unreferenced orphan object — never a listed document
    // pointing at a missing file.
    const { error } = await this.supabase
      .from("documents")
      .delete()
      .eq("id", docId);
    if (error) {
      throw new AppError(
        500,
        "delete_failed",
        "Could not delete the document. Please try again.",
      );
    }

    await this.supabase.storage.from(STORAGE_BUCKET).remove([doc.storagePath]);
    return true;
  }

  async readDocument(userId: string, docId: string): Promise<StoredBytes | null> {
    const doc = await this.getDocument(userId, docId);
    if (!doc) return null;
    const { data, error } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .download(doc.storagePath);
    if (error || !data) return { record: doc, bytes: null };
    const buffer = new Uint8Array(await data.arrayBuffer());
    return { record: doc, bytes: buffer };
  }

  async getPreviewUrl(
    userId: string,
    record: DocumentRecord,
  ): Promise<string | null> {
    const doc = await this.getDocument(userId, record.id);
    if (!doc) return null;
    const { data, error } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(doc.storagePath, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }
}
