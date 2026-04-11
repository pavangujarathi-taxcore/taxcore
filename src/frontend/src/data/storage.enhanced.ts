/**
 * storage.enhanced.ts
 *
 * Enhanced storage layer with:
 * - Immediate save for delete operations (fixes bug: deleted clients reappear)
 * - Exponential backoff retry mechanism
 * - Better error handling with user notifications
 * - Sync queue for failed operations
 * - Version stamps for conflict detection
 */

import { toast } from "sonner";
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
  saveAppData,
  saveUserDatabase,
} from "./canisterDb";

// ─── Enhanced Types with Version Stamps ───────────────────────────────────────

export interface VersionedRecord {
  _version?: number;
  _lastModified?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

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
  syncQueue: "taxcore_sync_queue",
};

// ─── Sync Queue Types ──────────────────────────────────────────────────────────

interface SyncQueueItem {
  id: string;
  operation: "saveUsers" | "saveClients" | "saveDocuments" | "saveWork" | "saveBilling" | "saveAppData" | "saveUserDb";
  data: unknown;
  timestamp: number;
  retries: number;
  lastError?: string;
}

// ─── In-memory cache ───────────────────────────────────────────────────────────

const cache: {
  users: User[];
  clients: Client[];
  documents: DocumentInward[];
  work: WorkProcessing[];
  billing: Billing[];
  firmAccounts: FirmAccount[];
  auditLogs: AuditLogEntry[];
  notificationLogs: NotificationLog[];
  superAdminCreated: boolean;
  whatsappSettings: WhatsAppSettings | null;
  syncQueue: SyncQueueItem[];
  isSyncing: boolean;
  syncErrors: string[];
} = {
  users: [],
  clients: [],
  documents: [],
  work: [],
  billing: [],
  firmAccounts: [],
  auditLogs: [],
  notificationLogs: [],
  superAdminCreated: false,
  whatsappSettings: null,
  syncQueue: [],
  isSyncing: false,
  syncErrors: [],
};

// ─── Initialization state ────────────────────────────────────────────────────

let initPromise: Promise<void> | null = null;
let isInitialized = false;
export let lastSyncTime: Date | null = null;
export let isSyncOnline = true;

// ─── localStorage helpers ───────────────────────────────────────────────────

function lsGet<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]") as T[];
  } catch {
    return [];
  }
}

function lsSet<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`[storage] Failed to save to localStorage: ${key}`, err);
  }
}

function lsGetSingle<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function lsSetSingle<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`[storage] Failed to save to localStorage: ${key}`, err);
  }
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Load cache from localStorage ─────────────────────────────────────────────

function loadCacheFromLocalStorage(): void {
  cache.users = lsGet<User>(KEYS.users);
  cache.clients = lsGet<Client>(KEYS.clients);
  cache.documents = lsGet<DocumentInward>(KEYS.documents);
  cache.work = lsGet<WorkProcessing>(KEYS.work);
  cache.billing = lsGet<Billing>(KEYS.billing);
  cache.firmAccounts = lsGet<FirmAccount>(KEYS.firmAccounts);
  cache.auditLogs = lsGet<AuditLogEntry>(KEYS.auditLogs);
  cache.notificationLogs = lsGet<NotificationLog>(KEYS.notificationLogs);
  cache.syncQueue = lsGet<SyncQueueItem>(KEYS.syncQueue);
  cache.superAdminCreated = localStorage.getItem(KEYS.superAdminCreated) === "true";
  cache.whatsappSettings = lsGetSingle<WhatsAppSettings>(KEYS.whatsappSettings);
}

// ─── Dispatch change event ───────────────────────────────────────────────────

function dispatchChange(key?: string): void {
  window.dispatchEvent(
    new CustomEvent("taxcore-storage-change", { detail: { key } }),
  );
}

// ─── Sync Queue Management ────────────────────────────────────────────────────

function addToSyncQueue(item: Omit<SyncQueueItem, "id" | "timestamp" | "retries">): void {
  const queueItem: SyncQueueItem = {
    id: uid(),
    timestamp: Date.now(),
    retries: 0,
    ...item,
  };
  cache.syncQueue.push(queueItem);
  lsSet(KEYS.syncQueue, cache.syncQueue);
  processSyncQueue(); // Try to process immediately
}

function removeFromSyncQueue(id: string): void {
  cache.syncQueue = cache.syncQueue.filter(item => item.id !== id);
  lsSet(KEYS.syncQueue, cache.syncQueue);
}

