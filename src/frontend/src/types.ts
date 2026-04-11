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
}

export interface DocumentInward {
  id: string;
  clientId: string;
  date: string; // DD-MM-YYYY
  mode: "Email" | "WhatsApp" | "Hardcopy" | "Mix";
  status: "Complete" | "Partial";
  remarks: string;
  createdAt: string;
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
}

export type Page =
  | "dashboard"
  | "clients"
  | "client-detail"
  | "work-processing"
  | "billing"
  | "user-management"
  | "export"
  | "import"
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
export type ThemeKey = "burgundy" | "yellow" | "navy" | "forestgreen" | "teal" | "coral" | "mint" | "sky";

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
    label: "Burgundy",
    primary: "#8B3A3A",           // Lighter burgundy (was #6B1414)
    primaryLight: "rgba(139,58,58,0.06)",
    gold: "#E8D4A0",              // Softer gold (was #C9A84C)
    activeHighlight: "rgba(232,212,160,0.12)",
    subtitle: "#E8D4A0",
    logoIconBg: "#E8D4A0",
    logoIconText: "#8B3A3A",
    activeNavText: "#E8D4A0",
    activeNavBorder: "#E8D4A0",
    avatarBg: "#E8D4A0",
    avatarText: "#8B3A3A",
    pageTitleColor: "#8B3A3A",
  },
  yellow: {
    key: "yellow",
    label: "Olive Gold",
    primary: "#5C5C2E",            // Lighter olive (was #3D3D0A)
    primaryLight: "rgba(92,92,46,0.06)",
    gold: "#D4C576",               // Softer gold (was #BFA84A)
    activeHighlight: "rgba(212,197,118,0.12)",
    subtitle: "#D4C576",
    logoIconBg: "#D4C576",
    logoIconText: "#5C5C2E",
    activeNavText: "#D4C576",
    activeNavBorder: "#D4C576",
    avatarBg: "#D4C576",
    avatarText: "#5C5C2E",
    pageTitleColor: "#5C5C2E",
  },
  navy: {
    key: "navy",
    label: "Navy Blue",
    primary: "#1E3A5F",            // Lighter navy (was #0D2137)
    primaryLight: "rgba(30,58,95,0.06)",
    gold: "#7FB3E8",               // Softer blue (was #5B9BD5)
    activeHighlight: "rgba(127,179,232,0.12)",
    subtitle: "#A5CEF0",
    logoIconBg: "#7FB3E8",
    logoIconText: "#FFFFFF",
    activeNavText: "#A5CEF0",
    activeNavBorder: "#7FB3E8",
    avatarBg: "#7FB3E8",
    avatarText: "#FFFFFF",
    pageTitleColor: "#1E3A5F",
  },
  forestgreen: {
    key: "forestgreen",
    label: "Forest Green",
    primary: "#2D5A3D",            // Lighter forest (was #1A3A22)
    primaryLight: "rgba(45,90,61,0.06)",
    gold: "#6EC99A",               // Softer green (was #4CAF7D)
    activeHighlight: "rgba(110,201,154,0.12)",
    subtitle: "#9DE5C0",
    logoIconBg: "#6EC99A",
    logoIconText: "#FFFFFF",
    activeNavText: "#9DE5C0",
    activeNavBorder: "#6EC99A",
    avatarBg: "#6EC99A",
    avatarText: "#FFFFFF",
    pageTitleColor: "#2D5A3D",
  },
  teal: {
    key: "teal",
    label: "Fresh Teal 💎",
    primary: "#2BA89F",            // Lighter teal (was #0D9488)
    primaryLight: "rgba(43,168,159,0.06)",
    gold: "#5DD5C9",               // Softer teal (was #14B8A6)
    activeHighlight: "rgba(93,213,201,0.12)",
    subtitle: "#7FE5DA",
    logoIconBg: "#5DD5C9",
    logoIconText: "#FFFFFF",
    activeNavText: "#7FE5DA",
    activeNavBorder: "#5DD5C9",
    avatarBg: "#5DD5C9",
    avatarText: "#FFFFFF",
    pageTitleColor: "#2BA89F",
  },
  coral: {
    key: "coral",
    label: "Coral Sunset 🌅",
    primary: "#F07142",            // Lighter coral (was #EA580C)
    primaryLight: "rgba(240,113,66,0.06)",
    gold: "#FCA876",               // Softer coral (was #FB923C)
    activeHighlight: "rgba(252,168,118,0.12)",
    subtitle: "#FDC49E",
    logoIconBg: "#FCA876",
    logoIconText: "#FFFFFF",
    activeNavText: "#FDC49E",
    activeNavBorder: "#FCA876",
    avatarBg: "#FCA876",
    avatarText: "#FFFFFF",
    pageTitleColor: "#F07142",
  },
  mint: {
    key: "mint",
    label: "Mint Fresh 🌿",
    primary: "#34A87E",            // Lighter mint (was #059669)
    primaryLight: "rgba(52,168,126,0.06)",
    gold: "#5FD4A7",               // Softer mint (was #10B981)
    activeHighlight: "rgba(95,212,167,0.12)",
    subtitle: "#8BE5C0",
    logoIconBg: "#5FD4A7",
    logoIconText: "#FFFFFF",
    activeNavText: "#8BE5C0",
    activeNavBorder: "#5FD4A7",
    avatarBg: "#5FD4A7",
    avatarText: "#FFFFFF",
    pageTitleColor: "#34A87E",
  },
  sky: {
    key: "sky",
    label: "Sky Blue ☁️",
    primary: "#3B9FD9",            // Lighter sky (was #0284C7)
    primaryLight: "rgba(59,159,217,0.06)",
    gold: "#62BFED",               // Softer sky (was #0EA5E9)
    activeHighlight: "rgba(98,191,237,0.12)",
    subtitle: "#8DD4F5",
    logoIconBg: "#62BFED",
    logoIconText: "#FFFFFF",
    activeNavText: "#8DD4F5",
    activeNavBorder: "#62BFED",
    avatarBg: "#62BFED",
    avatarText: "#FFFFFF",
    pageTitleColor: "#3B9FD9",
  },
};
