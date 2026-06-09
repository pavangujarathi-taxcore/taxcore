/**
 * storage.ts
 *
 * Hybrid storage layer for TaxCore.
 * - In-memory cache for instant synchronous reads
 * - localStorage for offline/fast fallback cache
 * - ICP canister for permanent cross-device persistence (global blobs)
 *
 * v2: All canister I/O now uses two global JSON blobs (not per-caller maps).
 * This means any browser/device can read the same data without ICP identity issues.
 */

import type { ImportHistoryEntry } from "../types";
import type {
  AuditLogEntry,
  Billing,
  Client,
  DocumentInward,
  FirmAccount,
  NotificationLog,
  User,
  WhatsAppSettings,
  WorkProcessing,
} from "../types";
import {
  type UserDatabase,
  loadAllFromCanister,
  loadFirmAppData,
  loadGlobalAppData,
  loadUserDatabase,
  saveAppData,
  saveFirmAppData,
  saveUserDatabase,
} from "./canisterDb";

const KEYS = {
  users: "taxcore_users",
  clients: "taxcore_clients",
  documents: "taxcore_documents",
  work: "taxcore_work",
  billing: "taxcore_billing",
  currentUser: "taxcore_current_user",
  firmAccounts: "taxcore_firm_accounts",
  superAdminCreated: "taxcore_super_admin_created",
  auditLogs: "taxcore_audit_logs",
  whatsappSettings: "taxcore_whatsapp_settings",
  notificationLogs: "taxcore_notification_logs",
  importHistory: "taxcore_import_history",
};

// ─── In-memory cache ───────────────────────────────────────────────────────

const cache: {
  users: User[];
  clients: Client[];
  documents: DocumentInward[];
  work: WorkProcessing[];
  billing: Billing[];
  firmAccounts: FirmAccount[];
  auditLogs: AuditLogEntry[];
  notificationLogs: NotificationLog[];
  importHistory: ImportHistoryEntry[];
  superAdminCreated: boolean;
  whatsappSettings: WhatsAppSettings | null;
  // Tombstone: IDs of clients permanently deleted on this device
  deletedClientIds: string[];
  // Monotonically increasing version — incremented on every write
  dataVersion: number;
} = {
  users: [],
  clients: [],
  documents: [],
  work: [],
  billing: [],
  firmAccounts: [],
  auditLogs: [],
  notificationLogs: [],
  importHistory: [],
  superAdminCreated: false,
  whatsappSettings: null,
  deletedClientIds: [],
  dataVersion: 0,
};

// ─── Initialization state ────────────────────────────────────────────────────

let initPromise: Promise<void> | null = null;
let isInitialized = false;
export let lastSyncTime: Date | null = null;

// Write-lock: true while a bgSync write is queued OR actively writing to canister.
// Set synchronously when any appData save is queued so silentRefreshFromCanister
// cannot race in and overwrite the local cache before the canister write starts.
let _canisterWriteInFlight = false;
// Tracks whether there are any pending appData bgSync writes (queued or in-flight).
// When this reaches 0, _canisterWriteInFlight is cleared.
let _appDataWritesPending = 0;

// ─── localStorage helpers ───────────────────────────────────────────────────

function lsGet<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]") as T[];
  } catch {
    return [];
  }
}

function lsSet<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Load cache from localStorage ─────────────────────────────────────────────────

function loadCacheFromLocalStorage(): void {
  cache.users = lsGet<User>(KEYS.users);
  cache.clients = lsGet<Client>(KEYS.clients);
  cache.documents = lsGet<DocumentInward>(KEYS.documents);
  cache.work = lsGet<WorkProcessing>(KEYS.work);
  cache.billing = lsGet<Billing>(KEYS.billing);
  cache.firmAccounts = lsGet<FirmAccount>(KEYS.firmAccounts);
  cache.auditLogs = lsGet<AuditLogEntry>(KEYS.auditLogs);
  cache.notificationLogs = lsGet<NotificationLog>(KEYS.notificationLogs);
  cache.importHistory = lsGet<ImportHistoryEntry>(KEYS.importHistory);
  cache.superAdminCreated =
    localStorage.getItem(KEYS.superAdminCreated) === "true";
  try {
    const raw = localStorage.getItem(KEYS.whatsappSettings);
    cache.whatsappSettings = raw ? (JSON.parse(raw) as WhatsAppSettings) : null;
  } catch {
    cache.whatsappSettings = null;
  }
  // Load tombstoned deleted client IDs from localStorage
  try {
    const rawDeleted = localStorage.getItem("taxcore_deleted_client_ids");
    cache.deletedClientIds = rawDeleted
      ? (JSON.parse(rawDeleted) as string[])
      : [];
  } catch {
    cache.deletedClientIds = [];
  }
}

// ─── Dispatch change event ───────────────────────────────────────────────────

function dispatchChange(key?: string): void {
  window.dispatchEvent(
    new CustomEvent("taxcore-storage-change", { detail: { key } }),
  );
}

// ─── Background sync helper ──────────────────────────────────────────────────
// Serialized write queue per data type to prevent race conditions.
// Writes to cache + localStorage immediately, dispatches change event,
// then syncs to canister via a per-type serial queue (no concurrent writes for same type).
// Exponential backoff: 1s, 2s, 4s, 8s, 16s (5 retries).

// Queue: map of syncType -> list of pending syncFn
const _syncQueues = new Map<string, Array<() => Promise<void>>>();
const _syncInFlight = new Map<string, boolean>();

function _drainQueue(type: string): void {
  if (_syncInFlight.get(type)) return;
  const queue = _syncQueues.get(type);
  if (!queue || queue.length === 0) {
    // No more items — if this is appData, release the lock
    if (type === "appData" && _appDataWritesPending === 0) {
      _canisterWriteInFlight = false;
    }
    return;
  }

  // Dequeue the LATEST version (skip stale intermediates — only most recent matters).
  // All queued items are collapsed into one: the latest snapshot wins.
  const skipped = queue.length - 1;
  const syncFn = queue[queue.length - 1];
  _syncQueues.set(type, []);
  _syncInFlight.set(type, true);
  // Stale intermediate items are resolved: decrement their pending count now.
  if (type === "appData" && skipped > 0) {
    _appDataWritesPending = Math.max(0, _appDataWritesPending - skipped);
  }

  const attempt = (remaining: number, delayMs: number) => {
    syncFn()
      .then(() => {
        _syncInFlight.set(type, false);
        // This write completed — decrement for the one item we actually executed.
        if (type === "appData") {
          _appDataWritesPending = Math.max(0, _appDataWritesPending - 1);
          if (_appDataWritesPending === 0) _canisterWriteInFlight = false;
        }
        // Process any newly queued item
        _drainQueue(type);
      })
      .catch((err) => {
        console.warn(`[storage] canister sync failed (${type}):`, err);
        if (remaining > 0) {
          // Keep lock held between retries so silentRefresh won't overwrite
          // the local state that the retry will re-send.
          setTimeout(() => attempt(remaining - 1, delayMs * 2), delayMs);
        } else {
          console.error(
            `[storage] canister sync permanently failed (${type}) after retries`,
          );
          _syncInFlight.set(type, false);
          if (type === "appData") {
            _appDataWritesPending = Math.max(0, _appDataWritesPending - 1);
            if (_appDataWritesPending === 0) _canisterWriteInFlight = false;
          }
          _drainQueue(type);
        }
      });
  };
  attempt(5, 1000); // 5 retries: 1s, 2s, 4s, 8s, 16s
}

function bgSync(syncFn: () => Promise<void>, type: string): void {
  if (!_syncQueues.has(type)) _syncQueues.set(type, []);
  _syncQueues.get(type)!.push(syncFn);
  // Set write-lock immediately (synchronously, before drain starts) so
  // silentRefreshFromCanister cannot race in between bgSync() call and
  // the actual canister write starting in _drainQueue.
  if (type === "appData") {
    _canisterWriteInFlight = true;
    _appDataWritesPending++;
  }
  _drainQueue(type);
}

/**
 * Queues a firm-scoped appData bgSync.
 * Resolves the firmId + role at drain time (reads current user) so it's always fresh.
 */
function bgSyncAppData(): void {
  bgSync(async () => {
    const firmId = getCurrentFirmId();
    const role = getCurrentRole();
    const snapshot = buildAppDataSnapshot();
    if (firmId) {
      await saveFirmAppData(firmId, role, snapshot);
    } else {
      // Fallback for Super Admin or unscoped contexts — use global save
      await saveAppData(snapshot);
    }
  }, "appData");
}

// ─── Helper: build current AppData snapshot for canister save ──────────────────

/**
 * Returns the firmId for the currently logged-in user.
 * - Owner: their own user.id
 * - Staff: their firmOwnerId (which is the Owner's id, used as firmId)
 * - Super Admin: special sentinel "__admin__" (never writes app data)
 * Returns null if no user is logged in.
 */
function getCurrentFirmId(): string | null {
  const user = storage.getCurrentUser();
  if (!user) return null;
  if (user.role === "Super Admin") return null;
  // If user already has firmId stamped, use it
  if (user.firmId) return user.firmId;
  // Owner: firmId is their own id
  if (user.role === "Owner") return user.id;
  // Staff: firmId is their firmOwnerId
  return user.firmOwnerId ?? null;
}

/**
 * Returns the role string used for canister access-control checks.
 */
