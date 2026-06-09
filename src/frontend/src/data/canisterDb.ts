/**
 * canisterDb.ts
 *
 * Manages the ICP canister connection for TaxCore.
 *
 * Architecture (v3 - Firm-Scoped Blobs):
 * - User database is stored globally (globalUserDb) — all firms share one user store.
 * - App data is stored per-firm (saveFirmAppData / getFirmAppData) — firm-scoped blobs.
 * - The Administrator can read ALL firm summaries via getAllFirmSummaries.
 * - Owner/Staff can only read/write their own firm's data.
 * - Global fallback methods (getGlobalAppData/saveGlobalAppData) are kept for
 *   the one-time migration path only.
 */

import { createActorWithConfig } from "@caffeineai/core-infrastructure";
import { type backendInterface, createActor } from "../backend";
import type {
  AuditLogEntry,
  Billing,
  Client,
  DocumentInward,
  FirmAccount,
  ImportHistoryEntry,
  User,
  WhatsAppSettings,
  WorkProcessing,
} from "../types";

// ─── Actor singleton ─────────────────────────────────────────────────────────

let actorInstance: backendInterface | null = null;
let initializationPromise: Promise<backendInterface> | null = null;
let initialized = false;

export async function getActor(): Promise<backendInterface> {
  if (actorInstance && initialized) return actorInstance;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    const actor = await createActorWithConfig(createActor);
    actorInstance = actor;
    initialized = true;
    return actor;
  })();

  return initializationPromise;
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

function encodeJson(data: unknown): string {
  return JSON.stringify(data);
}

