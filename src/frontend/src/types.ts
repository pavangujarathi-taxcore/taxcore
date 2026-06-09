export type UserRole = "Super Admin" | "Owner" | "Staff";

// Helper to display role label in UI (Super Admin shown as Administrator)
export function getRoleDisplayLabel(role: UserRole): string {
  if (role === "Super Admin") return "Administrator";
  return role;
}

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  mobile?: string;
  role: UserRole;
  isActive?: boolean; // for Owner accounts controlled by Super Admin
  accessType?: "Trial" | "Full"; // for Owner accounts
  firmOwnerId?: string; // for Staff: the ID of the Owner who created them
  /** Firm this user belongs to. Same as Owner's id for Owner; inherited for Staff. */
  firmId?: string;
}

export interface FirmAccount {
  id: string;
  ownerName: string;
  firmName: string;
  email: string;
  mobile: string;
  accessType: "Trial" | "Full";
  isActive: boolean;
  createdAt: string;
  clientCount: number;
  lastLogin?: string; // ISO date string, updated on each Owner/Staff login
  /** Sequential firm number, e.g. TaxCore_001, TaxCore_002 */
  firmNumber?: string;
}

export interface Client {
  id: string;
  name: string;
  pan: string;
  mobile: string;
  email: string;
  clientType: "Existing" | "New";
  headOfIncome?: "Salaried" | "Business" | "Agricultural" | "Capital Gain";
  /** @deprecated use headOfIncome */
  sourceOfIncome?:
    | "Salary"
    | "Business"
    | "Other"
    | "Salaried"
    | "Agricultural"
    | "Capital Gain";
  businessName: string;
  taxYear: string;
  dueDate: string; // DD-MM-YYYY
  clientCategory: string; // auto from PAN
  createdAt: string;
  createdBy: string;
  /** Firm this client belongs to — matches the Owner's firmId */
  firmId?: string;
}

export interface DocumentInward {
  id: string;
  clientId: string;
  date: string; // DD-MM-YYYY
  mode: "Email" | "WhatsApp" | "Hardcopy" | "Mix";
  status: "Complete" | "Partial";
  remarks: string;
  createdAt: string;
  /** Firm this document belongs to */
  firmId?: string;
}

export interface WorkProcessing {
  id: string;
  clientId: string;
  taxYear: string;
  status: "Pending" | "In Progress" | "Completed" | "Filed"; // "Filed" kept for backward compat
  itrForm: string;
  returnType?: "Original" | "Revised" | "Belated" | "Updated";
  remark?: string;
  ackNumber: string;
  filingDate: string; // DD-MM-YYYY
  updatedAt: string;
  eVerified?: boolean; // backward compat stop-gate
  filingStatus?: "Pending" | "Pending for E-verification" | "E-Verified";
  /** Firm this work record belongs to */
  firmId?: string;
}

export interface Billing {
  id: string;
  clientId: string;
  taxYear: string;
  billAmount: number;
  receipt: number;
  balance: number; // auto = billAmount - receipt
  outwardStatus: "Pending" | "Ready";
  updatedAt: string;
  /** Firm this billing record belongs to */
  firmId?: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  userRole?: string; // optional for backward compat with existing entries
  action: string;
  clientId: string;
  clientName: string;
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  timestamp: string;
  /** Firm this audit entry belongs to — entries remain scoped to originating firm */
  firmId?: string;
}

export interface ImportHistoryEntry {
  id: string;
  importedAt: string; // ISO timestamp
  mode: "Merge" | "Replace";
  importedBy: string; // username
  tabCounts: {
    clients: { added: number; updated: number; skipped: number };
    workProcessing: { added: number; updated: number; skipped: number };
    documentInward: { added: number; updated: number; skipped: number };
    billing: { added: number; updated: number; skipped: number };
  };
  changedRows: {
    clients: Client[];
    workProcessing: WorkProcessing[];
    documentInward: DocumentInward[];
    billing: Billing[];
  };
}

export interface WhatsAppSettings {
  provider: string; // e.g. "Twilio", "Wati", "Interakt", "Other"
  apiKey: string; // placeholder, user will fill in later
  senderPhone: string; // WhatsApp Business number
  dueDateAlertEnabled: boolean;
  filingStatusAlertEnabled: boolean;
  documentReadyAlertEnabled: boolean;
}

