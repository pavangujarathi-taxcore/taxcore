/**
 * storage-api.ts
 *
 * Real-time cross-device storage with MongoDB backend
 * - All changes sync to backend API immediately
 * - 2-second polling fetches updates from other devices
 * - localStorage cache for offline support
 * - Works across ALL devices and browsers
 */

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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
const STORAGE_KEYS = {
  users: "taxcore_users_v3",
  clients: "taxcore_clients_v3",
  documents: "taxcore_documents_v3",
  work: "taxcore_work_v3",
  billing: "taxcore_billing_v3",
  currentUser: "taxcore_current_user_v3",
  firmAccounts: "taxcore_firm_accounts_v3",
  superAdminCreated: "taxcore_super_admin_created_v3",
  auditLogs: "taxcore_audit_logs_v3",
  whatsappSettings: "taxcore_whatsapp_settings_v3",
  notificationLogs: "taxcore_notification_logs_v3",
  lastSync: "taxcore_last_sync_v3",
};

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
};

// ─── API Helpers ───────────────────────────────────────────────────────────────

async function apiGet(endpoint: string): Promise<any> {
  const response = await fetch(`${BACKEND_URL}${endpoint}`);
  if (!response.ok) throw new Error(`API error: ${response.statusText}`);
  return response.json();
}

async function apiPost(endpoint: string, data: any): Promise<any> {
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`API error: ${response.statusText}`);
  return response.json();
}

// ─── localStorage Helpers ──────────────────────────────────────────────────────