function getCurrentRole(): string {
  const user = storage.getCurrentUser();
  return user?.role ?? "Owner";
}

function buildAppDataSnapshot() {
  const firmId = getCurrentFirmId();
  // Stamp firmId on all records that are missing it
  const stampFirmId = <T extends { firmId?: string }>(items: T[]): T[] =>
    items.map((item) =>
      item.firmId ? item : { ...item, firmId: firmId ?? undefined },
    );

  return {
    clients: stampFirmId(Array.isArray(cache.clients) ? cache.clients : []),
    documents: stampFirmId(
      Array.isArray(cache.documents) ? cache.documents : [],
    ),
    work: stampFirmId(Array.isArray(cache.work) ? cache.work : []),
    billing: stampFirmId(Array.isArray(cache.billing) ? cache.billing : []),
    auditLogs: stampFirmId(
      Array.isArray(cache.auditLogs) ? cache.auditLogs : [],
    ),
    importHistory: Array.isArray(cache.importHistory)
      ? cache.importHistory
      : [],
    // Include tombstone so other devices can filter out permanently-deleted clients
    deletedClientIds: Array.isArray(cache.deletedClientIds)
      ? cache.deletedClientIds
      : [],
    dataVersion: cache.dataVersion,
  };
}

function buildUserDbSnapshot(): UserDatabase {
  return {
    users: cache.users,
    firmAccounts: cache.firmAccounts,
    superAdminCreated: cache.superAdminCreated,
    whatsAppSettings: cache.whatsappSettings,
  };
}

/** Immediately (awaited) saves the user database to canister. Use for critical first-time saves. */
export async function saveUserDatabaseNow(): Promise<void> {
  await saveUserDatabase(buildUserDbSnapshot());
}

/**
 * Force-flushes the current in-memory cache to the canister immediately (awaited).
 * Saves firm-scoped appData (or global for Admin) AND globalUserDb in parallel.
 * Sets the write-lock (_canisterWriteInFlight) while in flight so
 * silentRefreshFromCanister skips overwriting clients during the window.
 */
export async function forceSyncToCanister(): Promise<void> {
  _canisterWriteInFlight = true;
  try {
    const firmId = getCurrentFirmId();
    const role = getCurrentRole();
    const snapshot = buildAppDataSnapshot();
    const appSave = firmId
      ? saveFirmAppData(firmId, role, snapshot)
      : saveAppData(snapshot);
    await Promise.all([appSave, saveUserDatabase(buildUserDbSnapshot())]);
  } finally {
    _canisterWriteInFlight = false;
  }
}

/**
 * Records client IDs as permanently deleted (tombstone).
 * Persists tombstone list to localStorage so it survives page reloads.
 * Every AppData snapshot includes the tombstone, so other devices can filter too.
 */
export function tombstoneDeletedClients(ids: string[]): void {
  const existing = new Set(cache.deletedClientIds);
  for (const id of ids) existing.add(id);
  cache.deletedClientIds = Array.from(existing);
  localStorage.setItem(
    "taxcore_deleted_client_ids",
    JSON.stringify(cache.deletedClientIds),
  );
}

/**
 * Saves users immediately to canister (awaited, not fire-and-forget).
 * Use after any user creation/deletion to guarantee cross-device visibility
 * within the next 5-second poll cycle.
 */
export async function saveUsersNow(users: User[]): Promise<void> {
  cache.users = users;
  lsSet(KEYS.users, users);
  const hasSA = users.some((u) => u.role === "Super Admin");
  if (hasSA) {
    cache.superAdminCreated = true;
    localStorage.setItem(KEYS.superAdminCreated, "true");
  }
  dispatchChange(KEYS.users);
  await saveUserDatabase(buildUserDbSnapshot());
}

// ─── Firm number backfill ────────────────────────────────────────────────────

/**
 * Assigns sequential firmNumbers (TaxCore_001, TaxCore_002, …) to any
 * FirmAccount that is missing one.
 * Sorts by createdAt ascending so the oldest firm gets _001.
 * Safe to call repeatedly — skips accounts that already have a firmNumber.
 */
export function backfillFirmNumbers(): void {
  const accounts = cache.firmAccounts;
  // Collect accounts that already have a number to avoid gaps
  const assigned = new Set(
    accounts.filter((f) => f.firmNumber).map((f) => f.firmNumber as string),
  );

  // Sort missing-number accounts by createdAt ascending
  const missing = accounts
    .filter((f) => !f.firmNumber)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  if (missing.length === 0) return; // Nothing to do

  // Find the highest existing sequence number so we don't reuse
  let maxSeq = 0;
  for (const num of assigned) {
    const match = num.match(/TaxCore_(\d+)$/);
    if (match) maxSeq = Math.max(maxSeq, Number.parseInt(match[1], 10));
  }

  // Assign incrementing numbers to accounts that are missing one
  let seq = maxSeq;
  const updated = accounts.map((f) => {
    if (f.firmNumber) return f;
    seq += 1;
    return { ...f, firmNumber: `TaxCore_${String(seq).padStart(3, "0")}` };
  });

  cache.firmAccounts = updated;
  lsSet(KEYS.firmAccounts, updated);
  // Persist to canister in background — does not block startup
  bgSync(async () => {
    await saveUserDatabase(buildUserDbSnapshot());
  }, "userDb");
}

// ─── Pre-isolation data migration ───────────────────────────────────────────

/**
 * Checks whether the v79 pre-isolation data migration needs to run.
 * Returns { needed: true } when the localStorage flag is absent,
 * meaning the migration has not yet been executed on this device.
 */
// Single consistent migration flag for v84 — covers both migration + recovery
const MIGRATION_FLAG_V84 = "taxcore_migration_v84";

export function getMigrationStatus(): { needed: boolean; alreadyRun: boolean } {
  const alreadyRun = localStorage.getItem(MIGRATION_FLAG_V84) === "done";
  return { needed: !alreadyRun, alreadyRun };
}

export function getRecoveryStatus(): { alreadyRun: boolean; needed: boolean } {
  const alreadyRun = localStorage.getItem(MIGRATION_FLAG_V84) === "done";
  return { alreadyRun, needed: !alreadyRun };
}

/**
 * Clears the migration/recovery flag so the next call to initialize()
 * or a manual button press will re-run the full recovery.
 * Used by the "Force Re-run Migration" button.
 */
export function clearMigrationFlag(): void {
  localStorage.removeItem(MIGRATION_FLAG_V84);
  // Also clear old flag names so stale guards don't block the new run
  localStorage.removeItem("taxcore_migration_v83");
  localStorage.removeItem("taxcore_migration_v79");
  localStorage.removeItem("taxcore_recovery_v80b");
  localStorage.removeItem("taxcore_recovery_v81");
}