function decodeJson<T>(str: string): T | null {
  if (!str) return null;
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

// ─── Type definitions ─────────────────────────────────────────────────────────

export interface UserDatabase {
  users: User[];
  firmAccounts: FirmAccount[];
  superAdminCreated: boolean;
  whatsAppSettings: WhatsAppSettings | null;
}

export interface AppData {
  clients: Client[];
  documents: DocumentInward[];
  work: WorkProcessing[];
  billing: Billing[];
  auditLogs: AuditLogEntry[];
  importHistory?: ImportHistoryEntry[];
}

export interface FullCanisterData {
  userDb: UserDatabase | null;
  clients: Client[];
  documents: DocumentInward[];
  work: WorkProcessing[];
  billing: Billing[];
  auditLogs: AuditLogEntry[];
  importHistory: ImportHistoryEntry[];
  /** Tombstoned client IDs — clients permanently deleted from any device */
  deletedClientIds: string[];
}

// ─── User Database (global — shared across all firms) ─────────────────────────

export async function loadUserDatabase(): Promise<UserDatabase | null> {
  try {
    const actor = await getActor();
    const json = await actor.getGlobalUserDatabase();
    if (!json) return null;
    return decodeJson<UserDatabase>(json);
  } catch (err) {
    console.error("[canisterDb] loadUserDatabase failed:", err);
    return null;
  }
}

export async function saveUserDatabase(db: UserDatabase): Promise<void> {
  try {
    const actor = await getActor();
    const json = encodeJson(db);
    await actor.saveGlobalUserDatabase(json);
  } catch (err) {
    console.error("[canisterDb] saveUserDatabase failed:", err);
    throw err;
  }
}

// ─── Firm-scoped App Data ─────────────────────────────────────────────────────

/**
 * Load app data for a specific firm.
 * - Owner/Staff: pass their firmId and role.
 * - Returns empty data for a brand-new firm — never falls back to global blob.
 * - To seed existing data into admin's firm use migrateExistingDataToAdminFirm explicitly.
 */
export async function loadFirmAppData(
  firmId: string,
  role: string,
): Promise<AppData | null> {
  try {
    const actor = await getActor();
    const json = await actor.getFirmAppData(firmId, role);
    if (!json) return null;
    const data = decodeJson<AppData>(json);
    // Return firm data as-is (including empty arrays for a brand-new firm).
    // Do NOT fall back to globalAppData — that would leak another firm's data.
    // Migration to the admin firm is handled explicitly via migrateExistingDataToAdminFirm.
    return data;
  } catch (err) {
    console.error("[canisterDb] loadFirmAppData failed:", err);
    return null;
  }
}

/**
 * Save app data for a specific firm.
 * Uses the firm-scoped saveFirmAppData endpoint.
 */
export async function saveFirmAppData(
  firmId: string,
  role: string,
  data: AppData,
): Promise<void> {
  try {
    const actor = await getActor();
    const json = encodeJson(data);
    const ctx = { userId: firmId, role, firmId };
    const result = await actor.saveFirmAppData(ctx, json);
    if (!result.ok) {
      console.error(
        "[canisterDb] saveFirmAppData returned error:",
        result.message,
      );
      // Fall back to global save to avoid data loss
      await actor.saveGlobalAppData(json);
    }
  } catch (err) {
    console.error("[canisterDb] saveFirmAppData failed:", err);
    throw err;
  }
}

/**
 * Legacy global app data save — kept for migration path only.
 * @deprecated Use saveFirmAppData for normal writes.
 */
export async function saveAppData(data: AppData): Promise<void> {
  try {
    const actor = await getActor();
    const json = encodeJson(data);
    await actor.saveGlobalAppData(json);
  } catch (err) {
    console.error("[canisterDb] saveAppData (global) failed:", err);
    throw err;
  }
}

/**
 * Load firm user data (firm-scoped user subset).
 */
export async function loadFirmUserData(
  firmId: string,
  role: string,
): Promise<UserDatabase | null> {
  try {
    const actor = await getActor();
    const json = await actor.getFirmUserData(firmId, role);
    if (!json) return null;
    return decodeJson<UserDatabase>(json);
  } catch (err) {
    console.error("[canisterDb] loadFirmUserData failed:", err);
    return null;
  }
}

// ─── Full data load (firm-scoped) ─────────────────────────────────────────────

/**
 * Load all canister data for the given firm.
 * Uses firm-scoped endpoints; falls back to global if needed (migration).
 */
export async function loadAllFromCanister(
  firmId?: string,
  role?: string,
): Promise<FullCanisterData> {
  const [userDb, appData] = await Promise.all([
    loadUserDatabase().catch(() => null),
    firmId && role
      ? loadFirmAppData(firmId, role).catch(() => null)
      : loadGlobalAppData().catch(() => null),
  ]);

  return {
    userDb,
    clients: appData?.clients ?? [],
    documents: appData?.documents ?? [],
    work: appData?.work ?? [],
    billing: appData?.billing ?? [],
    auditLogs: appData?.auditLogs ?? [],
    importHistory: appData?.importHistory ?? [],
    deletedClientIds:
      (appData as (AppData & { deletedClientIds?: string[] }) | null)
        ?.deletedClientIds ?? [],
  };
}

/** Load global app data blob (migration / admin fallback). */
export async function loadGlobalAppData(): Promise<AppData | null> {
  try {
    const actor = await getActor();
    const json = await actor.getGlobalAppData();
    if (!json) return null;
    return decodeJson<AppData>(json);
  } catch (err) {
    console.error("[canisterDb] loadGlobalAppData failed:", err);
    return null;
  }
}

// ─── New backend endpoints wrappers ──────────────────────────────────────────

/**
 * Get migration status from the backend canister.
 */
export async function canisterGetMigrationStatus(): Promise<{
  migrated: boolean;
  migratedRecords: bigint;
  migrationVersion: bigint;
  adminFirmId: string;
} | null> {
  try {
    const actor = await getActor();
    return await actor.getMigrationStatus();
  } catch (err) {
    console.error("[canisterDb] getMigrationStatus failed:", err);
    return null;
  }
}

/**
 * Force-write a complete firm data payload to the canister, bypassing normal
 * shouldWrite guard. Used for data recovery to ensure ALL records are written.
 */
export async function canisterForceRecoverFirmData(
  targetFirmId: string,
  appDataPayload: string,
  recordCount: number,
): Promise<{ ok: boolean; message: string }> {
  try {
    const actor = await getActor();
    return await actor.forceRecoverFirmData(
      "Super Admin",
      targetFirmId,
      appDataPayload,
      BigInt(recordCount),
    );
  } catch (err) {
    console.error("[canisterDb] forceRecoverFirmData failed:", err);
    return { ok: false, message: String(err) };
  }
}

/**
 * Get total number of firm app data blobs stored in the canister.
 */
export async function canisterGetFirmAppDataCount(): Promise<number> {
  try {
    const actor = await getActor();
    const count = await actor.getFirmAppDataCount();
    return Number(count);
  } catch (err) {
    console.error("[canisterDb] getFirmAppDataCount failed:", err);
    return 0;
  }
}

// ─── Legacy no-ops (kept to avoid import errors in storage.ts) ────────────────
// These are called in storage.ts bgSync calls but are now handled by saveAppData.

export function buildClientIdMap() {
  return new Map<string, string>();
}

export async function canisterSaveClients(_clients: Client[]): Promise<void> {
  // Handled by saveAppData in storage.ts
}

export async function canisterSaveDocuments(
  _docs: DocumentInward[],
): Promise<void> {
  // Handled by saveAppData in storage.ts
}

export async function canisterSaveWork(_work: WorkProcessing[]): Promise<void> {
  // Handled by saveAppData in storage.ts
}

export async function canisterSaveBilling(_billing: Billing[]): Promise<void> {
  // Handled by saveAppData in storage.ts
}

export async function canisterAddLog(_log: AuditLogEntry): Promise<void> {
  // Handled by saveAppData in storage.ts
}