function saveToLocalStorage<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to save to localStorage: ${key}`, err);
  }
}

function loadFromLocalStorage<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    return [];
  }
}

function saveSingleToLocalStorage<T>(key: string, data: T | null): void {
  try {
    if (data === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch (err) {
    console.error(`Failed to save to localStorage: ${key}`, err);
  }
}

function loadSingleFromLocalStorage<T>(key: string): T | null {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    return null;
  }
}

// ─── Dispatch change event ─────────────────────────────────────────────────────

function dispatchChange(key?: string): void {
  window.dispatchEvent(
    new CustomEvent("taxcore-storage-change", { detail: { key } }),
  );
}

// ─── Generate unique ID ────────────────────────────────────────────────────────

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Initialize from Backend ───────────────────────────────────────────────────

let isInitialized = false;
export let lastSyncTime: Date | null = null;
export let isSyncOnline = true;

export async function initialize(): Promise<void> {
  if (isInitialized) return;

  console.log("🔄 [storage] Initializing from backend API...");

  // First load from localStorage for instant UI
  cache.users = loadFromLocalStorage<User>(STORAGE_KEYS.users);
  cache.clients = loadFromLocalStorage<Client>(STORAGE_KEYS.clients);
  cache.documents = loadFromLocalStorage<DocumentInward>(STORAGE_KEYS.documents);
  cache.work = loadFromLocalStorage<WorkProcessing>(STORAGE_KEYS.work);
  cache.billing = loadFromLocalStorage<Billing>(STORAGE_KEYS.billing);
  cache.firmAccounts = loadFromLocalStorage<FirmAccount>(STORAGE_KEYS.firmAccounts);
  cache.auditLogs = loadFromLocalStorage<AuditLogEntry>(STORAGE_KEYS.auditLogs);
  cache.notificationLogs = loadFromLocalStorage<NotificationLog>(STORAGE_KEYS.notificationLogs);
  cache.whatsappSettings = loadSingleFromLocalStorage<WhatsAppSettings>(STORAGE_KEYS.whatsappSettings);
  
  const superAdminFlag = localStorage.getItem(STORAGE_KEYS.superAdminCreated);
  cache.superAdminCreated = superAdminFlag === "true";

  try {
    // Then fetch latest from backend
    const data = await apiGet("/api/sync/all");
    
    cache.users = data.users || [];
    cache.clients = data.clients || [];
    cache.documents = data.documents || [];
    cache.work = data.work || [];
    cache.billing = data.billing || [];
    cache.firmAccounts = data.firmAccounts || [];
    cache.auditLogs = data.auditLogs || [];
    cache.superAdminCreated = data.settings?.superAdminCreated || false;
    cache.whatsappSettings = data.settings?.whatsAppSettings || null;

    // Save to localStorage
    saveToLocalStorage(STORAGE_KEYS.users, cache.users);
    saveToLocalStorage(STORAGE_KEYS.clients, cache.clients);
    saveToLocalStorage(STORAGE_KEYS.documents, cache.documents);
    saveToLocalStorage(STORAGE_KEYS.work, cache.work);
    saveToLocalStorage(STORAGE_KEYS.billing, cache.billing);
    saveToLocalStorage(STORAGE_KEYS.firmAccounts, cache.firmAccounts);
    saveToLocalStorage(STORAGE_KEYS.auditLogs, cache.auditLogs);
    saveSingleToLocalStorage(STORAGE_KEYS.whatsappSettings, cache.whatsappSettings);
    localStorage.setItem(STORAGE_KEYS.superAdminCreated, cache.superAdminCreated ? "true" : "false");

    lastSyncTime = new Date();
    isSyncOnline = true;

    console.log("✅ [storage] Initialized from backend:", {
      users: cache.users.length,
      clients: cache.clients.length,
      documents: cache.documents.length,
      work: cache.work.length,
      billing: cache.billing.length,
    });
  } catch (err) {
    console.error("❌ [storage] Backend sync failed, using localStorage:", err);
    isSyncOnline = false;
  }

  isInitialized = true;
  dispatchChange("init");
}

export async function whenInitialized(): Promise<void> {
  return initialize();
}

// ─── Silent refresh for real-time sync (called every 2 seconds) ───────────────

export async function silentRefreshFromCanister(): Promise<void> {
  try {
    const data = await apiGet("/api/sync/all");
    
    let changed = false;

    if (JSON.stringify(cache.clients) !== JSON.stringify(data.clients || [])) {
      cache.clients = data.clients || [];
      saveToLocalStorage(STORAGE_KEYS.clients, cache.clients);
      changed = true;
    }

    if (JSON.stringify(cache.users) !== JSON.stringify(data.users || [])) {
      cache.users = data.users || [];
      saveToLocalStorage(STORAGE_KEYS.users, cache.users);
      changed = true;
    }

    if (JSON.stringify(cache.documents) !== JSON.stringify(data.documents || [])) {
      cache.documents = data.documents || [];
      saveToLocalStorage(STORAGE_KEYS.documents, cache.documents);
      changed = true;
    }

    if (JSON.stringify(cache.work) !== JSON.stringify(data.work || [])) {
      cache.work = data.work || [];
      saveToLocalStorage(STORAGE_KEYS.work, cache.work);
      changed = true;
    }

    if (JSON.stringify(cache.billing) !== JSON.stringify(data.billing || [])) {
      cache.billing = data.billing || [];
      saveToLocalStorage(STORAGE_KEYS.billing, cache.billing);
      changed = true;
    }

    if (changed) {
      lastSyncTime = new Date();
      dispatchChange("refresh");
    }

    isSyncOnline = true;
  } catch (err) {
    console.warn("[storage] Silent refresh failed:", err);
    isSyncOnline = false;
  }
}

export async function refreshFromCanister(): Promise<void> {
  isInitialized = false;
  return initialize();
}

// ─── Storage API with Backend Sync ─────────────────────────────────────────────

export const storage = {
  // ─── Users ───────────────────────────────────────────────────────────────────

  getUsers: (): User[] => cache.users,

  saveUsers: (users: User[]): void => {
    cache.users = users;
    saveToLocalStorage(STORAGE_KEYS.users, users);
    dispatchChange(STORAGE_KEYS.users);
    
    // Sync to backend
    apiPost("/api/users", { users }).catch(err => 
      console.error("Failed to sync users to backend:", err)
    );
  },

  async saveUsersNow(users: User[]): Promise<void> {
    cache.users = users;
    saveToLocalStorage(STORAGE_KEYS.users, users);
    dispatchChange(STORAGE_KEYS.users);
    await apiPost("/api/users", { users });
  },

  // ─── Clients ─────────────────────────────────────────────────────────────────

  getClients: (): Client[] => cache.clients,

  saveClients: (clients: Client[]): void => {
    console.log(`💾 [storage] Saving ${clients.length} clients to backend...`);
    cache.clients = clients;
    saveToLocalStorage(STORAGE_KEYS.clients, clients);
    dispatchChange(STORAGE_KEYS.clients);
    
    // Sync to backend
    apiPost("/api/clients", { clients })
      .then(() => console.log(`✅ [storage] ${clients.length} clients synced to backend`))
      .catch(err => console.error("Failed to sync clients to backend:", err));
  },

  // ─── Documents ───────────────────────────────────────────────────────────────

  getDocuments: (): DocumentInward[] => cache.documents,

  saveDocuments: (docs: DocumentInward[]): void => {
    cache.documents = docs;
    saveToLocalStorage(STORAGE_KEYS.documents, docs);
    dispatchChange(STORAGE_KEYS.documents);
    
    apiPost("/api/documents", { documents: docs }).catch(err => 
      console.error("Failed to sync documents to backend:", err)
    );
  },

  // ─── Work Processing ─────────────────────────────────────────────────────────

  getWork: (): WorkProcessing[] => cache.work,

  saveWork: (work: WorkProcessing[]): void => {
    cache.work = work;
    saveToLocalStorage(STORAGE_KEYS.work, work);
    dispatchChange(STORAGE_KEYS.work);
    
    apiPost("/api/work", { work }).catch(err => 
      console.error("Failed to sync work to backend:", err)
    );
  },

  // ─── Billing ─────────────────────────────────────────────────────────────────

  getBilling: (): Billing[] => cache.billing,

  saveBilling: (billing: Billing[]): void => {
    cache.billing = billing;
    saveToLocalStorage(STORAGE_KEYS.billing, billing);
    dispatchChange(STORAGE_KEYS.billing);
    
    apiPost("/api/billing", { billing }).catch(err => 
      console.error("Failed to sync billing to backend:", err)
    );
  },

  // ─── Current User ────────────────────────────────────────────────────────────

  getCurrentUser: (): User | null => {
    return loadSingleFromLocalStorage<User>(STORAGE_KEYS.currentUser);
  },

  setCurrentUser: (user: User | null): void => {
    saveSingleToLocalStorage(STORAGE_KEYS.currentUser, user);
    dispatchChange(STORAGE_KEYS.currentUser);
  },

  // ─── Firm Accounts ───────────────────────────────────────────────────────────

  getFirmAccounts: (): FirmAccount[] => cache.firmAccounts,

  saveFirmAccounts: (accounts: FirmAccount[]): void => {
    cache.firmAccounts = accounts;
    saveToLocalStorage(STORAGE_KEYS.firmAccounts, accounts);
    dispatchChange(STORAGE_KEYS.firmAccounts);
    
    apiPost("/api/firm-accounts", { firmAccounts: accounts }).catch(err => 
      console.error("Failed to sync firm accounts to backend:", err)
    );
  },

  // ─── Super Admin Created ─────────────────────────────────────────────────────

  getSuperAdminCreated: (): boolean => cache.superAdminCreated,

  setSuperAdminCreated: (created: boolean): void => {
    cache.superAdminCreated = created;
    localStorage.setItem(STORAGE_KEYS.superAdminCreated, created ? "true" : "false");
    dispatchChange(STORAGE_KEYS.superAdminCreated);
    
    apiPost("/api/settings", { superAdminCreated: created }).catch(err => 
      console.error("Failed to sync settings to backend:", err)
    );
  },

  // ─── Audit Logs ──────────────────────────────────────────────────────────────

  getAuditLogs: (): AuditLogEntry[] => cache.auditLogs,

  saveAuditLogs: (logs: AuditLogEntry[]): void => {
    cache.auditLogs = logs;
    saveToLocalStorage(STORAGE_KEYS.auditLogs, logs);
    dispatchChange(STORAGE_KEYS.auditLogs);
    
    apiPost("/api/audit-logs", { auditLogs: logs }).catch(err => 
      console.error("Failed to sync audit logs to backend:", err)
    );
  },

  addAuditLog: (log: Omit<AuditLogEntry, "id" | "timestamp">): void => {
    const newLog: AuditLogEntry = {
      ...log,
      id: uid(),
      timestamp: new Date().toISOString(),
    };
    cache.auditLogs.push(newLog);
    saveToLocalStorage(STORAGE_KEYS.auditLogs, cache.auditLogs);
    dispatchChange(STORAGE_KEYS.auditLogs);
    
    apiPost("/api/audit-logs", { auditLogs: cache.auditLogs }).catch(err => 
      console.error("Failed to sync audit logs to backend:", err)
    );
  },

  // ─── WhatsApp Settings ───────────────────────────────────────────────────────

  getWhatsAppSettings: (): WhatsAppSettings | null => cache.whatsappSettings,

  saveWhatsAppSettings: (settings: WhatsAppSettings | null): void => {
    cache.whatsappSettings = settings;
    saveSingleToLocalStorage(STORAGE_KEYS.whatsappSettings, settings);
    dispatchChange(STORAGE_KEYS.whatsappSettings);
    
    apiPost("/api/settings", { whatsAppSettings: settings }).catch(err => 
      console.error("Failed to sync WhatsApp settings to backend:", err)
    );
  },

  // ─── Notification Logs ───────────────────────────────────────────────────────

  getNotificationLogs: (): NotificationLog[] => cache.notificationLogs,

  saveNotificationLogs: (logs: NotificationLog[]): void => {
    cache.notificationLogs = logs;
    saveToLocalStorage(STORAGE_KEYS.notificationLogs, logs);
    dispatchChange(STORAGE_KEYS.notificationLogs);
  },

  addNotificationLog: (log: Omit<NotificationLog, "id">): void => {
    const newLog: NotificationLog = {
      ...log,
      id: uid(),
    };
    cache.notificationLogs.push(newLog);
    saveToLocalStorage(STORAGE_KEYS.notificationLogs, cache.notificationLogs);
    dispatchChange(STORAGE_KEYS.notificationLogs);
  },

  // ─── Utility ─────────────────────────────────────────────────────────────────

  uid,

  getLastSyncTime: (): Date | null => lastSyncTime,
};

// Export for compatibility
export { uid };
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