export async function runFirmDataRecovery(): Promise<{
  success: boolean;
  recoveredCounts: {
    clients: number;
    work: number;
    documents: number;
    billing: number;
  };
  firmBreakdown: Record<string, number>;
  error?: string;
}> {
  // Import canisterForceRecoverFirmData lazily to avoid circular dep at module level
  const { canisterForceRecoverFirmData: forceWrite } = await import(
    "./canisterDb"
  );

  try {
    // ─── Step 1: Fetch FRESH users from canister (never rely on stale cache) ───
    let freshUsers: User[] = cache.users;
    let freshFirmAccounts: FirmAccount[] = cache.firmAccounts;
    try {
      const freshDb = await loadUserDatabase();
      if (freshDb && Array.isArray(freshDb.users) && freshDb.users.length > 0) {
        freshUsers = freshDb.users;
        cache.users = freshUsers;
        lsSet(KEYS.users, freshUsers);
      }
      if (
        freshDb &&
        Array.isArray(freshDb.firmAccounts) &&
        freshDb.firmAccounts.length > 0
      ) {
        freshFirmAccounts = freshDb.firmAccounts;
        cache.firmAccounts = freshFirmAccounts;
        lsSet(KEYS.firmAccounts, freshFirmAccounts);
      }
    } catch (_) {}

    // ─── Step 2: Build userFirmMap from FRESH users ───────────────────────────
    // userId -> firmId  AND  email -> firmId
    const userFirmMap: Record<string, string> = {};
    for (const u of freshUsers) {
      if (u.role === "Super Admin") continue;
      const fid =
        u.role === "Owner"
          ? (u.firmId ?? u.id)
          : ((u as any).firmOwnerId ?? u.id);
      userFirmMap[u.id] = fid;
      if (u.email) userFirmMap[u.email.toLowerCase()] = fid;
    }

    // Find TaxCore_001 (first firm by sequence number) — all orphaned records go here
    const firstFirmAccount = freshFirmAccounts
      .filter((fa) => fa.firmNumber)
      .sort((a, b) => {
        const aSeq = Number.parseInt(
          (a.firmNumber ?? "").replace("TaxCore_", "") || "999",
          10,
        );
        const bSeq = Number.parseInt(
          (b.firmNumber ?? "").replace("TaxCore_", "") || "999",
          10,
        );
        return aSeq - bSeq;
      })[0];

    const taxcore001Account = firstFirmAccount ?? freshFirmAccounts[0];
    if (!taxcore001Account) {
      // No firms yet — nothing to recover to
      localStorage.setItem(MIGRATION_FLAG_V84, "done");
      return {
        success: true,
        recoveredCounts: { clients: 0, work: 0, documents: 0, billing: 0 },
        firmBreakdown: {},
      };
    }

    const taxcore001Owner = freshUsers.find(
      (u) =>
        u.email?.toLowerCase() === taxcore001Account.email?.toLowerCase() &&
        u.role === "Owner",
    );
    if (!taxcore001Owner) {
      // Owner not found — don't mark done so we can retry when they appear
      return {
        success: true,
        recoveredCounts: { clients: 0, work: 0, documents: 0, billing: 0 },
        firmBreakdown: {},
      };
    }
    const taxcore001FirmId: string =
      taxcore001Owner.firmId ?? taxcore001Owner.id;

    // ─── Step 3: Resolve firmId for a record's createdBy field ───────────────
    // ALL unresolvable records are assigned to TaxCore_001 (never admin).
    const resolveFirmIdForRecord = (createdBy?: string): string => {
      if (!createdBy) return taxcore001FirmId;
      if (userFirmMap[createdBy]) return userFirmMap[createdBy];
      if (userFirmMap[createdBy.toLowerCase()])
        return userFirmMap[createdBy.toLowerCase()];
      if (createdBy.includes("@")) {
        const domain = createdBy.split("@")[1]?.toLowerCase();
        if (domain) {
          for (const [key, val] of Object.entries(userFirmMap)) {
            if (
              key.includes("@") &&
              key.split("@")[1]?.toLowerCase() === domain
            )
              return val;
          }
        }
      }
      return taxcore001FirmId;
    };

    // ─── Step 4: Load ALL data sources ───────────────────────────────────────
    // Collect: globalData, adminData, AND every per-firm blob
    let globalData: any = {};
    let adminData: any = {};
    try {
      const globalRaw = await loadGlobalAppData();
      if (globalRaw) globalData = globalRaw as any;
    } catch (_) {}
    try {
      const adminRaw = await loadFirmAppData(
        `${taxcore001FirmId}_admin`,
        "Owner",
      );
      if (adminRaw) adminData = adminRaw as any;
    } catch (_) {}

    // Fetch all known firm blobs
    const allFirmBlobs: { firmId: string; data: any }[] = [];
    for (const fa of freshFirmAccounts) {
      const ownerUser = freshUsers.find(
        (u) =>
          u.email?.toLowerCase() === fa.email?.toLowerCase() &&
          u.role === "Owner",
      );
      if (!ownerUser) continue;
      const fid = ownerUser.firmId ?? ownerUser.id;
      try {
        const blob = await loadFirmAppData(fid, "Owner");
        if (blob) allFirmBlobs.push({ firmId: fid, data: blob as any });
      } catch (_) {}
    }

    // ─── Step 5: Collect ALL records, stamp correct firmId ───────────────────
    // CRITICAL: Do NOT pre-populate seenKeys from existing firm blobs.
    // That was the bug — it caused records already in TaxCore_001 from previous
    // (partial) recoveries to be skipped, leaving the other 32 records invisible.
    //
    // Instead: collect EVERY record from EVERY source, assign the correct firmId,
    // then de-duplicate by ID within the target firm blob only.

    // All records collected across all sources, with firmId stamped
    const allCollectedClients: any[] = [];
    const allCollectedWork: any[] = [];
    const allCollectedDocs: any[] = [];
    const allCollectedBilling: any[] = [];

    const collectRecord = (
      target: any[],
      record: any,
      recordFirmIdResolver: (r: any) => string,
    ) => {
      const resolvedFirmId = recordFirmIdResolver(record);
      target.push({ ...record, firmId: resolvedFirmId });
    };

    const resolveClientFirmId = (c: any): string => {
      // If firmId is set and matches a known user, trust it
      if (c.firmId && userFirmMap[c.firmId]) return c.firmId;
      return resolveFirmIdForRecord(c.createdBy);
    };
    const resolveWorkFirmId = (w: any): string => {
      if (w.firmId && userFirmMap[w.firmId]) return w.firmId;
      return resolveFirmIdForRecord(w.createdBy);
    };
    const resolveDocFirmId = (d: any): string => {
      if (d.firmId && userFirmMap[d.firmId]) return d.firmId;
      return resolveFirmIdForRecord(d.createdBy);
    };
    const resolveBillingFirmId = (b: any): string => {
      if (b.firmId && userFirmMap[b.firmId]) return b.firmId;
      return resolveFirmIdForRecord(b.createdBy);
    };

    // Collect from global and admin blobs
    for (const c of globalData.clients ?? [])
      collectRecord(allCollectedClients, c, resolveClientFirmId);
    for (const w of globalData.work ?? [])
      collectRecord(allCollectedWork, w, resolveWorkFirmId);
    for (const d of globalData.documents ?? [])
      collectRecord(allCollectedDocs, d, resolveDocFirmId);
    for (const b of globalData.billing ?? [])
      collectRecord(allCollectedBilling, b, resolveBillingFirmId);
    for (const c of adminData.clients ?? [])
      collectRecord(allCollectedClients, c, resolveClientFirmId);
    for (const w of adminData.work ?? [])
      collectRecord(allCollectedWork, w, resolveWorkFirmId);
    for (const d of adminData.documents ?? [])
      collectRecord(allCollectedDocs, d, resolveDocFirmId);
    for (const b of adminData.billing ?? [])
      collectRecord(allCollectedBilling, b, resolveBillingFirmId);
    // Also collect from all per-firm blobs (catches mis-assigned records)
    for (const { data } of allFirmBlobs) {
      for (const c of data.clients ?? [])
        collectRecord(allCollectedClients, c, resolveClientFirmId);
      for (const w of data.work ?? [])
        collectRecord(allCollectedWork, w, resolveWorkFirmId);
      for (const d of data.documents ?? [])
        collectRecord(allCollectedDocs, d, resolveDocFirmId);
      for (const b of data.billing ?? [])
        collectRecord(allCollectedBilling, b, resolveBillingFirmId);
    }

    // ─── Step 6: Group by firmId and de-duplicate by record ID within each firm ──
    // De-dup strategy: use client.id (or pan+taxYear+returnType as fallback) within
    // the DESTINATION firm only — never cross-firm. This ensures all 45 records
    // for TaxCore_001 are included even if some already existed there.
    const groupByFirm = <T extends { id?: string; firmId?: string }>(
      items: T[],
    ) => {
      const map = new Map<string, T[]>();
      for (const item of items) {
        const fid = item.firmId ?? taxcore001FirmId;
        if (!map.has(fid)) map.set(fid, []);
        map.get(fid)!.push(item);
      }
      return map;
    };

    const deduplicateById = <T extends { id?: string }>(items: T[]): T[] => {
      const seen = new Set<string>();
      const result: T[] = [];
      for (const item of items) {
        const key = item.id ?? JSON.stringify(item);
        if (!seen.has(key)) {
          seen.add(key);
          result.push(item);
        }
      }
      return result;
    };

    // For clients, also deduplicate by pan+taxYear+returnType to prevent true duplicates
    const deduplicateClients = (clients: any[]): any[] => {
      const seen = new Set<string>();
      const result: any[] = [];
      for (const c of clients) {
        // Primary dedup by ID
        const idKey = c.id ?? JSON.stringify(c);
        // Secondary dedup by PAN+TaxYear+ReturnType (business uniqueness constraint)
        const bizKey = `${c.pan}|${c.taxYear}|${c.returnType ?? ""}`;
        if (!seen.has(idKey) && !seen.has(bizKey)) {
          seen.add(idKey);
          seen.add(bizKey);
          result.push(c);
        }
      }
      return result;
    };

    const clientsByFirm = groupByFirm(allCollectedClients);
    const workByFirm = groupByFirm(allCollectedWork);
    const docsByFirm = groupByFirm(allCollectedDocs);
    const billingByFirm = groupByFirm(allCollectedBilling);

    // Gather all firmIds that have any records
    const allFirmIds = new Set<string>([
      taxcore001FirmId,
      ...clientsByFirm.keys(),
      ...workByFirm.keys(),
      ...docsByFirm.keys(),
      ...billingByFirm.keys(),
    ]);

    // ─── Step 7: Write each firm's merged blob using forceWrite ──────────────
    _canisterWriteInFlight = true;
    _appDataWritesPending += 1;
    const firmBreakdown: Record<string, number> = {};
    let totalNewClients = 0;
    let totalNewWork = 0;
    let totalNewDocs = 0;
    let totalNewBilling = 0;

    try {
      for (const fid of allFirmIds) {
        // Load existing firm blob as baseline (preserve auditLogs, importHistory, etc.)
        let existingBlob: any = {};
        try {
          const ex = await loadFirmAppData(fid, "Owner");
          if (ex) existingBlob = ex as any;
        } catch (_) {}

        const rawClients = clientsByFirm.get(fid) ?? [];
        const rawWork = workByFirm.get(fid) ?? [];
        const rawDocs = docsByFirm.get(fid) ?? [];
        const rawBilling = billingByFirm.get(fid) ?? [];

        const mergedClients = deduplicateClients(rawClients);
        const mergedWork = deduplicateById(rawWork);
        const mergedDocs = deduplicateById(rawDocs);
        const mergedBilling = deduplicateById(rawBilling);

        const prevClientCount = (existingBlob.clients ?? []).length;
        const snapshot = {
          ...existingBlob,
          clients: mergedClients,
          work: mergedWork,
          documents: mergedDocs,
          billing: mergedBilling,
        };

        const addedCount = mergedClients.length - prevClientCount;
        if (mergedClients.length > 0) {
          firmBreakdown[fid] = mergedClients.length;
        }
        if (fid === taxcore001FirmId) {
          totalNewClients = mergedClients.length;
          totalNewWork = mergedWork.length;
          totalNewDocs = mergedDocs.length;
          totalNewBilling = mergedBilling.length;
        }

        // Use forceWrite to bypass backend shouldWrite guard
        const payload = JSON.stringify(snapshot);
        const writeResult = await forceWrite(
          fid,
          payload,
          mergedClients.length,
        );
        if (!writeResult.ok) {
          console.warn(
            `[recovery] forceWrite failed for firm ${fid}:`,
            writeResult.message,
          );
          // Fall back to normal save to avoid data loss
          await saveFirmAppData(fid, "Owner", snapshot as any);
        }

        console.log(
          `[recovery] Firm ${fid}: ${mergedClients.length} clients (was ${prevClientCount}, added ${addedCount})`,
        );
      }

      // Update local cache with TaxCore_001 data so UI reflects immediately
      const tc001Clients = deduplicateClients(
        clientsByFirm.get(taxcore001FirmId) ?? [],
      );
      const tc001Work = deduplicateById(workByFirm.get(taxcore001FirmId) ?? []);
      const tc001Docs = deduplicateById(docsByFirm.get(taxcore001FirmId) ?? []);
      const tc001Billing = deduplicateById(
        billingByFirm.get(taxcore001FirmId) ?? [],
      );

      if (tc001Clients.length > 0) {
        cache.clients = tc001Clients;
        cache.work = tc001Work;
        cache.documents = tc001Docs;
        cache.billing = tc001Billing;
        lsSet(KEYS.clients, cache.clients);
        lsSet(KEYS.work, cache.work);
        lsSet(KEYS.documents, cache.documents);
        lsSet(KEYS.billing, cache.billing);
      }

      // Add audit log entry
      const auditEntry = {
        id: uid(),
        timestamp: new Date().toISOString(),
        action: "Firm Data Recovery v84",
        details: `Recovered ${totalNewClients} clients for TaxCore_001 (${taxcore001FirmId}). All firms: ${JSON.stringify(firmBreakdown)}`,
        username: "System",
        userRole: "Administrator",
        firmId: taxcore001FirmId,
        userId: "",
        userName: "System",
        clientId: "",
        clientName: "",
        fieldChanged: "firmId",
        oldValue: "",
        newValue: taxcore001FirmId,
      };
      cache.auditLogs = [auditEntry, ...cache.auditLogs];
      lsSet(KEYS.auditLogs, cache.auditLogs);

      dispatchChange("recovery");
    } finally {
      _appDataWritesPending = Math.max(0, _appDataWritesPending - 1);
      if (_appDataWritesPending === 0) _canisterWriteInFlight = false;
    }

    // Mark recovery as done
    localStorage.setItem(MIGRATION_FLAG_V84, "done");
    return {
      success: true,
      recoveredCounts: {
        clients: totalNewClients,
        work: totalNewWork,
        documents: totalNewDocs,
        billing: totalNewBilling,
      },
      firmBreakdown,
    };
  } catch (err: any) {
    return {
      success: false,
      error: String(err?.message ?? err),
      recoveredCounts: { clients: 0, work: 0, documents: 0, billing: 0 },
      firmBreakdown: {},
    };
  }
}