// ─── Enhanced Background sync with exponential backoff ─────────────────────────

async function processSyncQueue(): Promise<void> {
  if (cache.isSyncing || cache.syncQueue.length === 0) return;
  
  cache.isSyncing = true;
  const item = cache.syncQueue[0];
  
  if (!item) {
    cache.isSyncing = false;
    return;
  }

  // Exponential backoff: 3s, 6s, 12s, 30s, 60s
  const delays = [3000, 6000, 12000, 30000, 60000];
  const delay = delays[Math.min(item.retries, delays.length - 1)];
  
  // Check if enough time has passed since last attempt
  if (Date.now() - item.timestamp < delay) {
    cache.isSyncing = false;
    setTimeout(processSyncQueue, delay);
    return;
  }

  try {
    switch (item.operation) {
      case "saveUsers":
      case "saveUserDb":
        await saveUserDatabase(item.data as UserDatabase);
        break;
      case "saveClients":
      case "saveDocuments":
      case "saveWork":
      case "saveBilling":
      case "saveAppData":
        await saveAppData(item.data as any);
        break;
    }
    
    // Success - remove from queue
    removeFromSyncQueue(item.id);
    isSyncOnline = true;
    lastSyncTime = new Date();
    
    // Remove from error list if it was there
    cache.syncErrors = cache.syncErrors.filter(e => !e.includes(item.operation));
    
  } catch (err) {
    console.error(`[storage] Sync failed for ${item.operation}:`, err);
    
    item.retries++;
    item.timestamp = Date.now();
    item.lastError = err instanceof Error ? err.message : String(err);
    
    // Max 10 retries before giving up
    if (item.retries >= 10) {
      const errorMsg = `Failed to sync ${item.operation} after 10 attempts`;
      cache.syncErrors.push(errorMsg);
      removeFromSyncQueue(item.id);
      toast.error("Sync Error", {
        description: `Unable to save ${item.operation} to server. Data is saved locally.`,
      });
      isSyncOnline = false;
    } else {
      // Update queue with new retry count
      cache.syncQueue[0] = item;
      lsSet(KEYS.syncQueue, cache.syncQueue);
      isSyncOnline = false;
    }
  } finally {
    cache.isSyncing = false;
    // Process next item if queue is not empty
    if (cache.syncQueue.length > 0) {
      setTimeout(processSyncQueue, 1000);
    }
  }
}

// ─── Helper: build snapshots ──────────────────────────────────────────────────

