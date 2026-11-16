/**
 * Development fallback store: a JSON file plus a local files directory.
 *
 * ⚠ Development only — NOT a production store. Used when Supabase is not
 * configured so the full workflow can be tested locally.
 *
 * Concurrency: all mutations are synchronous (fs.*Sync) between load and
 * save so interleaved requests cannot corrupt the JSON file in the
 * single-threaded dev server.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

import { AUTO_ACCEPT_CONFIDENCE } from "../config";
import type { Category } from "../config";
import { todayUtcDate } from "../dates";
import { buildStoragePath, extensionOf } from "../filenames";
import type { BusinessInfo, DocumentRecord, SessionUser } from "../types";
import type {
  CreateResult,
  DocumentPatch,
  DocumentStore,
  NewDocumentInput,
  StoredBytes,
  StoredClassification,
} from "./types";

interface StoreShape {
  users: {
    id: string;
    email: string;
    fullName: string | null;
    createdAt: string;
  }[];
  businesses: {
    id: string;
    ownerId: string;
    businessName: string;
    createdAt: string;
    updatedAt: string;
  }[];
  documents: DocumentRecord[];
}

const EMPTY: StoreShape = { users: [], businesses: [], documents: [] };

export class LocalDevDocumentStore implements DocumentStore {
  private readonly dataDir: string;
  private readonly storeFile: string;
  private readonly filesDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? join(process.cwd(), ".data");
    this.storeFile = join(this.dataDir, "dev-store.json");
    this.filesDir = join(this.dataDir, "files");
  }

  /* ----------------------------- store IO ----------------------------- */

  private load(): StoreShape {
    if (!existsSync(this.storeFile)) return structuredClone(EMPTY);
    try {
      const parsed = JSON.parse(readFileSync(this.storeFile, "utf8")) as StoreShape;
      return {
        users: parsed.users ?? [],
        businesses: parsed.businesses ?? [],
        documents: parsed.documents ?? [],
      };
    } catch {
      return structuredClone(EMPTY);
    }
  }

  private save(state: StoreShape): void {
    mkdirSync(dirname(this.storeFile), { recursive: true });
    writeFileSync(this.storeFile, JSON.stringify(state, null, 2), "utf8");
  }

  private now(): string {
    return new Date().toISOString();
  }

  private businessOf(
    state: StoreShape,
    userId: string,
  ): StoreShape["businesses"][number] | null {
    return state.businesses.find((b) => b.ownerId === userId) ?? null;
  }

  /* --------------------------- interface ------------------------------ */

  async provisionUser(
    user: SessionUser,
    options?: { businessName?: string },
  ): Promise<BusinessInfo> {
    const state = this.load();
    if (!state.users.some((u) => u.id === user.id)) {
      state.users.push({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        createdAt: this.now(),
      });
    }
    let business = this.businessOf(state, user.id);
    if (!business) {
      const now = this.now();
      business = {
        id: randomUUID(),
        ownerId: user.id,
        businessName: options?.businessName?.trim() || "My Business",
        createdAt: now,
        updatedAt: now,
      };
      state.businesses.push(business);
    } else if (options?.businessName?.trim()) {
      business.businessName = options.businessName.trim();
      business.updatedAt = this.now();
    }
    this.save(state);
    return { id: business.id, businessName: business.businessName };
  }

  async getBusinessForUser(userId: string): Promise<BusinessInfo | null> {
    const state = this.load();
    const business = this.businessOf(state, userId);
    return business
      ? { id: business.id, businessName: business.businessName }
      : null;
  }

  async listDocuments(userId: string): Promise<DocumentRecord[]> {
    const state = this.load();
    const business = this.businessOf(state, userId);
    if (!business) return [];
    return state.documents.filter((d) => d.businessId === business.id && !d.deletedAt);
  }

  async createDocuments(
    userId: string,
    inputs: NewDocumentInput[],
  ): Promise<CreateResult> {
    const state = this.load();
    if (!this.businessOf(state, userId)) {
      state.users.push({
        id: userId,
        email: `${userId}@dev.local`,
        fullName: null,
        createdAt: this.now(),
      });
      const now = this.now();
      state.businesses.push({
        id: randomUUID(),
        ownerId: userId,
        businessName: "My Business",
        createdAt: now,
        updatedAt: now,
      });
      this.save(state);
    }
    const business = this.businessOf(state, userId);
    if (!business) {
      return { created: [], errors: inputs.map((i) => ({ filename: i.originalFilename, error: "No business profile." })) };
    }

    const created: DocumentRecord[] = [];
    const errors: { filename: string; error: string }[] = [];
    const now = this.now();

    for (const input of inputs) {
      try {
        const ext = extensionOf(input.originalFilename) || "bin";
        const effectiveDate = input.documentDate ?? todayUtcDate();
        const id = randomUUID();
        const storagePath = buildStoragePath(business.id, effectiveDate, ext, id);
        const absPath = join(this.filesDir, storagePath);
        mkdirSync(dirname(absPath), { recursive: true });
        writeFileSync(absPath, Buffer.from(input.bytes));

        const record: DocumentRecord = {
          id,
          businessId: business.id,
          uploadedBy: userId,
          originalFilename: input.originalFilename,
          storagePath,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          documentDate: input.documentDate,
          category: input.category as Category,
          createdAt: now,
          updatedAt: now,
          sourceType: input.sourceType ?? "upload",
          sourceAccount: input.sourceAccount ?? null,
          sourceFileId: input.sourceFileId ?? null,
          importedAt: now,
          processingStatus: "pending",
          verificationStatus: "unverified",
          deletedAt: null,
        };
        state.documents.push(record);
        created.push(record);
      } catch {
        errors.push({
          filename: input.originalFilename,
          error: "Could not store the file. Please try again.",
        });
      }
    }

    this.save(state);
    return { created, errors };
  }

  async getDocument(userId: string, docId: string): Promise<DocumentRecord | null> {
    const state = this.load();
    const business = this.businessOf(state, userId);
    if (!business) return null;
    const doc = state.documents.find((d) => d.id === docId);
    if (!doc || doc.businessId !== business.id || doc.deletedAt) return null;
    return doc;
  }

  async deleteDocument(userId: string, docId: string): Promise<boolean> {
    const doc = await this.getDocument(userId, docId);
    if (!doc) return false;

    const state = this.load();
    const target = state.documents.find((d) => d.id === docId);
    if (!target) return false;
    target.deletedAt = this.now();
    target.updatedAt = this.now();
    this.save(state);
    return true;
  }

  async readDocument(userId: string, docId: string): Promise<StoredBytes | null> {
    const doc = await this.getDocument(userId, docId);
    if (!doc) return null;
    const absPath = join(this.filesDir, doc.storagePath);
    if (!existsSync(absPath)) return { record: doc, bytes: null };
    return { record: doc, bytes: new Uint8Array(readFileSync(absPath)) };
  }

  async getPreviewUrl(
    userId: string,
    record: DocumentRecord,
  ): Promise<string | null> {
    const doc = await this.getDocument(userId, record.id);
    if (!doc) return null;
    // Dev mode streams through the authorized download route.
    return `/api/documents/${record.id}/download?inline=1`;
  }

  async listForReview(userId: string): Promise<DocumentRecord[]> {
    const docs = await this.listDocuments(userId);
    return docs.filter(
      (doc) =>
        doc.classifiedBy !== "human" &&
        ((doc.confidence ?? 1) < AUTO_ACCEPT_CONFIDENCE || doc.category === "Other"),
    );
  }

  async updateDocument(
    userId: string,
    docId: string,
    patch: DocumentPatch,
  ): Promise<DocumentRecord | null> {
    const doc = await this.getDocument(userId, docId);
    if (!doc) return null;

    const state = this.load();
    const target = state.documents.find((entry) => entry.id === docId);
    if (!target) return null;

    target.category = patch.category;
    target.documentDate = patch.documentDate;
    target.amount = patch.amount;
    target.confidence = 1;
    target.classifiedBy = "human";
    target.updatedAt = this.now();
    this.save(state);
    return target;
  }

  async listUnreadDocuments(userId: string, limit: number): Promise<DocumentRecord[]> {
    const docs = await this.listDocuments(userId);
    return docs
      .filter((doc) => !doc.classifiedBy)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);
  }

  async countUnreadDocuments(userId: string): Promise<number> {
    const docs = await this.listDocuments(userId);
    return docs.filter((doc) => !doc.classifiedBy).length;
  }

  async applyClassification(
    userId: string,
    docId: string,
    input: StoredClassification,
  ): Promise<DocumentRecord | null> {
    const doc = await this.getDocument(userId, docId);
    if (!doc) return null;

    const state = this.load();
    const target = state.documents.find((entry) => entry.id === docId);
    if (!target) return null;

    target.category = input.category;
    target.documentDate = input.documentDate;
    target.amount = input.amount;
    target.vendor = input.vendor;
    target.gstin = input.gstin;
    target.confidence = input.confidence;
    target.classifiedBy = input.model;
    target.updatedAt = this.now();
    this.save(state);
    return target;
  }

  /** Test helper: remove the whole dev data directory. */
  reset(): void {
    rmSync(this.dataDir, { recursive: true, force: true });
  }}