/**
 * Runs the pre-isolation data migration (one-time, v79).
 *
 * All records stored before Version 77 have no firmId. This function:
 * 1. Loads the global canister blob (contains all firms' legacy data).
 * 2. Maps each record to its owner firm via `createdBy` email match.
 *    - Clients/work/docs/billing: resolve via `createdBy` → user email → Owner → firmId.
 *    - Staff-created records: trace `createdBy` → staff user → `firmOwnerId` → firmId.
 *    - Orphaned records (no resolvable owner): assigned to the Administrator's firmId.
 * 3. Partitions the records by firmId and saves each firm's slice via saveFirmAppData.
 * 4. Creates an audit log entry summarising the migration.
 * 5. Sets localStorage flag so the migration never runs twice on this device.
 */
export async function runPreIsolationMigration(): Promise<{
  success: boolean;
  message: string;
  firmsUpdated: number;
}> {
  try {
    // ─── Step 1: Fetch FRESH users from canister (never use stale cache) ───
    let freshUsers: User[] = cache.users;
    let freshFirmAccounts: FirmAccount[] = cache.firmAccounts;
    try {
      const freshDb = await loadUserDatabase();
      if (freshDb && Array.isArray(freshDb.users) && freshDb.users.length > 0) {
        freshUsers = freshDb.users;
        cache.users = freshUsers;
        lsSet(KEYS.users, freshUsers);
      }
      if (
        freshDb &&
        Array.isArray(freshDb.firmAccounts) &&
        freshDb.firmAccounts.length > 0
      ) {
        freshFirmAccounts = freshDb.firmAccounts;
        cache.firmAccounts = freshFirmAccounts;
        lsSet(KEYS.firmAccounts, freshFirmAccounts);
      }
    } catch (_) {}

    // Load global (legacy) canister data blob
    const globalData = await loadGlobalAppData();
    if (!globalData) {
      localStorage.setItem(MIGRATION_FLAG_V84, "done");
      return {
        success: true,
        message: "No legacy data found — migration skipped.",
        firmsUpdated: 0,
      };
    }

    const users = freshUsers;
    const firmAccounts = freshFirmAccounts;

    // Build a map: userId -> firmId  AND email -> firmId (from FRESH users)
    const userFirmMap = new Map<string, string>();
    for (const u of users) {
      if (u.role === "Super Admin") continue;
      if (u.role === "Owner") {
        userFirmMap.set(u.id, u.firmId ?? u.id);
      } else if (u.role === "Staff") {
        const ownerId = (u as any).firmOwnerId;
        if (ownerId) userFirmMap.set(u.id, ownerId);
      }
    }

    // Also map by email for records that store createdBy as email
    const emailFirmMap = new Map<string, string>();
    for (const u of users) {
      if (u.role === "Owner" && u.email) {
        emailFirmMap.set(u.email.toLowerCase(), u.firmId ?? u.id);
      }
    }

    // Find the first (TaxCore_001) non-admin firm as fallback for orphaned records
    const firstFirmAccount = firmAccounts
      .filter((fa) => fa.firmNumber)
      .sort((a, b) => {
        const aSeq = Number.parseInt(
          (a.firmNumber ?? "").replace("TaxCore_", "") || "999",
          10,
        );
        const bSeq = Number.parseInt(
          (b.firmNumber ?? "").replace("TaxCore_", "") || "999",
          10,
        );
        return aSeq - bSeq;
      })[0];
    const firstFirmOwner = firstFirmAccount
      ? users.find(
          (u) =>
            u.role === "Owner" &&
            u.email?.toLowerCase() === firstFirmAccount.email?.toLowerCase(),
        )
      : null;
    const firstFirmId = firstFirmOwner?.firmId ?? firstFirmOwner?.id ?? null;

    // Administrator firmId — only used when no firm can be found at all
    const adminUser = users.find((u) => u.role === "Super Admin");
    const adminFirmId = adminUser?.id ?? "__admin__";

    // Helper: resolve firmId from a record's createdBy field
    // Fallback: first firm (TaxCore_001), NOT admin, so data remains visible
    const resolveFirmId = (createdBy?: string): string => {
      if (!createdBy) return firstFirmId ?? adminFirmId;
      // Try direct userId match
      const byId = userFirmMap.get(createdBy);
      if (byId) return byId;
      // Try email match
      const byEmail = emailFirmMap.get(createdBy.toLowerCase());
      if (byEmail) return byEmail;
      // Partial email domain match
      if (createdBy.includes("@")) {
        const domain = createdBy.split("@")[1]?.toLowerCase();
        if (domain) {
          for (const [key, val] of emailFirmMap) {
            if (key.split("@")[1]?.toLowerCase() === domain) return val;
          }
        }
      }
      // Orphan — assign to first firm so data is visible, not lost in admin
      return firstFirmId ?? adminFirmId;
    };

    // Collect all records, stamp firmId where missing
    type RecordWithFirm = { firmId?: string; createdBy?: string };
    const stampRecords = <T extends RecordWithFirm>(items: T[]): T[] =>
      items.map((item) => ({
        ...item,
        firmId: item.firmId ?? resolveFirmId(item.createdBy),
      }));

    const allClients = stampRecords(
      globalData.clients ?? [],
    ) as ((typeof globalData.clients)[0] & { firmId: string })[];
    const allDocuments = stampRecords(
      globalData.documents ?? [],
    ) as ((typeof globalData.documents)[0] & { firmId: string })[];
    const allWork = stampRecords(
      globalData.work ?? [],
    ) as ((typeof globalData.work)[0] & { firmId: string })[];
    const allBilling = stampRecords(
      globalData.billing ?? [],
    ) as ((typeof globalData.billing)[0] & { firmId: string })[];
    const allAuditLogs = stampRecords(
      globalData.auditLogs ?? [],
    ) as ((typeof globalData.auditLogs)[0] & { firmId: string })[];

    // Collect unique firmIds across all records
    const firmIds = new Set<string>();
    for (const r of [
      ...allClients,
      ...allDocuments,
      ...allWork,
      ...allBilling,
      ...allAuditLogs,
    ]) {
      if (r.firmId) firmIds.add(r.firmId);
    }
    // Also include all known Owner firmIds even if they have zero records
    for (const fa of firmAccounts) {
      const ownerUser = users.find(
        (u) =>
          u.role === "Owner" &&
          u.email?.toLowerCase() === fa.email?.toLowerCase(),
      );
      if (ownerUser) firmIds.add(ownerUser.firmId ?? ownerUser.id);
    }

    let firmsUpdated = 0;
    const migrationLog: string[] = [];

    for (const firmId of firmIds) {
      // Skip pure admin firmId — admin has no app data
      if (firmId === adminFirmId && firmId === "__admin__") continue;

      const ownerUser = users.find(
        (u) => u.role === "Owner" && (u.firmId === firmId || u.id === firmId),
      );
      const role = ownerUser ? "Owner" : "Super Admin";

      // Load existing firm data to avoid overwriting newer records
      let existingFirmData: any = {};
      try {
        const existing = await loadFirmAppData(firmId, role);
        if (existing) existingFirmData = existing as any;
      } catch (_) {}

      // Merge: existing firm data + newly mapped records (deduplicated)
      const existingClientKeys = new Set(
        (existingFirmData.clients ?? []).map(
          (c: any) => `${c.pan}|${c.taxYear}|${c.returnType ?? ""}`,
        ),
      );
      const existingWorkKeys = new Set(
        (existingFirmData.work ?? []).map(
          (w: any) => `${w.clientId}|${w.taxYear}`,
        ),
      );
      const existingDocKeys = new Set(
        (existingFirmData.documents ?? []).map(
          (d: any) => `${d.clientId}|${d.taxYear}|${d.documentName ?? d.id}`,
        ),
      );
      const existingBillingIds = new Set(
        (existingFirmData.billing ?? []).map((b: any) => b.id),
      );

      const newClients = allClients
        .filter((r) => r.firmId === firmId)
        .filter(
          (c) =>
            !existingClientKeys.has(
              `${c.pan}|${c.taxYear}|${(c as any).returnType ?? ""}`,
            ),
        );
      const newDocs = allDocuments
        .filter((r) => r.firmId === firmId)
        .filter(
          (d) =>
            !existingDocKeys.has(
              `${d.clientId}|${(d as any).taxYear ?? ""}|${(d as any).documentName ?? d.id}`,
            ),
        );
      const newWork = allWork
        .filter((r) => r.firmId === firmId)
        .filter((w) => !existingWorkKeys.has(`${w.clientId}|${w.taxYear}`));
      const newBilling = allBilling
        .filter((r) => r.firmId === firmId)
        .filter((b) => !existingBillingIds.has(b.id));
      const newAuditLogs = allAuditLogs.filter((r) => r.firmId === firmId);

      const firmData = {
        clients: [
          ...(existingFirmData.clients ?? []).map((c: any) => ({
            ...c,
            firmId,
          })),
          ...newClients,
        ],
        documents: [
          ...(existingFirmData.documents ?? []).map((d: any) => ({
            ...d,
            firmId,
          })),
          ...newDocs,
        ],
        work: [
          ...(existingFirmData.work ?? []).map((w: any) => ({ ...w, firmId })),
          ...newWork,
        ],
        billing: [
          ...(existingFirmData.billing ?? []).map((b: any) => ({
            ...b,
            firmId,
          })),
          ...newBilling,
        ],
        auditLogs: [...(existingFirmData.auditLogs ?? []), ...newAuditLogs],
        importHistory:
          existingFirmData.importHistory ?? globalData.importHistory ?? [],
        deletedClientIds:
          existingFirmData.deletedClientIds ??
          (globalData as typeof globalData & { deletedClientIds?: string[] })
            .deletedClientIds ??
          [],
        dataVersion:
          existingFirmData.dataVersion ??
          (globalData as typeof globalData & { dataVersion?: number })
            .dataVersion ??
          0,
      };

      await saveFirmAppData(firmId, role, firmData);

      migrationLog.push(
        `Firm ${firmId}: ${firmData.clients.length} clients (${newClients.length} new), ${firmData.work.length} work records`,
      );
      firmsUpdated++;
    }

    // Create audit log entry for migration
    const migrationEntry = {
      id: uid(),
      userId: "system",
      userName: "System",
      userRole: "Super Admin" as const,
      action: "System Migration v84",
      clientId: "",
      clientName: "",
      fieldChanged: "firmId",
      oldValue: "",
      newValue: `${firmsUpdated} firm(s) updated`,
      timestamp: new Date().toISOString(),
      firmId: adminFirmId,
    };
    cache.auditLogs.unshift(migrationEntry);
    if (cache.auditLogs.length > 1000)
      cache.auditLogs = cache.auditLogs.slice(0, 1000);
    lsSet(KEYS.auditLogs, cache.auditLogs);

    // Mark migration as done on this device
    localStorage.setItem(MIGRATION_FLAG_V84, "done");

    return {
      success: true,
      message: `Migration complete. ${firmsUpdated} firm(s) updated. Log: ${migrationLog.join("; ")}`,
      firmsUpdated,
    };
  } catch (err) {
    console.error("[storage] runPreIsolationMigration failed:", err);
    return {
      success: false,
      message: `Migration failed: ${err instanceof Error ? err.message : String(err)}`,
      firmsUpdated: 0,
    };
  }
}

