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

    // Sync superAdminCreated flag
    const backendSuperAdminFlag = data.settings?.superAdminCreated || false;
    if (cache.superAdminCreated !== backendSuperAdminFlag) {
      cache.superAdminCreated = backendSuperAdminFlag;
      localStorage.setItem(STORAGE_KEYS.superAdminCreated, backendSuperAdminFlag ? "true" : "false");
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
    
    // Auto-set superAdminCreated flag if a Super Admin exists
    const hasSuperAdmin = users.some(u => u.role === "Super Admin");
    if (hasSuperAdmin && !cache.superAdminCreated) {
      cache.superAdminCreated = true;
      localStorage.setItem(STORAGE_KEYS.superAdminCreated, "true");
      // Sync flag to backend immediately
      apiPost("/api/settings", { superAdminCreated: true }).catch(err => 
        console.error("Failed to sync superAdminCreated flag:", err)
      );
    }
    
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

  isSuperAdminCreated: (): boolean => cache.superAdminCreated, // Alias for backward compatibility

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

// ─── Storage Change Listener ───────────────────────────────────────────────────

export function onStorageChange(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("taxcore-storage-change", handler);
  return () => window.removeEventListener("taxcore-storage-change", handler);
}

// ─── Save Users Now (Async Version) ────────────────────────────────────────────

export async function saveUsersNow(users: User[]): Promise<void> {
  storage.saveUsers(users);
  // The storage.saveUsers already syncs to backend, so we're done
  await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for sync
}

export async function saveUserDatabaseNow(): Promise<void> {
  // In the new backend system, users are automatically synced to MongoDB
  // This function is kept for backward compatibility
  const users = storage.getUsers();
  storage.saveUsers(users);
  await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for sync
}

// ─── Utility Helper Functions ──────────────────────────────────────────────────

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

export function isClientEVerified(clientId: string): boolean {
  const work = getClientWork(clientId);
  if (!work) return false;
  const fs = work.filingStatus ?? (work.eVerified ? "E-Verified" : "Pending");
  return fs === "E-Verified" || work.eVerified === true;
}

export function getFilingStatus(
  work: WorkProcessing,
): "Pending" | "Pending for E-verification" | "E-Verified" {
  if (work.filingStatus) return work.filingStatus;
  if (work.eVerified === true) return "E-Verified";
  return "Pending";
}

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
        : `Dear ${client.name}, your ITR due date is ${client.dueDate} — only ${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining. Please submit documents at the earliest.`;

    storage.addNotificationLog({
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

export function getHeadOfIncome(client: Client): string {
  if (client.headOfIncome) return client.headOfIncome;
  const legacy = (client as any).sourceOfIncome;
  if (legacy === "Salary") return "Salaried";
  if (legacy === "Other") return "Salaried";
  return legacy || "Salaried";
}

// ─── Backwards Compatibility Exports ───────────────────────────────────────────

export { uid };
