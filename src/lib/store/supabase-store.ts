/**
 * Supabase-backed document store. Uses the caller's RLS-scoped client for
 * everything (database AND storage) — combined with the explicit ownership
 * checks in each method, this is defense in depth. The service-role key is
 * never used by the application.
 */
import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { STORAGE_BUCKET, SIGNED_URL_TTL_SECONDS, MAX_FILE_SIZE_BYTES, AUTO_ACCEPT_CONFIDENCE } from "../config";
import { classifyDocument, classificationConfig, type Classification } from "../classify/vision";
import { todayUtcDate } from "../dates";
import { AppError } from "../errors";
import { buildStoragePath, extensionOf } from "../filenames";
import { DETECTED_MIME, detectFileType, looksLikeText } from "../file-validation";
import type { Category } from "../config";
import type { BusinessInfo, DocumentRecord, SessionUser } from "../types";
import type {
  CreateResult,
  DocumentPatch,
  DocumentStore,
  NewDocumentInput,
  StoredBytes,
  StoredClassification,
  UploadedDocumentInput,
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
  amount?: number | string | null;
  vendor?: string | null;
  gstin?: string | null;
  confidence?: number | string | null;
  classified_by?: string | null;
  content_hash?: string | null;
  source_type?: string | null;
  source_account?: string | null;
  source_file_id?: string | null;
  imported_at?: string | null;
  processing_status?: string | null;
  verification_status?: string | null;
  duplicate_group_id?: string | null;
  deleted_at?: string | null;
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
    amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
    vendor: row.vendor ?? null,
    gstin: row.gstin ?? null,
    confidence:
      row.confidence === null || row.confidence === undefined
        ? null
        : Number(row.confidence),
    classifiedBy: row.classified_by ?? null,
    contentHash: row.content_hash ?? null,
    sourceType: row.source_type ?? null,
    sourceAccount: row.source_account ?? null,
    sourceFileId: row.source_file_id ?? null,
    importedAt: row.imported_at ? new Date(row.imported_at).toISOString() : null,
    processingStatus: row.processing_status ?? null,
    verificationStatus: row.verification_status ?? null,
    duplicateGroupId: row.duplicate_group_id ?? null,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
  };
}

export class SupabaseDocumentStore implements DocumentStore {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Runs the vision model and keeps the answer only when it is confident
   * enough to override what the uploader chose. Failures return null, so the
   * upload still succeeds with the human's choice.
   */
  private async acceptedClassification(
    bytes: Uint8Array,
    mimeType: string,
  ): Promise<Classification | null> {
    const result = await classifyDocument({ bytes, mimeType });
    return result && result.confidence >= AUTO_ACCEPT_CONFIDENCE ? result : null;
  }

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
      .eq("business_id", business.id)
      .is("deleted_at", null);
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

        const contentHash = createHash("sha256").update(input.bytes).digest("hex");
        const { data: existing } = await this.supabase
          .from("documents")
          .select("original_filename")
          .eq("business_id", business.id)
          .eq("content_hash", contentHash)
          .maybeSingle();
        const duplicateOf = existing?.original_filename ?? null;

        const accepted = await this.acceptedClassification(input.bytes, input.mimeType);