// ─── Main initialize function ──────────────────────────────────────────────────

/**
 * Loads all data from the ICP canister into memory.
 * Falls back gracefully to localStorage data if canister is unavailable.
 * Call once on app startup. Returns immediately if already called.
 */
export async function initialize(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // First load localStorage so we have something immediately
    loadCacheFromLocalStorage();

    try {
      // Load all data from canister — use firm-scoped endpoint when a user is already cached
      const initFirmId = getCurrentFirmId();
      const initRole = getCurrentRole();
      const canisterData = await loadAllFromCanister(
        initFirmId ?? undefined,
        initRole,
      );

      // ─ User database ─
      if (canisterData.userDb) {
        const udb = canisterData.userDb;
        // Always trust canister for users — canister is the authoritative source.
        // Even if canister returns an empty array, that might mean no users yet (new deployment).
        // However, we preserve local users if canister is empty AND we have local users
        // (guards against bgSync race where canister write hasn't completed yet).
        if (udb.users !== undefined) {
          if (udb.users.length > 0) {
            // Canister has users — always use them
            cache.users = udb.users;
            lsSet(KEYS.users, cache.users);
          }
          // If canister returns empty but local has users, keep local (bgSync not completed yet)
        }
        if (udb.firmAccounts !== undefined) {
          if (udb.firmAccounts.length > 0) {
            cache.firmAccounts = udb.firmAccounts;
            lsSet(KEYS.firmAccounts, cache.firmAccounts);
          }
        }
        // superAdminCreated flag: ALWAYS sync from canister regardless of users array length.
        // This is the critical fix: the flag must propagate even when users array guard fires.
        if (udb.superAdminCreated === true) {
          cache.superAdminCreated = true;
          localStorage.setItem(KEYS.superAdminCreated, "true");
        }
        if (udb.whatsAppSettings) {
          cache.whatsappSettings = udb.whatsAppSettings ?? null;
          if (cache.whatsappSettings) {
            localStorage.setItem(
              KEYS.whatsappSettings,
              JSON.stringify(cache.whatsappSettings),
            );
          }
        }
      }

      // Derive superAdminCreated from users array as a safety net
      // (handles cases where flag wasn't set but admin user exists)
      const hasAdmin = cache.users.some((u) => u.role === "Super Admin");
      if (hasAdmin) {
        cache.superAdminCreated = true;
        localStorage.setItem(KEYS.superAdminCreated, "true");
      }

      // ─ App data (firm-scoped filter) ─
      // Only load records that belong to this firm, or have no firmId (legacy/migrated).
      const currentFirmId = getCurrentFirmId();
      const firmFilter = <T extends { firmId?: string }>(items: T[]): T[] => {
        if (!currentFirmId) return items; // Admin or unscoped: load all
        return items.filter(
          (item) => !item.firmId || item.firmId === currentFirmId,
        );
      };

      if (canisterData.clients.length > 0) {
        cache.clients = firmFilter(canisterData.clients);
        lsSet(KEYS.clients, cache.clients);
      }
      if (canisterData.documents.length > 0) {
        cache.documents = firmFilter(canisterData.documents);
        lsSet(KEYS.documents, cache.documents);
      }
      if (canisterData.work.length > 0) {
        cache.work = firmFilter(canisterData.work);
        lsSet(KEYS.work, cache.work);
      }
      if (canisterData.billing.length > 0) {
        cache.billing = firmFilter(canisterData.billing);
        lsSet(KEYS.billing, cache.billing);
      }
      if (canisterData.auditLogs.length > 0) {
        const currentFirmId2 = getCurrentFirmId();
        const firmLogs = currentFirmId2
          ? canisterData.auditLogs.filter(
              (l) => !l.firmId || l.firmId === currentFirmId2,
            )
          : canisterData.auditLogs;
        const canisterIds = new Set(firmLogs.map((l) => l.id));
        const localOnly = cache.auditLogs.filter((l) => !canisterIds.has(l.id));
        const merged = [...firmLogs, ...localOnly];
        merged.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        cache.auditLogs = merged.slice(0, 1000);
        lsSet(KEYS.auditLogs, cache.auditLogs);
      }
      if (
        Array.isArray(canisterData.importHistory) &&
        canisterData.importHistory.length > 0
      ) {
        cache.importHistory = canisterData.importHistory;
        lsSet(KEYS.importHistory, cache.importHistory);
      }

      lastSyncTime = new Date();
      console.log("[storage] Initialized from canister:", {
        users: cache.users.length,
        clients: cache.clients.length,
        superAdminCreated: cache.superAdminCreated,
      });
    } catch (err) {
      console.warn(
        "[storage] Canister load failed, using localStorage cache:",
        err,
      );
    }

    // Backfill firmNumbers for existing firms that pre-date sequential numbering
    backfillFirmNumbers();

    const _currUser: any =
      typeof (storage as any).getCurrentUser === "function"
        ? (storage as any).getCurrentUser()
        : JSON.parse(localStorage.getItem("taxcore_currentUser") || "null");
    // Always run firm data recovery on every init (no flag guard) so any
    // admin login auto-assigns all untagged records to their correct firm.
    clearMigrationFlag();
    runFirmDataRecovery().catch(() => {});

    isInitialized = true;
    dispatchChange("init");
  })();

  return initPromise;
}