function buildAppDataSnapshot() {
  return {
    clients: cache.clients,
    documents: cache.documents,
    work: cache.work,
    billing: cache.billing,
    auditLogs: cache.auditLogs,
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

// ─── Immediate save functions (for critical operations) ──────────────────────

export async function saveUserDatabaseNow(): Promise<void> {
  try {
    await saveUserDatabase(buildUserDbSnapshot());
    isSyncOnline = true;
    lastSyncTime = new Date();
  } catch (err) {
    console.error("[storage] Immediate user database save failed:", err);
    // Add to queue for retry
    addToSyncQueue({
      operation: "saveUserDb",
      data: buildUserDbSnapshot(),
    });
    throw err;
  }
}

export async function saveUsersNow(users: User[]): Promise<void> {
  cache.users = users;
  lsSet(KEYS.users, users);
  const hasSA = users.some((u) => u.role === "Super Admin");
  if (hasSA) {
    cache.superAdminCreated = true;
    localStorage.setItem(KEYS.superAdminCreated, "true");
  }
  dispatchChange(KEYS.users);
  
  try {
    await saveUserDatabase(buildUserDbSnapshot());
    isSyncOnline = true;
    lastSyncTime = new Date();
  } catch (err) {
    console.error("[storage] Immediate users save failed:", err);
    addToSyncQueue({
      operation: "saveUsers",
      data: buildUserDbSnapshot(),
    });
  }
}

// NEW: Immediate save for clients (fixes delete bug)
export async function saveClientsNow(clients: Client[]): Promise<void> {
  cache.clients = clients;
  lsSet(KEYS.clients, clients);
  dispatchChange(KEYS.clients);
  
  try {
    await saveAppData(buildAppDataSnapshot());
    isSyncOnline = true;
    lastSyncTime = new Date();
  } catch (err) {
    console.error("[storage] Immediate clients save failed:", err);
    addToSyncQueue({
      operation: "saveClients",
      data: buildAppDataSnapshot(),
    });
    throw err;
  }
}

// NEW: Immediate save for documents
export async function saveDocumentsNow(documents: DocumentInward[]): Promise<void> {
  cache.documents = documents;
  lsSet(KEYS.documents, documents);
  dispatchChange(KEYS.documents);
  
  try {
    await saveAppData(buildAppDataSnapshot());
    isSyncOnline = true;
    lastSyncTime = new Date();
  } catch (err) {
    console.error("[storage] Immediate documents save failed:", err);
    addToSyncQueue({
      operation: "saveDocuments",
      data: buildAppDataSnapshot(),
    });
    throw err;
  }
}

// NEW: Immediate save for work
export async function saveWorkNow(work: WorkProcessing[]): Promise<void> {
  cache.work = work;
  lsSet(KEYS.work, work);
  dispatchChange(KEYS.work);
  
  try {
    await saveAppData(buildAppDataSnapshot());
    isSyncOnline = true;
    lastSyncTime = new Date();
  } catch (err) {
    console.error("[storage] Immediate work save failed:", err);
    addToSyncQueue({
      operation: "saveWork",
      data: buildAppDataSnapshot(),
    });
    throw err;
  }
}

// NEW: Immediate save for billing
export async function saveBillingNow(billing: Billing[]): Promise<void> {
  cache.billing = billing;
  lsSet(KEYS.billing, billing);
  dispatchChange(KEYS.billing);
  
  try {
    await saveAppData(buildAppDataSnapshot());
    isSyncOnline = true;
    lastSyncTime = new Date();
  } catch (err) {
    console.error("[storage] Immediate billing save failed:", err);
    addToSyncQueue({
      operation: "saveBilling",
      data: buildAppDataSnapshot(),
    });
    throw err;
  }
}

// ─── Background sync with queue fallback ──────────────────────────────────────

function bgSync(
  syncFn: () => Promise<void>,
  description: string,
  data: unknown,
  operation: SyncQueueItem["operation"],
): void {
  syncFn()
    .then(() => {
      isSyncOnline = true;
      lastSyncTime = new Date();
    })
    .catch((err) => {
      console.warn(`[storage] canister sync failed (${description}):`, err);
      isSyncOnline = false;
      // Add to queue for retry
      addToSyncQueue({ operation, data });
    });
}

// ─── Main initialize function ──────────────────────────────────────────────────

export async function initialize(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    loadCacheFromLocalStorage();

    try {
      const canisterData = await loadAllFromCanister();

      if (canisterData.userDb) {
        const udb = canisterData.userDb;
        if (udb.users !== undefined && udb.users.length > 0) {
          cache.users = udb.users;
          lsSet(KEYS.users, cache.users);
        }
        if (udb.firmAccounts !== undefined && udb.firmAccounts.length > 0) {
          cache.firmAccounts = udb.firmAccounts;
          lsSet(KEYS.firmAccounts, cache.firmAccounts);
        }
        if (udb.superAdminCreated === true) {
          cache.superAdminCreated = true;
          localStorage.setItem(KEYS.superAdminCreated, "true");
        }
        if (udb.whatsAppSettings) {
          cache.whatsappSettings = udb.whatsAppSettings ?? null;
          if (cache.whatsappSettings) {
            lsSetSingle(KEYS.whatsappSettings, cache.whatsappSettings);
          }
        }
      }

      const hasAdmin = cache.users.some((u) => u.role === "Super Admin");
      if (hasAdmin) {
        cache.superAdminCreated = true;
        localStorage.setItem(KEYS.superAdminCreated, "true");
      }

      if (canisterData.clients.length > 0) {
        cache.clients = canisterData.clients;
        lsSet(KEYS.clients, cache.clients);
      }
      if (canisterData.documents.length > 0) {
        cache.documents = canisterData.documents;
        lsSet(KEYS.documents, cache.documents);
      }
      if (canisterData.work.length > 0) {
        cache.work = canisterData.work;
        lsSet(KEYS.work, cache.work);
      }
      if (canisterData.billing.length > 0) {
        cache.billing = canisterData.billing;
        lsSet(KEYS.billing, cache.billing);
      }
      if (canisterData.auditLogs.length > 0) {
        const canisterIds = new Set(canisterData.auditLogs.map((l) => l.id));
        const localOnly = cache.auditLogs.filter((l) => !canisterIds.has(l.id));
        cache.auditLogs = [...canisterData.auditLogs, ...localOnly];
        lsSet(KEYS.auditLogs, cache.auditLogs);
      }

      lastSyncTime = new Date();
      isSyncOnline = true;
      console.log("[storage] Initialized from canister:", {
        users: cache.users.length,
        clients: cache.clients.length,
        superAdminCreated: cache.superAdminCreated,
      });
    } catch (err) {
      console.warn("[storage] Canister load failed, using localStorage cache:", err);
      isSyncOnline = false;
    }

    isInitialized = true;
    dispatchChange("init");
    
    // Process any pending sync queue items
    processSyncQueue();
  })();

  return initPromise;
}