        const { data: row, error: insertError } = await this.supabase
          .from("documents")
          .insert({
            business_id: business.id,
            uploaded_by: userId,
            original_filename: input.originalFilename,
            storage_path: storagePath,
            mime_type: input.mimeType,
            file_size: input.fileSize,
            document_date: accepted?.date ?? input.documentDate,
            category: accepted?.docType ?? input.category,
            amount: accepted?.amount ?? null,
            vendor: accepted?.vendor ?? null,
            gstin: accepted?.gstin ?? null,
            confidence: accepted?.confidence ?? null,
            classified_by: accepted ? classificationConfig()?.model ?? "model" : null,
            content_hash: contentHash,
            source_type: input.sourceType ?? "upload",
            source_account: input.sourceAccount ?? null,
            source_file_id: input.sourceFileId ?? null,
            imported_at: new Date().toISOString(),
            processing_status: "pending",
            verification_status: "unverified",
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
        created.push({ ...toRecord(row as DocumentRow), duplicateOf });
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
    if (record.deletedAt) return null;

    // Explicit ownership check on top of RLS.
    const business = await this.getBusinessForUser(userId);
    if (!business || record.businessId !== business.id) return null;
    return record;
  }

  async deleteDocument(userId: string, docId: string): Promise<boolean> {
    const doc = await this.getDocument(userId, docId);
    if (!doc) return false;

    // Soft delete: keep the original bytes and mark the row deleted.
    const { error } = await this.supabase
      .from("documents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", docId);
    if (error) {
      throw new AppError(
        500,
        "delete_failed",
        "Could not delete the document. Please try again.",
      );
    }
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

  /**
   * The browser uploads straight to Storage, so the file never passes through
   * a serverless function (which rejects bodies over 4.5 MB).
   */
  async createSignedUpload(
    userId: string,
    input: { filename: string; documentDate: string | null },
  ): Promise<{ storagePath: string; token: string; signedUrl: string } | null> {
    const business = await this.getBusinessForUser(userId);
    if (!business) {
      throw new AppError(
        400,
        "no_business",
        "Your business profile is not set up. Please sign out and in again.",
      );
    }

    const ext = extensionOf(input.filename) || "bin";
    const effectiveDate = input.documentDate ?? todayUtcDate();
    const storagePath = buildStoragePath(
      business.id,
      effectiveDate,
      ext,
      crypto.randomUUID(),
    );

    const { data, error } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data?.signedUrl) {
      throw new AppError(
        500,
        "upload_target_failed",
        "Could not prepare the upload. Please try again.",
      );
    }

    return {
      storagePath,
      token: data.token,
      signedUrl: data.signedUrl,
    };
  }

  /** Record a file the browser has already uploaded, after checking it exists. */
  async registerUploadedDocument(
    userId: string,
    input: UploadedDocumentInput,
  ): Promise<DocumentRecord> {
    const business = await this.getBusinessForUser(userId);
    if (!business) {
      throw new AppError(400, "no_business", "Your business profile is not set up.");
    }

    // The caller may only register files under its own business prefix.
    if (!input.storagePath.startsWith(`${business.id}/`)) {
      throw new AppError(403, "forbidden", "That upload does not belong to you.");
    }

    const parts = input.storagePath.split("/");
    const name = parts.pop() ?? "";
    const folder = parts.join("/");

    const { data: listing, error: listError } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .list(folder, { search: name, limit: 1 });

    const object = (listing ?? []).find((entry) => entry.name === name);
    if (listError || !object) {
      throw new AppError(
        400,
        "object_missing",
        "The file did not reach storage. Please try again.",
      );
    }

    const storedSize = Number(object.metadata?.size ?? 0);
    if (storedSize > MAX_FILE_SIZE_BYTES) {
      await this.supabase.storage.from(STORAGE_BUCKET).remove([input.storagePath]);
      throw new AppError(400, "too_large", "That file is larger than the 10 MB limit.");
    }

    // Read the document now, while we are already touching it, so the owner
    // does not have to say what it is. The same bytes let us enforce what the
    // multipart path already enforced: the content must match the claimed type.
    let accepted: Classification | null = null;
    let contentHash: string | null = null;
    let duplicateOf: string | null = null;
    const downloaded = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .download(input.storagePath);
    if (downloaded.data) {
      const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
      const detected =
        input.mimeType === "text/plain"
          ? looksLikeText(bytes)
            ? "text"
            : null
          : detectFileType(bytes);
      if (!detected || DETECTED_MIME[detected] !== input.mimeType) {
        await this.supabase.storage.from(STORAGE_BUCKET).remove([input.storagePath]);
        throw new AppError(
          400,
          "type_mismatch",
          "That file's contents do not match its file type.",
        );
      }

      contentHash = createHash("sha256").update(bytes).digest("hex");
      const { data: existing } = await this.supabase
        .from("documents")
        .select("original_filename")
        .eq("business_id", business.id)
        .eq("content_hash", contentHash)
        .maybeSingle();
      duplicateOf = existing?.original_filename ?? null;

      accepted = await this.acceptedClassification(bytes, input.mimeType);
    }

    const { data: row, error: insertError } = await this.supabase
      .from("documents")
      .insert({
        business_id: business.id,
        uploaded_by: userId,
        original_filename: input.originalFilename,
        storage_path: input.storagePath,
        mime_type: input.mimeType,
        file_size: storedSize || input.fileSize,
        document_date: accepted?.date ?? input.documentDate,
        category: accepted?.docType ?? input.category,
        amount: accepted?.amount ?? null,
        vendor: accepted?.vendor ?? null,
        gstin: accepted?.gstin ?? null,
        confidence: accepted?.confidence ?? null,
        classified_by: accepted ? classificationConfig()?.model ?? "model" : null,
        content_hash: contentHash,
        source_type: input.sourceType ?? "upload",
        source_account: input.sourceAccount ?? null,
        source_file_id: input.sourceFileId ?? null,
        imported_at: new Date().toISOString(),
        processing_status: "pending",
        verification_status: "unverified",
      })
      .select("*")
      .single();

    if (insertError || !row) {
      await this.supabase.storage.from(STORAGE_BUCKET).remove([input.storagePath]);
      if (insertError?.code === "23505") {
        throw new AppError(
          409,
          "duplicate",
          "This file is already in your documents.",
        );
      }
      throw new AppError(
        500,
        "record_failed",
        "The file uploaded but could not be saved. Please try again.",
      );
    }

    return { ...toRecord(row as DocumentRow), duplicateOf };
  }

  async listForReview(userId: string): Promise<DocumentRecord[]> {
    const business = await this.getBusinessForUser(userId);
    if (!business) return [];

    const { data, error } = await this.supabase
      .from("documents")
      .select("*")
      .eq("business_id", business.id)
      .or(`confidence.lt.${AUTO_ACCEPT_CONFIDENCE},category.eq.Other`)
      // A human decision ends the conversation, even if they chose "Other".
      .or("classified_by.is.null,classified_by.neq.human")
      .order("created_at", { ascending: false });

    if (error) {
      throw new AppError(500, "review_failed", "Could not load the review queue.");
    }
    return (data ?? []).map((row) => toRecord(row as DocumentRow));
  }

  async updateDocument(
    userId: string,
    docId: string,
    patch: DocumentPatch,
  ): Promise<DocumentRecord | null> {
    const doc = await this.getDocument(userId, docId);
    if (!doc) return null;

    const { data, error } = await this.supabase
      .from("documents")
      .update({
        category: patch.category,
        document_date: patch.documentDate,
        amount: patch.amount,
        // A human decision outranks the model.
        confidence: 1,
        classified_by: "human",
        updated_at: new Date().toISOString(),
      })
      .eq("id", docId)
      .select("*")
      .single();

    if (error || !data) {
      throw new AppError(500, "update_failed", "Could not save the correction.");
    }
    return toRecord(data as DocumentRow);
  }

  async listUnreadDocuments(userId: string, limit: number): Promise<DocumentRecord[]> {
    const business = await this.getBusinessForUser(userId);
    if (!business) return [];

    const { data, error } = await this.supabase
      .from("documents")
      .select("*")
      .eq("business_id", business.id)
      .is("classified_by", null)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      throw new AppError(500, "read_failed", "Could not load documents to re-read.");
    }
    return (data ?? []).map((row) => toRecord(row as DocumentRow));
  }

  async countUnreadDocuments(userId: string): Promise<number> {
    const business = await this.getBusinessForUser(userId);
    if (!business) return 0;

    const { count } = await this.supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .is("classified_by", null);

    return count ?? 0;
  }

  async applyClassification(
    userId: string,
    docId: string,
    input: StoredClassification,
  ): Promise<DocumentRecord | null> {
    const doc = await this.getDocument(userId, docId);
    if (!doc) return null;

    const { data, error } = await this.supabase
      .from("documents")
      .update({
        category: input.category,
        document_date: input.documentDate,
        amount: input.amount,
        vendor: input.vendor,
        gstin: input.gstin,
        confidence: input.confidence,
        classified_by: input.model,
        updated_at: new Date().toISOString(),
      })
      .eq("id", docId)
      .select("*")
      .single();

    if (error || !data) {
      throw new AppError(500, "reclassify_failed", "Could not save the classification.");
    }
    return toRecord(data as DocumentRow);
  }
}