/**
 * Returns a promise that resolves when storage is fully initialized from canister.
 */
export async function whenInitialized(): Promise<void> {
  if (isInitialized) return;
  return initialize();
}

/**
 * Forces a fresh reload from the canister, replacing cached data.
 */
export async function refreshFromCanister(): Promise<void> {
  initPromise = null;
  isInitialized = false;
  return initialize();
}

/**
 * Silently polls the canister for fresh data without resetting initPromise.
 * Called every 5 seconds while the user is logged in.
 * Uses firm-scoped endpoint so only this firm's data is loaded.
 */
export async function silentRefreshFromCanister(): Promise<void> {
  try {
    const firmId = getCurrentFirmId();
    const role = getCurrentRole();
    const canisterData = await loadAllFromCanister(firmId ?? undefined, role);
    let changed = false;

    if (canisterData.userDb) {
      const udb = canisterData.userDb;
      // Always trust canister user data (handles deletions/additions on other devices).
      // CRITICAL: Update users if canister has users. If canister returns empty, preserve
      // local users (guards bgSync race: local write may not have reached canister yet).
      if (udb.users !== undefined) {
        const prev = JSON.stringify(cache.users);
        if (udb.users.length > 0) {
          // Canister has real data — always use it
          cache.users = udb.users;
          lsSet(KEYS.users, cache.users);
        }
        // If canister empty + local has users: keep local (bgSync not yet committed)
        if (JSON.stringify(cache.users) !== prev) changed = true;
      }
      if (udb.firmAccounts !== undefined) {
        const prev = JSON.stringify(cache.firmAccounts);
        if (udb.firmAccounts.length > 0) {
          cache.firmAccounts = udb.firmAccounts;
          lsSet(KEYS.firmAccounts, cache.firmAccounts);
        }
        if (JSON.stringify(cache.firmAccounts) !== prev) changed = true;
      }
      // CRITICAL FIX: Always sync superAdminCreated flag from canister,
      // even when users array is empty or guard didn't fire.
      // This ensures new browsers see login (not setup) as soon as canister has the flag.
      if (udb.superAdminCreated === true) {
        cache.superAdminCreated = true;
        localStorage.setItem(KEYS.superAdminCreated, "true");
      }
    }

    // Derive superAdminCreated from users array as backup safety net
    if (cache.users.some((u) => u.role === "Super Admin")) {
      cache.superAdminCreated = true;
      localStorage.setItem(KEYS.superAdminCreated, "true");
    }

    // WRITE-LOCK GUARD (extended to ALL app data arrays):
    // If any canister write is in-flight (forceSyncToCanister or bgSync running),
    // skip overwriting ANY local cache array from the poll.
    // The local in-memory+localStorage state IS the authoritative state during a write
    // window — we must not let a stale canister read race back and overwrite it.
    if (_canisterWriteInFlight) {
      // Still update the sync timestamp so the UI doesn't show stale time
      lastSyncTime = new Date();
      if (changed) dispatchChange("refresh");
      return;
    }

    // Always trust canister app data as the authoritative source.
    // IMPORTANT: treat an empty canister array as valid (handles deletions from other devices).
    // Only skip update if canisterData array is undefined/null (parse failure), not when it's empty.

    // TOMBSTONE FILTER + FIRM SCOPE: merge tombstones from canister, strip tombstoned/cross-firm clients.
    const syncFirmId = getCurrentFirmId();
    const prevClients = JSON.stringify(cache.clients);
    if (Array.isArray(canisterData.clients)) {
      const canisterDeletedIds: string[] = Array.isArray(
        canisterData.deletedClientIds,
      )
        ? canisterData.deletedClientIds
        : [];
      // Union of local + canister-reported tombstones
      tombstoneDeletedClients(canisterDeletedIds);
      const tombstoneSet = new Set(cache.deletedClientIds);
      cache.clients = canisterData.clients.filter(
        (c) =>
          !tombstoneSet.has(c.id) &&
          (!syncFirmId || !c.firmId || c.firmId === syncFirmId),
      );
      lsSet(KEYS.clients, cache.clients);
    }
    if (JSON.stringify(cache.clients) !== prevClients) changed = true;

    const prevDocs = JSON.stringify(cache.documents);
    if (Array.isArray(canisterData.documents)) {
      cache.documents = syncFirmId
        ? canisterData.documents.filter(
            (d) => !d.firmId || d.firmId === syncFirmId,
          )
        : canisterData.documents;
      lsSet(KEYS.documents, cache.documents);
    }
    if (JSON.stringify(cache.documents) !== prevDocs) changed = true;

    const prevWork = JSON.stringify(cache.work);
    if (Array.isArray(canisterData.work)) {
      cache.work = syncFirmId
        ? canisterData.work.filter((w) => !w.firmId || w.firmId === syncFirmId)
        : canisterData.work;
      lsSet(KEYS.work, cache.work);
    }
    if (JSON.stringify(cache.work) !== prevWork) changed = true;

    const prevBilling = JSON.stringify(cache.billing);
    if (Array.isArray(canisterData.billing)) {
      cache.billing = syncFirmId
        ? canisterData.billing.filter(
            (b) => !b.firmId || b.firmId === syncFirmId,
          )
        : canisterData.billing;
      lsSet(KEYS.billing, cache.billing);
    }
    if (JSON.stringify(cache.billing) !== prevBilling) changed = true;

    const prevLogs = JSON.stringify(cache.auditLogs);
    // For auditLogs, ONLY update from canister if canister has MORE entries.
    // An empty canister auditLogs could mean bgSync hasn't committed yet — never wipe local.
    const firmScopedLogs = syncFirmId
      ? canisterData.auditLogs.filter(
          (l) => !l.firmId || l.firmId === syncFirmId,
        )
      : canisterData.auditLogs;
    if (firmScopedLogs.length > cache.auditLogs.length) {
      // Canister has more entries — merge: canister is authoritative, preserve local-only unsync'd entries
      const canisterIds = new Set(firmScopedLogs.map((l) => l.id));
      const localOnly = cache.auditLogs.filter((l) => !canisterIds.has(l.id));
      const merged = [...firmScopedLogs, ...localOnly];
      // Sort by timestamp descending, cap at 1000 entries
      merged.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      cache.auditLogs = merged.slice(0, 1000);
    } else if (firmScopedLogs.length > 0) {
      // Canister has same or fewer entries — still merge to catch any canister-only entries
      const canisterIds = new Set(firmScopedLogs.map((l) => l.id));
      const localOnly = cache.auditLogs.filter((l) => !canisterIds.has(l.id));
      const merged = [...firmScopedLogs, ...localOnly];
      merged.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      cache.auditLogs = merged.slice(0, 1000);
    }
    // If canister returned empty (firmScopedLogs.length === 0), do NOT wipe local cache
    lsSet(KEYS.auditLogs, cache.auditLogs);
    if (JSON.stringify(cache.auditLogs) !== prevLogs) changed = true;

    // Sync importHistory from canister
    // For importHistory, ONLY update from canister if canister has MORE entries.
    // An empty canister importHistory could mean bgSync hasn't committed yet — never wipe local.
    const canisterImportHistory = canisterData.importHistory;
    if (Array.isArray(canisterImportHistory)) {
      const prevImportHistory = JSON.stringify(cache.importHistory);
      if (canisterImportHistory.length > cache.importHistory.length) {
        // Canister has more — merge
        const canisterIhIds = new Set(canisterImportHistory.map((e) => e.id));
        const localOnlyIh = cache.importHistory.filter(
          (e) => !canisterIhIds.has(e.id),
        );
        cache.importHistory = [...canisterImportHistory, ...localOnlyIh];
        lsSet(KEYS.importHistory, cache.importHistory);
        if (JSON.stringify(cache.importHistory) !== prevImportHistory)
          changed = true;
      } else if (canisterImportHistory.length > 0) {
        // Same or fewer — still merge to catch canister-only entries
        const canisterIhIds = new Set(canisterImportHistory.map((e) => e.id));
        const localOnlyIh = cache.importHistory.filter(
          (e) => !canisterIhIds.has(e.id),
        );
        cache.importHistory = [...canisterImportHistory, ...localOnlyIh];
        lsSet(KEYS.importHistory, cache.importHistory);
        if (JSON.stringify(cache.importHistory) !== prevImportHistory)
          changed = true;
      }
      // If canister returned empty importHistory, do NOT wipe local cache
    }

    if (changed) {
      lastSyncTime = new Date();
      dispatchChange("refresh");
    } else {
      // Always update lastSyncTime even when unchanged
      lastSyncTime = new Date();
    }
  } catch (err) {
    console.warn("[storage] silentRefresh failed:", err);
  }
}