export interface NotificationLog {
  id: string;
  clientId: string;
  clientName: string;
  mobile: string;
  message: string;
  event: string; // "Due Date Alert" | "Filing Status" | "Document Ready"
  status: "Pending" | "Sent" | "Failed";
  timestamp: string;
  /** Firm this notification belongs to */
  firmId?: string;
}

export type Page =
  | "dashboard"
  | "clients"
  | "client-detail"
  | "work-processing"
  | "billing"
  | "user-management"
  | "export"
  | "import-history"
  | "super-admin"
  | "audit-log"
  | "settings";

// Utility to get headOfIncome with backward compat
export function getHeadOfIncome(client: Client): string {
  if (client.headOfIncome) return client.headOfIncome;
  const legacy = (client as any).sourceOfIncome;
  if (legacy === "Salary") return "Salaried";
  if (legacy === "Other") return "Salaried";
  return legacy || "Salaried";
}

// Theme system
export type ThemeKey = "burgundy" | "yellow" | "navy" | "forestgreen";

export interface ThemeConfig {
  key: ThemeKey;
  label: string;
  /** Sidebar background color */
  primary: string;
  primaryLight: string;
  /** Accent / link color */
  gold: string;
  /** Active nav item background */
  activeHighlight: string;
  /** Subtitle / inactive text under TaxCore brand */
  subtitle: string;
  /** Logo icon circle background */
  logoIconBg: string;
  /** Logo icon circle text / icon color */
  logoIconText: string;
  /** Active nav item text color */
  activeNavText: string;
  /** Active nav item left-border color */
  activeNavBorder: string;
  /** User avatar circle background */
  avatarBg: string;
  /** User avatar circle text color */
  avatarText: string;
  /** Page title color in top nav */
  pageTitleColor: string;
}

export const THEMES: Record<ThemeKey, ThemeConfig> = {
  burgundy: {
    key: "burgundy",
    label: "Linen & Burgundy",
    primary: "#A05858",
    primaryLight: "rgba(160,88,88,0.10)",
    gold: "#F0E4D0",
    activeHighlight: "rgba(240,228,208,0.22)",
    subtitle: "#F0E4D0",
    logoIconBg: "#F0E4D0",
    logoIconText: "#A05858",
    activeNavText: "#F0E4D0",
    activeNavBorder: "#F0E4D0",
    avatarBg: "#F0E4D0",
    avatarText: "#A05858",
    pageTitleColor: "#A05858",
  },
  yellow: {
    key: "yellow",
    label: "Premium Gold",
    primary: "#6B6B3A",
    primaryLight: "rgba(107,107,58,0.10)",
    gold: "#E6D899",
    activeHighlight: "rgba(230,216,153,0.22)",
    subtitle: "#E6D899",
    logoIconBg: "#E6D899",
    logoIconText: "#6B6B3A",
    activeNavText: "#E6D899",
    activeNavBorder: "#E6D899",
    avatarBg: "#E6D899",
    avatarText: "#6B6B3A",
    pageTitleColor: "#6B6B3A",
  },
  navy: {
    key: "navy",
    label: "Sky Blue",
    primary: "#3B9FD9",
    primaryLight: "rgba(59,159,217,0.10)",
    gold: "#62BFED",
    activeHighlight: "rgba(98,191,237,0.22)",
    subtitle: "#FFFFFF",
    logoIconBg: "#62BFED",
    logoIconText: "#FFFFFF",
    activeNavText: "#FFFFFF",
    activeNavBorder: "#62BFED",
    avatarBg: "#62BFED",
    avatarText: "#FFFFFF",
    pageTitleColor: "#3B9FD9",
  },
  forestgreen: {
    key: "forestgreen",
    label: "Royal Purple",
    primary: "#6B5B95",
    primaryLight: "rgba(107,91,149,0.10)",
    gold: "#C5B8E0",
    activeHighlight: "rgba(197,184,224,0.22)",
    subtitle: "#FFFFFF",
    logoIconBg: "#C5B8E0",
    logoIconText: "#6B5B95",
    activeNavText: "#FFFFFF",
    activeNavBorder: "#C5B8E0",
    avatarBg: "#C5B8E0",
    avatarText: "#6B5B95",
    pageTitleColor: "#6B5B95",
  },
};