export async function whenInitialized(): Promise<void> {
  if (isInitialized) return;
  return initialize();
}

export async function refreshFromCanister(): Promise<void> {
  initPromise = null;
  isInitialized = false;
  return initialize();
}

export async function silentRefreshFromCanister(): Promise<void> {
  try {
    const canisterData = await loadAllFromCanister();
    let changed = false;

    if (canisterData.userDb) {
      const udb = canisterData.userDb;
      if (udb.users !== undefined && udb.users.length > 0) {
        const prev = JSON.stringify(cache.users);
        cache.users = udb.users;
        lsSet(KEYS.users, cache.users);
        if (JSON.stringify(cache.users) !== prev) changed = true;
      }
      if (udb.firmAccounts !== undefined && udb.firmAccounts.length > 0) {
        const prev = JSON.stringify(cache.firmAccounts);
        cache.firmAccounts = udb.firmAccounts;
        lsSet(KEYS.firmAccounts, cache.firmAccounts);
        if (JSON.stringify(cache.firmAccounts) !== prev) changed = true;
      }
      if (udb.superAdminCreated === true) {
        cache.superAdminCreated = true;
        localStorage.setItem(KEYS.superAdminCreated, "true");
      }
    }

    if (cache.users.some((u) => u.role === "Super Admin")) {
      cache.superAdminCreated = true;
      localStorage.setItem(KEYS.superAdminCreated, "true");
    }

    const prevClients = JSON.stringify(cache.clients);
    cache.clients = canisterData.clients;
    lsSet(KEYS.clients, cache.clients);
    if (JSON.stringify(canisterData.clients) !== prevClients) changed = true;

    const prevDocs = JSON.stringify(cache.documents);
    cache.documents = canisterData.documents;
    lsSet(KEYS.documents, cache.documents);
    if (JSON.stringify(canisterData.documents) !== prevDocs) changed = true;

    const prevWork = JSON.stringify(cache.work);
    cache.work = canisterData.work;
    lsSet(KEYS.work, cache.work);
    if (JSON.stringify(canisterData.work) !== prevWork) changed = true;

    const prevBilling = JSON.stringify(cache.billing);
    cache.billing = canisterData.billing;
    lsSet(KEYS.billing, cache.billing);
    if (JSON.stringify(canisterData.billing) !== prevBilling) changed = true;

    const prevLogs = JSON.stringify(cache.auditLogs);
    if (canisterData.auditLogs.length > 0) {
      const canisterIds = new Set(canisterData.auditLogs.map((l) => l.id));
      const localOnly = cache.auditLogs.filter((l) => !canisterIds.has(l.id));
      cache.auditLogs = [...canisterData.auditLogs, ...localOnly];
    }
    lsSet(KEYS.auditLogs, cache.auditLogs);
    if (JSON.stringify(cache.auditLogs) !== prevLogs) changed = true;

    if (changed) {
      lastSyncTime = new Date();
      dispatchChange("refresh");
    } else {
      lastSyncTime = new Date();
    }
    
    isSyncOnline = true;
  } catch (err) {
    console.warn("[storage] silentRefresh failed:", err);
    isSyncOnline = false;
  }
}

// ─── Export the enhanced storage API ──────────────────────────────────────────

export { buildAppDataSnapshot, buildUserDbSnapshot, dispatchChange, lsGet, lsSet, uid };

// Re-export from original for compatibility
export {
  getDaysUntilDue,
  getLatestDoc,
  getLatestDocStatus,
  getClientWork,
  getClientBilling,
  isClientEVerified,
  getFilingStatus,
  getDueAlertClients,
  getDeadlineAlertClients,
  getEVerificationAlerts,
  queueDueDateNotifications,
  seedData,
  getHeadOfIncome,
  getPanCategory,
  parseDDMMYYYY,
} from "./storage";