// ─── Storage API ───────────────────────────────────────────────────────────────

export const storage = {
  uid,

  // ─── Users ────────────────────────────────────────────────────────────

  getUsers: (): User[] => cache.users,

  saveUsers: (users: User[]): void => {
    cache.users = users;
    lsSet(KEYS.users, users);
    const hasSA = users.some((u) => u.role === "Super Admin");
    if (hasSA) {
      cache.superAdminCreated = true;
      localStorage.setItem(KEYS.superAdminCreated, "true");
    }
    dispatchChange(KEYS.users);
    bgSync(async () => {
      await saveUserDatabase(buildUserDbSnapshot());
    }, "userDb");
  },

  getCurrentUser: (): User | null => {
    try {
      return JSON.parse(localStorage.getItem(KEYS.currentUser) || "null");
    } catch {
      return null;
    }
  },

  setCurrentUser: (user: User | null): void => {
    if (user) localStorage.setItem(KEYS.currentUser, JSON.stringify(user));
    else localStorage.removeItem(KEYS.currentUser);
  },

  // ─── Super Admin flag ─────────────────────────────────────────────────

  isSuperAdminCreated: (): boolean => {
    return (
      cache.superAdminCreated ||
      cache.users.some((u) => u.role === "Super Admin")
    );
  },

  markSuperAdminCreated: (): void => {
    cache.superAdminCreated = true;
    localStorage.setItem(KEYS.superAdminCreated, "true");
    bgSync(async () => {
      await saveUserDatabase(buildUserDbSnapshot());
    }, "userDb");
  },

  // ─── Firm Accounts ────────────────────────────────────────────────────

  getFirmAccounts: (): FirmAccount[] => cache.firmAccounts,

  saveFirmAccounts: (accounts: FirmAccount[]): void => {
    cache.firmAccounts = accounts;
    lsSet(KEYS.firmAccounts, accounts);
    dispatchChange(KEYS.firmAccounts);
    bgSync(async () => {
      await saveUserDatabase(buildUserDbSnapshot());
    }, "userDb");
  },

  /**
   * Updates lastLogin timestamp for the FirmAccount belonging to the given owner ID.
   * For Staff users, pass their firmOwnerId. For Owner users, pass their own id.
   */
  updateFirmLastLogin: (firmOwnerId: string): void => {
    // Find the owner user to match their email → firm account
    const ownerUser = cache.users.find(
      (u) => u.id === firmOwnerId && u.role === "Owner",
    );
    if (!ownerUser) return;

    const updated = cache.firmAccounts.map((f) =>
      f.email.toLowerCase() === ownerUser.email.toLowerCase()
        ? { ...f, lastLogin: new Date().toISOString() }
        : f,
    );
    cache.firmAccounts = updated;
    lsSet(KEYS.firmAccounts, updated);
    dispatchChange(KEYS.firmAccounts);
    bgSync(async () => {
      await saveUserDatabase(buildUserDbSnapshot());
    }, "userDb");
  },

  // ─── Clients ─────────────────────────────────────────────────────────────

  getClients: (): Client[] => cache.clients,

  saveClients: (clients: Client[]): void => {
    const firmId = getCurrentFirmId();
    // Stamp firmId on all clients missing it
    const stamped = clients.map((c) =>
      c.firmId ? c : { ...c, firmId: firmId ?? undefined },
    );
    cache.clients = stamped;
    lsSet(KEYS.clients, stamped);
    dispatchChange(KEYS.clients);
    bgSyncAppData();
  },

  // ─── Documents ───────────────────────────────────────────────────────────

  getDocuments: (): DocumentInward[] => cache.documents,

  saveDocuments: (docs: DocumentInward[]): void => {
    const firmId = getCurrentFirmId();
    const stamped = docs.map((d) =>
      d.firmId ? d : { ...d, firmId: firmId ?? undefined },
    );
    cache.documents = stamped;
    lsSet(KEYS.documents, stamped);
    dispatchChange(KEYS.documents);
    bgSyncAppData();
  },

  // ─── Work Processing ─────────────────────────────────────────────────────

  getWork: (): WorkProcessing[] => cache.work,

  saveWork: (work: WorkProcessing[]): void => {
    const firmId = getCurrentFirmId();
    const stamped = work.map((w) =>
      w.firmId ? w : { ...w, firmId: firmId ?? undefined },
    );
    cache.work = stamped;
    lsSet(KEYS.work, stamped);
    dispatchChange(KEYS.work);
    bgSyncAppData();
  },

  // ─── Billing ─────────────────────────────────────────────────────────────

  getBilling: (): Billing[] => cache.billing,

  saveBilling: (billing: Billing[]): void => {
    const firmId = getCurrentFirmId();
    const stamped = billing.map((b) =>
      b.firmId ? b : { ...b, firmId: firmId ?? undefined },
    );
    cache.billing = stamped;
    lsSet(KEYS.billing, stamped);
    dispatchChange(KEYS.billing);
    bgSyncAppData();
  },

  // ─── Audit Logs ───────────────────────────────────────────────────────────

  getAuditLogs: (): AuditLogEntry[] => cache.auditLogs,

  addAuditLog: (entry: AuditLogEntry): void => {
    const firmId = getCurrentFirmId();
    // Ensure unique id and stamp firmId on every audit entry
    const safeEntry: AuditLogEntry = {
      ...(entry.id ? entry : { ...entry, id: uid() }),
      firmId: entry.firmId ?? firmId ?? undefined,
    };
    cache.auditLogs.unshift(safeEntry); // newest first
    if (cache.auditLogs.length > 1000)
      cache.auditLogs = cache.auditLogs.slice(0, 1000);
    lsSet(KEYS.auditLogs, cache.auditLogs);
    dispatchChange(KEYS.auditLogs);
    bgSyncAppData();
  },

  clearAuditLogs: (): void => {
    cache.auditLogs = [];
    lsSet(KEYS.auditLogs, []);
    dispatchChange(KEYS.auditLogs);
    bgSyncAppData();
  },

  // ─── WhatsApp Settings ───────────────────────────────────────────────────

  getWhatsAppSettings: (): WhatsAppSettings | null => cache.whatsappSettings,

  saveWhatsAppSettings: (settings: WhatsAppSettings): void => {
    cache.whatsappSettings = settings;
    localStorage.setItem(KEYS.whatsappSettings, JSON.stringify(settings));
    dispatchChange(KEYS.whatsappSettings);
    bgSync(async () => {
      await saveUserDatabase(buildUserDbSnapshot());
    }, "userDb");
  },

  // ─── Import History ───────────────────────────────────────────────────────

  getImportHistory: (): ImportHistoryEntry[] => cache.importHistory,

  saveImportHistory: (entry: ImportHistoryEntry): void => {
    cache.importHistory.push(entry);
    lsSet(KEYS.importHistory, cache.importHistory);
    dispatchChange(KEYS.importHistory);
    bgSyncAppData();
  },

  // ─── Notification Logs ───────────────────────────────────────────────────

  getNotificationLogs: (): NotificationLog[] => cache.notificationLogs,

  addNotificationLog: (entry: NotificationLog): void => {
    cache.notificationLogs.push(entry);
    lsSet(KEYS.notificationLogs, cache.notificationLogs);
    dispatchChange(KEYS.notificationLogs);
  },

  clearNotificationLogs: (): void => {
    cache.notificationLogs = [];
    lsSet(KEYS.notificationLogs, []);
    dispatchChange(KEYS.notificationLogs);
  },

  getMigrationStatus,
  runPreIsolationMigration,
  getRecoveryStatus,
  runFirmDataRecovery,
};

/** Save an import history entry to storage (persists to canister immediately — awaited). */
export async function saveImportHistory(
  entry: ImportHistoryEntry,
): Promise<void> {
  cache.importHistory.push(entry);
  lsSet(KEYS.importHistory, cache.importHistory);
  dispatchChange(KEYS.importHistory);
  // Awaited firm-scoped canister write for cross-device visibility
  const firmId = getCurrentFirmId();
  const role = getCurrentRole();
  const snapshot = buildAppDataSnapshot();
  if (firmId) {
    await saveFirmAppData(firmId, role, snapshot);
  } else {
    await saveAppData(snapshot);
  }
  // Also sync userDb in parallel to keep both blobs consistent
  saveUserDatabase(buildUserDbSnapshot()).catch(() => {});
}

/** Get all import history entries from storage. */
export function getImportHistory(): ImportHistoryEntry[] {
  return cache.importHistory;
}

/** Subscribe to any storage write. Returns an unsubscribe function. */
export function onStorageChange(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("taxcore-storage-change", handler);
  return () => window.removeEventListener("taxcore-storage-change", handler);
}

export function getPanCategory(pan: string): string {
  if (!pan || pan.length < 4) return "Other";
  const ch = pan[3].toUpperCase();
  const map: Record<string, string> = {
    P: "Individual",
    F: "Firm",
    C: "Company",
    A: "AOP",
    B: "BOI",
    G: "Government",
    H: "HUF",
    J: "AJP",
    L: "Local Authority",
    T: "Trust",
  };
  return map[ch] || "Other";
}

export function parseDDMMYYYY(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function getDaysUntilDue(dueDate: string): number | null {
  const due = parseDDMMYYYY(dueDate);
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getLatestDocStatus(clientId: string): string {
  const docs = storage.getDocuments().filter((d) => d.clientId === clientId);
  if (!docs.length) return "-";
  docs.sort((a, b) => {
    const da = parseDDMMYYYY(a.date)?.getTime() || 0;
    const db = parseDDMMYYYY(b.date)?.getTime() || 0;
    return db - da;
  });
  return docs[0].status;
}

export function getLatestDoc(clientId: string) {
  const docs = storage.getDocuments().filter((d) => d.clientId === clientId);
  if (!docs.length) return null;
  docs.sort((a, b) => {
    const da = parseDDMMYYYY(a.date)?.getTime() || 0;
    const db = parseDDMMYYYY(b.date)?.getTime() || 0;
    return db - da;
  });
  return docs[0];
}

export function getClientWork(clientId: string): WorkProcessing | null {
  return storage.getWork().find((w) => w.clientId === clientId) || null;
}

export function getClientBilling(clientId: string): Billing | null {
  return storage.getBilling().find((b) => b.clientId === clientId) || null;
}

/**
 * Checks if a client's work record is E-Verified (stop-gate).
 */
export function isClientEVerified(clientId: string): boolean {
  const work = getClientWork(clientId);
  if (!work) return false;
  const fs = work.filingStatus ?? (work.eVerified ? "E-Verified" : "Pending");
  return fs === "E-Verified" || work.eVerified === true;
}

/**
 * Get the effective filing status for a work record.
 */
export function getFilingStatus(
  work: WorkProcessing,
): "Pending" | "Pending for E-verification" | "E-Verified" {
  if (work.filingStatus) return work.filingStatus;
  if (work.eVerified === true) return "E-Verified";
  return "Pending";
}

/**
 * Returns clients with due date <= 10 days AND NOT e-verified.
 */
export function getDueAlertClients(): Array<{
  client: Client;
  daysLeft: number;
}> {
  const result: Array<{ client: Client; daysLeft: number }> = [];
  for (const c of storage.getClients()) {
    if (isClientEVerified(c.id)) continue;
    const daysLeft = getDaysUntilDue(c.dueDate);
    if (daysLeft !== null && daysLeft <= 10) {
      result.push({ client: c, daysLeft });
    }
  }
  return result.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Enhanced deadline alert function with role-based scoping and urgency tiers.
 */
export function getDeadlineAlertClients(
  userId: string,
  userRole: string,
): Array<{
  client: Client;
  daysLeft: number;
  urgency: "red" | "amber" | "yellow";
  workStatus: string;
}> {
  const allClients = storage.getClients();

  const scopedClients =
    userRole === "Staff"
      ? allClients.filter((c) => c.createdBy === userId)
      : allClients;

  const result: Array<{
    client: Client;
    daysLeft: number;
    urgency: "red" | "amber" | "yellow";
    workStatus: string;
  }> = [];

  for (const c of scopedClients) {
    if (isClientEVerified(c.id)) continue;
    const daysLeft = getDaysUntilDue(c.dueDate);
    if (daysLeft === null || daysLeft > 10) continue;
    const work = getClientWork(c.id);
    const urgency: "red" | "amber" | "yellow" =
      daysLeft < 0 ? "yellow" : daysLeft <= 5 ? "red" : "amber";
    result.push({
      client: c,
      daysLeft,
      urgency,
      workStatus: work?.status || "Pending",
    });
  }

  return result.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Returns work records with filing status 'Pending for E-verification'.
 */
export function getEVerificationAlerts(): Array<{
  client: Client;
  work: WorkProcessing;
  daysToDeadline: number;
  urgency: "high" | "normal";
}> {
  const allWork = storage.getWork();
  const allClients = storage.getClients();
  const result: Array<{
    client: Client;
    work: WorkProcessing;
    daysToDeadline: number;
    urgency: "high" | "normal";
  }> = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const w of allWork) {
    const fs = getFilingStatus(w);
    if (fs !== "Pending for E-verification") continue;
    if (!w.filingDate) continue;
    const filingDt = parseDDMMYYYY(w.filingDate);
    if (!filingDt) continue;
    const deadline = new Date(filingDt.getTime() + 30 * 24 * 60 * 60 * 1000);
    deadline.setHours(0, 0, 0, 0);
    const daysToDeadline = Math.floor(
      (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysToDeadline > 30) continue;
    const client = allClients.find((c) => c.id === w.clientId);
    if (!client) continue;
    result.push({
      client,
      work: w,
      daysToDeadline,
      urgency: daysToDeadline < 10 ? "high" : "normal",
    });
  }

  return result.sort((a, b) => a.daysToDeadline - b.daysToDeadline);
}

/**
 * Queue due date notifications for all at-risk clients.
 */
export function queueDueDateNotifications(_currentUser: {
  id: string;
  name: string;
}): number {
  const alertClients = getDueAlertClients();
  const existingLogs = storage.getNotificationLogs();

  let queued = 0;
  for (const { client, daysLeft } of alertClients) {
    const alreadyPending = existingLogs.some(
      (l) =>
        l.clientId === client.id &&
        l.event === "Due Date Alert" &&
        l.status === "Pending",
    );
    if (alreadyPending) continue;

    const message =
      daysLeft <= 0
        ? `Dear ${client.name}, your ITR due date (${client.dueDate}) has passed. Please contact us immediately.`
        : `Dear ${client.name}, your ITR due date is ${client.dueDate} \u2014 only ${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining. Please submit documents at the earliest.`;

    storage.addNotificationLog({
      id: storage.uid(),
      clientId: client.id,
      clientName: client.name,
      mobile: client.mobile,
      message,
      event: "Due Date Alert",
      status: "Pending",
      timestamp: new Date().toISOString(),
    });
    queued++;
  }
  return queued;
}

// Seed sample data only - no hardcoded users
export function seedData() {
  const users = storage.getUsers();
  const ownerUser = users.find((u) => u.role === "Owner");
  if (!ownerUser) return;
  if (storage.getClients().length > 0) return;

  const c1: Client = {
    id: "c1",
    name: "Rajesh Kumar",
    pan: "ABCPK1234F",
    mobile: "9876543210",
    email: "rajesh@example.com",
    clientType: "Existing",
    headOfIncome: "Salaried",
    businessName: "",
    taxYear: "2024-2025",
    dueDate: "31-07-2025",
    clientCategory: "Individual",
    createdAt: new Date().toISOString(),
    createdBy: ownerUser.id,
  };
  const c2: Client = {
    id: "c2",
    name: "Sharma & Co.",
    pan: "BCQFS5678G",
    mobile: "8765432109",
    email: "sharma@example.com",
    clientType: "Existing",
    headOfIncome: "Business",
    businessName: "Sharma Traders",
    taxYear: "2024-2025",
    dueDate: "31-10-2025",
    clientCategory: "Firm",
    createdAt: new Date().toISOString(),
    createdBy: ownerUser.id,
  };
  storage.saveClients([c1, c2]);

  const work: WorkProcessing[] = [
    {
      id: "w1",
      clientId: "c1",
      taxYear: "2024-2025",
      status: "In Progress",
      itrForm: "ITR-1",
      ackNumber: "",
      filingDate: "",
      filingStatus: "Pending",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "w2",
      clientId: "c2",
      taxYear: "2024-2025",
      status: "Pending",
      itrForm: "",
      ackNumber: "",
      filingDate: "",
      filingStatus: "Pending",
      updatedAt: new Date().toISOString(),
    },
  ];
  storage.saveWork(work);

  const docs: DocumentInward[] = [
    {
      id: "d1",
      clientId: "c1",
      date: "01-04-2025",
      mode: "Email",
      status: "Complete",
      remarks: "Form 16 received",
      createdAt: new Date().toISOString(),
    },
  ];
  storage.saveDocuments(docs);

  const billing: Billing[] = [
    {
      id: "b1",
      clientId: "c1",
      taxYear: "2024-2025",
      billAmount: 5000,
      receipt: 2500,
      balance: 2500,
      outwardStatus: "Pending",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "b2",
      clientId: "c2",
      taxYear: "2024-2025",
      billAmount: 8000,
      receipt: 0,
      balance: 8000,
      outwardStatus: "Pending",
      updatedAt: new Date().toISOString(),
    },
  ];
  storage.saveBilling(billing);
}

/**
 * Get head of income for a client with backward compatibility.
 */
export function getHeadOfIncome(client: import("../types").Client): string {
  if (client.headOfIncome) return client.headOfIncome;
  const legacy = (client as any).sourceOfIncome;
  if (legacy === "Salary") return "Salaried";
  if (legacy === "Other") return "Salaried";
  return legacy || "Salaried";
}

// Load cache from localStorage on module import so reads are instant
loadCacheFromLocalStorage();
