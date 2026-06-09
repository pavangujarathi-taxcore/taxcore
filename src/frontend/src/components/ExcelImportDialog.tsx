/**
 * ExcelImportDialog.tsx
 * Multi-tab Excel import dialog covering all 4 sections:
 * Client Master, Work Processing, Document Inward, Outward & Billing
 */
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileDown,
  GitMerge,
  RefreshCw,
  Upload,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  forceSyncToCanister,
  getPanCategory,
  saveImportHistory,
  storage,
} from "../data/storage";
import type { ImportHistoryEntry } from "../types";
import type { Billing, Client, DocumentInward, WorkProcessing } from "../types";

// ─── Types ───────────────────────────────────────────────────────────────────

type ImportStatus = "upload" | "preview" | "mode" | "done";

interface RowResult {
  rowNum: number;
  data: Record<string, string>;
  valid: boolean;
  errors: string[];
  duplicate?: boolean;
}

interface ImportState {
  clients: RowResult[];
  work: RowResult[];
  docs: RowResult[];
  billing: RowResult[];
}

type ImportMode = "merge" | "replace";

type SectionTab = "clients" | "work" | "docs" | "billing";

interface ImportSummary {
  added: number;
  merged: number;
  replaced: number;
  skipped: number;
}

const SECTION_LABELS: Record<SectionTab, string> = {
  clients: "Client Master",
  work: "Work Processing",
  docs: "Document Inward",
  billing: "Outward & Billing",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const col = (
  row: (string | number | undefined | null)[],
  i: number,
): string => {
  const v = row[i];
  return v == null ? "" : String(v).trim();
};

const isValidPan = (pan: string) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);

const isValidDate = (d: string) => /^\d{2}-\d{2}-\d{4}$/.test(d);

const isValidEmail = (e: string) => /^[^@]+@[^@]+\.[^@]+$/.test(e);

function deriveFilingDateFromAck(ack: string): string | null {
  if (ack.length !== 15) return null;
  const last6 = ack.slice(9, 15);
  const dd = last6.slice(0, 2);
  const mm = last6.slice(2, 4);
  const yy = last6.slice(4, 6);
  const yyyy = `20${yy}`;
  const d = Number(dd);
  const m = Number(mm);
  const y = Number(yyyy);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2000 || y > 2099) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d)
    return null;
  return `${dd}-${mm}-${yyyy}`;
}

function isAfterTaxYearEnd(dateStr: string, taxYear: string): boolean {
  if (!isValidDate(dateStr) || !/^\d{4}-\d{4}$/.test(taxYear)) return false;
  const endYear = Number(taxYear.split("-")[1]);
  const [dd, mm, yyyy] = dateStr.split("-").map(Number);
  const dt = new Date(yyyy, mm - 1, dd);
  const taxEnd = new Date(endYear, 2, 31);
  return dt > taxEnd;
}

// ─── Sheet index lookup (flexible — find by name, fallback to index) ──────────

function getSheet(
  wb: XLSX.WorkBook,
  preferredName: string,
  fallbackIndex: number,
): XLSX.WorkSheet | null {
  // Try exact name
  if (wb.Sheets[preferredName]) return wb.Sheets[preferredName];
  // Try case-insensitive
  const match = wb.SheetNames.find(
    (n) => n.toLowerCase().trim() === preferredName.toLowerCase(),
  );
  if (match) return wb.Sheets[match];
  // Fallback by index
  if (wb.SheetNames[fallbackIndex])
    return wb.Sheets[wb.SheetNames[fallbackIndex]];
  return null;
}

// ─── Validators ──────────────────────────────────────────────────────────────

function validateClientRow(
  raw: (string | number | undefined | null)[],
  rowNum: number,
  existingClients: Client[],
  importedSoFar: Set<string>,
): RowResult {
  // Export column order: Sr.No.(opt), Name, PAN, Head of Income, Business Name, Category(skip),
  // Tax Year, Due Date, Client Type, Mobile, Email, Created At(skip)
  // Detect if first col is Sr.No. (numeric) — shift accordingly
  const offset =
    raw[0] != null &&
    !Number.isNaN(Number(raw[0])) &&
    String(raw[0]).trim() !== ""
      ? 1
      : 0;
  const name = col(raw, offset); // col 0 (or 1)
  const pan = col(raw, offset + 1).toUpperCase(); // col 1 (or 2)
  const headOfIncome = col(raw, offset + 2) || "Salaried"; // col 2 (or 3)
  const businessName = col(raw, offset + 3); // col 3 (or 4)
  // col 4 (or 5) = Category (auto-derived, skip)
  const taxYear = col(raw, offset + 5); // col 5 (or 6)
  const dueDate = col(raw, offset + 6); // col 6 (or 7)
  const clientType = col(raw, offset + 7) || "Existing"; // col 7 (or 8)
  const mobile = col(raw, offset + 8).replace(/\D/g, ""); // col 8 (or 9)
  const email = col(raw, offset + 9); // col 9 (or 10)

  const errors: string[] = [];

  if (!name) errors.push("Name is required");
  if (!pan || !isValidPan(pan))
    errors.push("PAN must be 10 chars (AAAAA9999A format)");
  if (!taxYear || !/^\d{4}-\d{4}$/.test(taxYear))
    errors.push("Tax Year must be YYYY-YYYY");
  if (!headOfIncome) errors.push("Head of Income is required");
  if (mobile && !/^\d{10}$/.test(mobile))
    errors.push("Mobile must be 10 digits");
  if (email && email !== "-" && !isValidEmail(email))
    errors.push("Invalid email format");
  if (dueDate && dueDate !== "-") {
    if (!isValidDate(dueDate)) errors.push("Due Date must be DD-MM-YYYY");
    else if (taxYear && !isAfterTaxYearEnd(dueDate, taxYear)) {
      const endYear = Number(taxYear.split("-")[1]);
      errors.push(`Due Date must be after 31-03-${endYear}`);
    }
  }

  const key = `${pan}|${taxYear}`;
  // Mark as duplicate (for info) but don't add a validation error here —
  // merge/replace mode handles existing records, so existence is not an error.
  const dupInSystem = existingClients.some(
    (c) => c.pan.toUpperCase() === pan && c.taxYear === taxYear,
  );
  const dupInFile = importedSoFar.has(key);
  if (dupInFile && errors.length === 0) {
    errors.push(
      "Duplicate in file: same PAN + Tax Year appears more than once",
    );
  }

  return {
    rowNum,
    data: {
      name,
      pan,
      headOfIncome,
      businessName,
      taxYear,
      dueDate,
      clientType,
      mobile,
      email,
    },
    valid: errors.length === 0,
    errors,
    duplicate: dupInSystem,
  };
}

function validateWorkRow(
  raw: (string | number | undefined | null)[],
  rowNum: number,
): RowResult {
  // Export column order: Sr.No.(opt), Client Name, PAN, Tax Year, Return Type, Work Status,
  // Filing Status, ITR Form, Ack Number, Filing Date(ignored), Due Date(ignored), Remarks
  const offset =
    raw[0] != null &&
    !Number.isNaN(Number(raw[0])) &&
    String(raw[0]).trim() !== ""
      ? 1
      : 0;
  const name = col(raw, offset); // Client Name
  const pan = col(raw, offset + 1).toUpperCase(); // PAN
  const taxYear = col(raw, offset + 2); // Tax Year
  const returnType = col(raw, offset + 3); // Return Type
  let workStatus = col(raw, offset + 4) || "Pending"; // Work Status
  // Filing Status (col 5) — we derive it; file value used only if E-Verified
  const filingStatusRaw = col(raw, offset + 5);
  const itrForm = col(raw, offset + 6); // ITR Form
  const ackNumber = col(raw, offset + 7).replace(/\D/g, ""); // Ack Number
  // col 8 = Filing Date (ALWAYS ignored — derived from ack)
  // col 9 = Due Date (ignored here — belongs to Client)
  const remark = col(raw, offset + 10); // Remarks

  // Normalize legacy "Filed" → "Completed"
  if (workStatus === "Filed") workStatus = "Completed";

  const errors: string[] = [];
  if (!name) errors.push("Client Name is required");
  if (!pan || !isValidPan(pan))
    errors.push("PAN must be 10 chars (AAAAA9999A format)");
  if (!taxYear || !/^\d{4}-\d{4}$/.test(taxYear))
    errors.push("Tax Year must be YYYY-YYYY");
  const validStatuses = ["Pending", "In Progress", "Completed"];
  if (!validStatuses.includes(workStatus))
    errors.push(`Work Status must be: ${validStatuses.join(", ")}`);
  if (ackNumber && ackNumber.length !== 15)
    errors.push("Acknowledgement Number must be 15 digits if provided");

  // Derive filing date from ack (locked — never from file)
  let filingDate = "";
  let filingStatus = "Pending";
  if (ackNumber && ackNumber.length === 15) {
    const derived = deriveFilingDateFromAck(ackNumber);
    if (derived) {
      if (taxYear && !isAfterTaxYearEnd(derived, taxYear)) {
        const endYear = Number(taxYear.split("-")[1]);
        errors.push(
          `Filing Date ${derived} derived from Ack is not after 31-03-${endYear}`,
        );
      } else {
        filingDate = derived;
        // If E-Verified is explicitly set in file and ack is present, accept it
        filingStatus =
          filingStatusRaw === "E-Verified"
            ? "E-Verified"
            : "Pending for E-verification";
      }
    } else {
      errors.push(
        "Cannot derive Filing Date from Acknowledgement Number digits",
      );
    }
  }

  return {
    rowNum,
    data: {
      name,
      pan,
      taxYear,
      returnType,
      workStatus,
      itrForm,
      ackNumber,
      filingDate,
      filingStatus,
      remark,
    },
    valid: errors.length === 0,
    errors,
  };
}

function validateDocRow(
  raw: (string | number | undefined | null)[],
  rowNum: number,
): RowResult {
  // Export column order: Sr.No.(opt), Client Name, PAN, Tax Year, Document Type/Mode,
  // Received Date/Date, Remarks, Status
  const offset =
    raw[0] != null &&
    !Number.isNaN(Number(raw[0])) &&
    String(raw[0]).trim() !== ""
      ? 1
      : 0;
  const name = col(raw, offset); // Client Name
  const pan = col(raw, offset + 1).toUpperCase(); // PAN
  // col 2 = Tax Year (used for matching but not required in doc row itself)
  const taxYear = col(raw, offset + 2); // Tax Year (for client lookup)
  const mode = col(raw, offset + 3); // Document Type / Mode
  const date = col(raw, offset + 4); // Received Date / Date
  const remarks = col(raw, offset + 5); // Remarks
  const status = col(raw, offset + 6); // Status

  const errors: string[] = [];
  if (!name) errors.push("Client Name is required");
  if (!pan || !isValidPan(pan)) errors.push("PAN must be 10 chars");
  if (!date || !isValidDate(date)) errors.push("Date must be DD-MM-YYYY");
  else {
    // Not a future date
    const [dd, mm, yyyy] = date.split("-").map(Number);
    const dt = new Date(yyyy, mm - 1, dd);
    if (dt > new Date()) errors.push("Date cannot be in the future");
  }
  const validModes = ["Email", "WhatsApp", "Hardcopy", "Mix"];
  if (!validModes.includes(mode))
    errors.push(`Mode must be: ${validModes.join(", ")}`);
  const validStatuses = ["Complete", "Partial"];
  if (!validStatuses.includes(status))
    errors.push(`Status must be: ${validStatuses.join(", ")}`);

  return {
    rowNum,
    data: { name, pan, taxYear, date, mode, status, remarks },
    valid: errors.length === 0,
    errors,
  };
}

function validateBillingRow(
  raw: (string | number | undefined | null)[],
  rowNum: number,
): RowResult {
  // Export column order: Sr.No.(opt), Client Name, PAN, Tax Year, Bill Amount, Receipt, Balance(skip),
  // Billing Date(skip), Remarks, Outward Status
  const offset =
    raw[0] != null &&
    !Number.isNaN(Number(raw[0])) &&
    String(raw[0]).trim() !== ""
      ? 1
      : 0;
  const name = col(raw, offset); // Client Name
  const pan = col(raw, offset + 1).toUpperCase(); // PAN
  const taxYear = col(raw, offset + 2); // Tax Year
  const billAmountRaw = col(raw, offset + 3).replace(/[^\d.]/g, ""); // Bill Amount
  const receiptRaw = col(raw, offset + 4).replace(/[^\d.]/g, ""); // Receipt
  // col 5 = Balance (auto-calc, ignore)
  // col 6 = Billing Date (skip)
  // col 7 = Remarks
  const outwardStatus = col(raw, offset + 8) || "Pending"; // Outward Status

  const errors: string[] = [];
  if (!name) errors.push("Client Name is required");
  if (!pan || !isValidPan(pan)) errors.push("PAN must be 10 chars");
  if (!taxYear || !/^\d{4}-\d{4}$/.test(taxYear))
    errors.push("Tax Year must be YYYY-YYYY");
  if (billAmountRaw && Number.isNaN(Number(billAmountRaw)))
    errors.push("Bill Amount must be numeric");
  if (receiptRaw && Number.isNaN(Number(receiptRaw)))
    errors.push("Receipt must be numeric");
  const validStatuses = ["Pending", "Ready"];
  if (!validStatuses.includes(outwardStatus))
    errors.push(`Outward Status must be: ${validStatuses.join(", ")}`);

  const billAmount = billAmountRaw ? Number(billAmountRaw) : 0;
  const receipt = receiptRaw ? Number(receiptRaw) : 0;
  const balance = billAmount - receipt;

  return {
    rowNum,
    data: {
      name,
      pan,
      taxYear,
      billAmount: String(billAmount),
      receipt: String(receipt),
      balance: String(balance),
      outwardStatus,
    },
    valid: errors.length === 0,
    errors,
  };
}

// ─── Parse workbook ───────────────────────────────────────────────────────────

function parseWorkbook(
  wb: XLSX.WorkBook,
  existingClients: Client[],
): ImportState {
  const toRows = (ws: XLSX.WorkSheet | null) => {
    if (!ws) return [];
    return (
      XLSX.utils.sheet_to_json<(string | number | undefined | null)[]>(ws, {
        header: 1,
      }) as (string | number | undefined | null)[][]
    )
      .slice(1)
      .filter((r) => r?.some((c) => c != null && String(c).trim() !== ""));
  };

  const clientSheet = getSheet(wb, "Client Master", 0);
  const workSheet = getSheet(wb, "Work Processing", 1);
  const docSheet = getSheet(wb, "Document Inward", 2);
  const billingSheet = getSheet(wb, "Outward & Billing", 3);

  const clientRaws = toRows(clientSheet);
  const seenPanYear = new Set<string>();
  const clients: RowResult[] = clientRaws.map((r, i) => {
    const result = validateClientRow(r, i + 2, existingClients, seenPanYear);
    if (result.valid)
      seenPanYear.add(`${result.data.pan}|${result.data.taxYear}`);
    return result;
  });

  const work: RowResult[] = toRows(workSheet).map((r, i) =>
    validateWorkRow(r, i + 2),
  );

  const docs: RowResult[] = toRows(docSheet).map((r, i) =>
    validateDocRow(r, i + 2),
  );

  const billing: RowResult[] = toRows(billingSheet).map((r, i) =>
    validateBillingRow(r, i + 2),
  );

  return { clients, work, docs, billing };
}

// ─── Error report CSV download ────────────────────────────────────────────────

function downloadErrorReport(state: ImportState, fileName: string): void {
  const wb = XLSX.utils.book_new();

  const makeSheet = (label: string, items: RowResult[]) => {
    const invalid = items.filter((r) => !r.valid);
    const rows = [
      ["Sr.No.", "PAN", "Client Name", "Tax Year", "Error Reason"],
      ...invalid.map((r, i) => [
        i + 1,
        r.data.pan || "",
        r.data.name || "",
        r.data.taxYear || "",
        r.errors.join(" | "),
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), label);
  };

  makeSheet("Client Master", state.clients);
  makeSheet("Work Processing", state.work);
  makeSheet("Document Inward", state.docs);
  makeSheet("Outward & Billing", state.billing);

  XLSX.writeFile(
    wb,
    `TaxCore_ImportErrors_${fileName.replace(/[^a-z0-9]/gi, "_")}.xlsx`,
  );
}

// ─── Template download ────────────────────────────────────────────────────────

function downloadImportTemplate(): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Client Master — matches export format exactly
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [
        "Sr.No.",
        "Name",
        "PAN",
        "Head of Income",
        "Business Name",
        "Category",
        "Tax Year",
        "Due Date",
        "Client Type",
        "Mobile",
        "Email",
        "Created At",
      ],
      [
        1,
        "Rajan Mehta",
        "ABCDE1234F",
        "Salaried",
        "",
        "Individual",
        "2024-2025",
        "31-07-2025",
        "Existing",
        "9876543210",
        "rajan@example.com",
        "",
      ],
    ]),
    "Client Master",
  );

  // Sheet 2: Work Processing — matches export format exactly
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [
        "Sr.No.",
        "Client Name",
        "PAN",
        "Tax Year",
        "Return Type",
        "Work Status",
        "Filing Status",
        "ITR Form",
        "Acknowledgement Number",
        "Filing Date (auto-derived, do not edit)",
        "Due Date",
        "Remarks",
      ],
      [
        1,
        "Rajan Mehta",
        "ABCDE1234F",
        "2024-2025",
        "Original",
        "Completed",
        "Pending",
        "ITR-1",
        "",
        "",
        "31-07-2025",
        "",
      ],
    ]),
    "Work Processing",
  );

  // Sheet 3: Document Inward — matches export format exactly
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [
        "Sr.No.",
        "Client Name",
        "PAN",
        "Tax Year",
        "Document Type",
        "Received Date",
        "Remarks",
        "Status",
      ],
      [
        1,
        "Rajan Mehta",
        "ABCDE1234F",
        "2024-2025",
        "Email",
        "15-06-2025",
        "",
        "Complete",
      ],
    ]),
    "Document Inward",
  );

  // Sheet 4: Outward & Billing — matches export format exactly
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [
        "Sr.No.",
        "Client Name",
        "PAN",
        "Tax Year",
        "Bill Amount (₹)",
        "Receipt (₹)",
        "Balance (₹)",
        "Billing Date",
        "Remarks",
        "Outward Status",
      ],
      [
        1,
        "Rajan Mehta",
        "ABCDE1234F",
        "2024-2025",
        5000,
        5000,
        0,
        "",
        "",
        "Ready",
      ],
    ]),
    "Outward & Billing",
  );

  XLSX.writeFile(wb, "TaxCore_Import_Template.xlsx");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CountBadges({ rows }: { rows: RowResult[] }) {
  const valid = rows.filter((r) => r.valid).length;
  const invalid = rows.length - valid;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
        <CheckCircle2 className="w-3.5 h-3.5" /> {valid} valid
      </span>
      {invalid > 0 && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
          <XCircle className="w-3.5 h-3.5" /> {invalid} invalid
        </span>
      )}
      {rows.length === 0 && (
        <span className="text-xs text-gray-400 italic">
          No rows found in this sheet
        </span>
      )}
    </div>
  );
}

function PreviewTable({
  rows,
  columns,
}: {
  rows: RowResult[];
  columns: { key: string; label: string }[];
}) {
  const shown = rows.slice(0, 100);
  return (
    <div
      className="overflow-x-auto overflow-y-auto rounded-lg border text-xs"
      style={{ maxHeight: 320 }}
    >
      <table className="w-full min-w-max">
        <thead
          className="sticky top-0 z-10"
          style={{ background: "var(--theme-primary, #6B1A2B)" }}
        >
          <tr>
            <th
              className="text-left py-2 px-2 text-white font-medium whitespace-nowrap"
              style={{ width: 52 }}
            >
              Row
            </th>
            {columns.map((c) => (
              <th
                key={c.key}
                className="text-left py-2 px-2 text-white font-medium whitespace-nowrap"
              >
                {c.label}
              </th>
            ))}
            <th className="text-left py-2 px-2 text-white font-medium whitespace-nowrap">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr
              key={row.rowNum}
              className={`border-b last:border-0 ${
                row.valid ? "" : "bg-red-50"
              }`}
            >
              <td className="py-1.5 px-2 text-gray-400 font-mono">
                {row.rowNum}
              </td>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className="py-1.5 px-2 max-w-[120px] truncate"
                  title={row.data[c.key]}
                >
                  {row.data[c.key] || <span className="text-gray-300">—</span>}
                </td>
              ))}
              <td className="py-1.5 px-2">
                {row.valid ? (
                  <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Valid
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded-full cursor-help max-w-[200px] truncate"
                    title={row.errors.join(" | ")}
                  >
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{row.errors[0]}</span>
                  </span>
                )}
              </td>
            </tr>
          ))}
          {rows.length > 100 && (
            <tr>
              <td
                colSpan={columns.length + 2}
                className="py-2 px-3 text-center text-gray-400"
              >
                + {rows.length - 100} more rows not shown
              </td>
            </tr>
          )}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + 2}
                className="py-6 text-center text-gray-400 italic"
              >
                No data rows found in this sheet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Column definitions per section ──────────────────────────────────────────

const CLIENT_COLS = [
  { key: "name", label: "Name" },
  { key: "pan", label: "PAN" },
  { key: "headOfIncome", label: "Head of Income" },
  { key: "taxYear", label: "Tax Year" },
  { key: "dueDate", label: "Due Date" },
  { key: "mobile", label: "Mobile" },
];

const WORK_COLS = [
  { key: "name", label: "Client Name" },
  { key: "pan", label: "PAN" },
  { key: "taxYear", label: "Tax Year" },
  { key: "returnType", label: "Return Type" },
  { key: "workStatus", label: "Work Status" },
  { key: "ackNumber", label: "Ack Number" },
  { key: "filingDate", label: "Filing Date (derived)" },
  { key: "filingStatus", label: "Filing Status" },
];

const DOC_COLS = [
  { key: "name", label: "Client Name" },
  { key: "pan", label: "PAN" },
  { key: "taxYear", label: "Tax Year" },
  { key: "date", label: "Date" },
  { key: "mode", label: "Mode" },
  { key: "status", label: "Status" },
];

const BILLING_COLS = [
  { key: "name", label: "Client Name" },
  { key: "pan", label: "PAN" },
  { key: "taxYear", label: "Tax Year" },
  { key: "billAmount", label: "Bill Amount" },
  { key: "receipt", label: "Receipt" },
  { key: "outwardStatus", label: "Status" },
];

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUserName?: string;
  onImportDone: () => void;
}

export default function ExcelImportDialog({
  open,
  onClose,
  currentUserId,
  currentUserName,
  onImportDone,
}: Props) {
  const [step, setStep] = useState<ImportStatus>("upload");
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [activeTab, setActiveTab] = useState<SectionTab>("clients");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [hadErrors, setHadErrors] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(
    null,
  );

  const currentUser = storage.getCurrentUser();

  const reset = () => {
    setStep("upload");
    setImportState(null);
    setActiveTab("clients");
    setFileName("");
    setHadErrors(false);
    setImportMode("merge");
    setImportSummary(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const existing = storage.getClients();
      const state = parseWorkbook(wb, existing);
      setImportState(state);
      setStep("preview");
    } catch (err) {
      console.error(err);
      toast.error("Failed to parse file. Please use the provided template.");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importState) return;
    setLoading(true);
    const currentFirmId = currentUser?.firmId ?? currentUser?.id ?? "";

    try {
      const now = new Date().toISOString();
      const allClients = storage.getClients();
      const allWork = storage.getWork();
      const allDocs = storage.getDocuments();
      const allBilling = storage.getBilling();

      // ── Trial limit check ─────────────────────────────────────────────────
      const user = storage.getUsers().find((u) => u.id === currentUserId);
      const isTrialUser = user?.accessType === "Trial" || !user?.accessType;
      const trialLimit = 5;
      const currentClientCount = allClients.filter(
        (c) => c.createdBy === currentUserId,
      ).length;

      // ── 1. Import valid clients ────────────────────────────────────────────
      const validClientRows = importState.clients.filter((r) => r.valid);
      const newClients: Client[] = [];
      const mergedClients: Client[] = []; // track updated existing clients
      let trialBlockedCount = 0;
      let clientsMergedCount = 0;
      let clientsReplacedCount = 0;

      // Map PAN+TaxYear → clientId for cross-referencing
      const panYearToId = new Map<string, string>();
      // We'll also collect the updated full clients array
      let updatedClientsList: Client[] = [...allClients];

      for (const row of validClientRows) {
        const {
          name,
          pan,
          headOfIncome,
          businessName,
          taxYear,
          dueDate,
          clientType,
          mobile,
          email,
        } = row.data;

        const existingIdx = updatedClientsList.findIndex(
          (c) => c.pan.toUpperCase() === pan && c.taxYear === taxYear,
        );

        if (existingIdx !== -1) {
          // Existing client — merge or replace
          const existing = updatedClientsList[existingIdx];
          panYearToId.set(`${pan}|${taxYear}`, existing.id);

          if (importMode === "merge") {
            // Only update non-empty fields from the import row
            const merged: Client = { ...existing };
            if (name) merged.name = name;
            if (mobile) merged.mobile = mobile;
            if (email && email !== "-") merged.email = email;
            if (headOfIncome)
              merged.headOfIncome = headOfIncome as Client["headOfIncome"];
            if (businessName && headOfIncome === "Business")
              merged.businessName = businessName;
            if (dueDate && dueDate !== "-") merged.dueDate = dueDate;
            if (clientType)
              merged.clientType = clientType as Client["clientType"];
            merged.clientCategory = getPanCategory(pan);
            updatedClientsList[existingIdx] = merged;
            mergedClients.push(merged);
            clientsMergedCount++;
          } else {
            // Replace — fully overwrite, preserve id, createdAt, createdBy
            const replaced: Client = {
              id: existing.id,
              createdAt: existing.createdAt,
              createdBy: existing.createdBy,
              firmId: existing.firmId ?? currentFirmId,
              name,
              pan,
              mobile: mobile || "",
              email: email === "-" ? "" : email,
              clientType: (clientType as "Existing" | "New") || "Existing",
              headOfIncome:
                (headOfIncome as Client["headOfIncome"]) || "Salaried",
              businessName: headOfIncome === "Business" ? businessName : "",
              taxYear,
              dueDate: dueDate === "-" ? "" : dueDate,
              clientCategory: getPanCategory(pan),
            };
            updatedClientsList[existingIdx] = replaced;
            mergedClients.push(replaced);
            clientsReplacedCount++;
          }
        } else {
          // New client — check trial limit
          if (
            isTrialUser &&
            currentClientCount + newClients.length >= trialLimit
          ) {
            trialBlockedCount++;
            continue;
          }
          const clientId = `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
          panYearToId.set(`${pan}|${taxYear}`, clientId);
          const newClient: Client = {
            id: clientId,
            name,
            pan,
            mobile: mobile || "",
            email: email === "-" ? "" : email,
            clientType: (clientType as "Existing" | "New") || "Existing",
            headOfIncome:
              (headOfIncome as Client["headOfIncome"]) || "Salaried",
            businessName: headOfIncome === "Business" ? businessName : "",
            taxYear,
            dueDate: dueDate === "-" ? "" : dueDate,
            clientCategory: getPanCategory(pan),
            createdAt: now,
            createdBy: currentUserId,
            firmId: currentFirmId,
          };
          newClients.push(newClient);
          updatedClientsList = [...updatedClientsList, newClient];
        }
      }

      // ── 2. Import valid work processing rows ───────────────────────────────
      const validWorkRows = importState.work.filter((r) => r.valid);
      const newWorkRecords: WorkProcessing[] = [];
      const updatedWork: WorkProcessing[] = [...allWork];
      const importedWorkKeys = new Set<string>();

      for (const row of validWorkRows) {
        const {
          pan,
          taxYear: wpTaxYear,
          workStatus,
          returnType,
          itrForm,
          ackNumber,
          filingDate,
          filingStatus,
          remark,
        } = row.data;
        const taxYear = wpTaxYear;
        let clientId = panYearToId.get(`${pan}|${taxYear}`);
        if (!clientId) {
          const match = allClients.find(
            (c) => c.pan.toUpperCase() === pan && c.taxYear === taxYear,
          );
          if (match) clientId = match.id;
        }
        if (!clientId) continue;

        const wpKey = `${pan}|${taxYear}`;
        importedWorkKeys.add(wpKey);

        const existingWp = updatedWork.find((w) => w.clientId === clientId);
        const eVerified = filingStatus === "E-Verified";

        if (existingWp) {
          const idx = updatedWork.indexOf(existingWp);
          updatedWork[idx] = {
            ...existingWp,
            status: workStatus as WorkProcessing["status"],
            itrForm: itrForm || "",
            returnType:
              (returnType as WorkProcessing["returnType"]) || undefined,
            ackNumber: ackNumber || "",
            filingDate: filingDate || "",
            filingStatus: filingStatus as WorkProcessing["filingStatus"],
            eVerified,
            remark: remark && remark !== "-" ? remark : existingWp.remark,
            updatedAt: now,
          };
        } else {
          newWorkRecords.push({
            id: `imp_wp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
            clientId,
            taxYear,
            status: workStatus as WorkProcessing["status"],
            itrForm: itrForm || "",
            returnType:
              (returnType as WorkProcessing["returnType"]) || undefined,
            ackNumber: ackNumber || "",
            filingDate: filingDate || "",
            filingStatus:
              (filingStatus as WorkProcessing["filingStatus"]) || "Pending",
            eVerified,
            remark: remark && remark !== "-" ? remark : "",
            updatedAt: now,
          });
        }
      }

      // Auto-create work records for new clients that had no work row imported
      for (const c of newClients) {
        const key = `${c.pan}|${c.taxYear}`;
        const alreadyHasWork =
          importedWorkKeys.has(key) ||
          updatedWork.some((w) => w.clientId === c.id);
        if (!alreadyHasWork) {
          newWorkRecords.push({
            id: `imp_awp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
            clientId: c.id,
            taxYear: c.taxYear,
            status: "Pending",
            itrForm: "",
            ackNumber: "",
            filingDate: "",
            filingStatus: "Pending",
            eVerified: false,
            remark: "",
            updatedAt: now,
          });
        }
      }

      // ── 3. Import valid document inward rows ───────────────────────────────
      const validDocRows = importState.docs.filter((r) => r.valid);
      const newDocs: DocumentInward[] = [];

      for (const row of validDocRows) {
        const {
          pan,
          taxYear: docTaxYear,
          date,
          mode,
          status,
          remarks,
        } = row.data;
        let clientId = panYearToId.get(`${pan}|${docTaxYear}`);
        if (!clientId && docTaxYear) {
          const match = allClients.find(
            (c) => c.pan.toUpperCase() === pan && c.taxYear === docTaxYear,
          );
          if (match) clientId = match.id;
        }
        if (!clientId) {
          clientId = panYearToId.get(
            [...panYearToId.keys()].find((k) => k.startsWith(`${pan}|`)) || "",
          );
        }
        if (!clientId) {
          const match = allClients.find((c) => c.pan.toUpperCase() === pan);
          if (match) clientId = match.id;
        }
        if (!clientId) continue;

        newDocs.push({
          id: `imp_doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
          clientId,
          date,
          mode: mode as DocumentInward["mode"],
          status: status as DocumentInward["status"],
          remarks: remarks === "-" ? "" : remarks,
          createdAt: now,
          firmId: currentFirmId,
        });
      }

      // ── 4. Import valid billing rows ───────────────────────────────────────
      const validBillingRows = importState.billing.filter((r) => r.valid);
      const newBillingRecords: Billing[] = [];
      const updatedBilling: Billing[] = [...allBilling];

      for (const row of validBillingRows) {
        const { pan, taxYear, billAmount, receipt, balance, outwardStatus } =
          row.data;
        let clientId = panYearToId.get(`${pan}|${taxYear}`);
        if (!clientId) {
          const match = allClients.find(
            (c) => c.pan.toUpperCase() === pan && c.taxYear === taxYear,
          );
          if (match) clientId = match.id;
        }
        if (!clientId) continue;

        const existingBill = updatedBilling.find(
          (b) => b.clientId === clientId,
        );
        if (existingBill) {
          const idx = updatedBilling.indexOf(existingBill);
          updatedBilling[idx] = {
            ...existingBill,
            billAmount: Number(billAmount) || 0,
            receipt: Number(receipt) || 0,
            balance: Number(balance) || 0,
            outwardStatus: outwardStatus as Billing["outwardStatus"],
            updatedAt: now,
          };
        } else {
          newBillingRecords.push({
            id: `imp_bill_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
            clientId,
            taxYear,
            billAmount: Number(billAmount) || 0,
            receipt: Number(receipt) || 0,
            balance: Number(balance) || 0,
            outwardStatus: outwardStatus as Billing["outwardStatus"],
            updatedAt: now,
          });
        }
      }

      // ── 5. Persist all ────────────────────────────────────────────────────
      // updatedClientsList already contains: original clients + merged/replaced + new
      const finalWork = [...updatedWork, ...newWorkRecords];
      const finalDocs = [...allDocs, ...newDocs];
      const finalBilling = [...updatedBilling, ...newBillingRecords];

      storage.saveClients(updatedClientsList);
      storage.saveWork(finalWork);
      storage.saveDocuments(finalDocs);
      storage.saveBilling(finalBilling);

      // Audit log
      const usersList = storage.getUsers();
      const userName =
        currentUserName ??
        usersList.find((u) => u.id === currentUserId)?.name ??
        "Unknown";
      const modeLabel = importMode === "merge" ? "Merge mode" : "Replace mode";
      const invalidClientRows = importState.clients.filter(
        (r) => !r.valid,
      ).length;
      storage.addAuditLog({
        id: storage.uid(),
        userId: currentUserId,
        userName,
        userRole: currentUser?.role,
        action: `Excel Import (${modeLabel})`,
        clientId: "BULK",
        clientName: "Excel Import",
        fieldChanged: "Import",
        oldValue: "-",
        newValue: `Mode: ${modeLabel}. Clients: ${newClients.length} added, ${clientsMergedCount} merged, ${clientsReplacedCount} replaced, ${invalidClientRows + trialBlockedCount} skipped. Work: ${newWorkRecords.length} imported. Docs: ${newDocs.length} imported. Billing: ${newBillingRecords.length} imported.`,
        timestamp: now,
      });

      // ── Save import history entry ─────────────────────────────────────────
      const changedWorkRecords: WorkProcessing[] = [];
      for (const row of validWorkRows) {
        const { pan, taxYear: wpTaxYear } = row.data;
        let cid = panYearToId.get(`${pan}|${wpTaxYear}`);
        if (!cid) {
          const match = allClients.find(
            (c) => c.pan.toUpperCase() === pan && c.taxYear === wpTaxYear,
          );
          if (match) cid = match.id;
        }
        if (!cid) continue;
        const wp = finalWork.find((w) => w.clientId === cid);
        if (wp) changedWorkRecords.push(wp);
      }
      const changedBillingRecords: Billing[] = [];
      for (const row of validBillingRows) {
        const { pan, taxYear } = row.data;
        let cid = panYearToId.get(`${pan}|${taxYear}`);
        if (!cid) {
          const match = allClients.find(
            (c) => c.pan.toUpperCase() === pan && c.taxYear === taxYear,
          );
          if (match) cid = match.id;
        }
        if (!cid) continue;
        const bill = finalBilling.find((b) => b.clientId === cid);
        if (bill) changedBillingRecords.push(bill);
      }

      const importHistoryEntry: ImportHistoryEntry = {
        id: `ih_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
        importedAt: now,
        mode: importMode === "merge" ? "Merge" : "Replace",
        importedBy: userName,
        tabCounts: {
          clients: {
            added: newClients.length,
            updated: clientsMergedCount + clientsReplacedCount,
            skipped: invalidClientRows + trialBlockedCount,
          },
          workProcessing: {
            added: newWorkRecords.filter(
              (w) => w.id.startsWith("imp_wp_") || w.id.startsWith("imp_awp_"),
            ).length,
            updated:
              validWorkRows.length -
              newWorkRecords.filter(
                (w) =>
                  w.id.startsWith("imp_wp_") || w.id.startsWith("imp_awp_"),
              ).length,
            skipped: importState.work.filter((r) => !r.valid).length,
          },
          documentInward: {
            added: newDocs.length,
            updated: 0,
            skipped: importState.docs.filter((r) => !r.valid).length,
          },
          billing: {
            added: newBillingRecords.length,
            updated: validBillingRows.length - newBillingRecords.length,
            skipped: importState.billing.filter((r) => !r.valid).length,
          },
        },
        changedRows: {
          clients: [...newClients, ...mergedClients],
          workProcessing: changedWorkRecords,
          documentInward: newDocs,
          billing: changedBillingRecords,
        },
      };
      await saveImportHistory(importHistoryEntry);

      await forceSyncToCanister();

      const anyErrors =
        importState.clients.some((r) => !r.valid) ||
        importState.work.some((r) => !r.valid) ||
        importState.docs.some((r) => !r.valid) ||
        importState.billing.some((r) => !r.valid);

      setHadErrors(anyErrors);
      setImportSummary({
        added: newClients.length,
        merged: clientsMergedCount,
        replaced: clientsReplacedCount,
        skipped: invalidClientRows + trialBlockedCount,
      });
      setStep("done");
      onImportDone();

      toast.success(
        `Import complete (${modeLabel}): ${newClients.length} added, ${clientsMergedCount + clientsReplacedCount} updated, ${newWorkRecords.length} work records, ${newDocs.length} documents.`,
      );
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Import failed. Please check the file and try again.");
    } finally {
      setLoading(false);
    }
  };

  const totalValid =
    (importState?.clients.filter((r) => r.valid).length ?? 0) +
    (importState?.work.filter((r) => r.valid).length ?? 0) +
    (importState?.docs.filter((r) => r.valid).length ?? 0) +
    (importState?.billing.filter((r) => r.valid).length ?? 0);

  const totalInvalid =
    (importState?.clients.filter((r) => !r.valid).length ?? 0) +
    (importState?.work.filter((r) => !r.valid).length ?? 0) +
    (importState?.docs.filter((r) => !r.valid).length ?? 0) +
    (importState?.billing.filter((r) => !r.valid).length ?? 0);

  const activeRows =
    activeTab === "clients"
      ? (importState?.clients ?? [])
      : activeTab === "work"
        ? (importState?.work ?? [])
        : activeTab === "docs"
          ? (importState?.docs ?? [])
          : (importState?.billing ?? []);

  const activeCols =
    activeTab === "clients"
      ? CLIENT_COLS
      : activeTab === "work"
        ? WORK_COLS
        : activeTab === "docs"
          ? DOC_COLS
          : BILLING_COLS;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent
        className="max-w-4xl w-full max-h-[92vh] overflow-y-auto"
        data-ocid="clients.import.dialog"
      >
        <DialogHeader>
          <DialogTitle style={{ color: "var(--theme-primary, #6B1A2B)" }}>
            Import Data from Excel
          </DialogTitle>
        </DialogHeader>

        {/* ─── Upload step ─────────────────────────────────────────────────── */}
        {step === "upload" && (
          <div className="space-y-5 mt-2">
            <div
              className="rounded-lg border p-4"
              style={{
                background: "rgba(107,26,43,0.04)",
                borderColor: "rgba(107,26,43,0.18)",
              }}
            >
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--theme-primary, #6B1A2B)" }}
              >
                Step 1 — Download Template
              </p>
              <p className="text-xs text-gray-500 mb-3">
                Download the import template (4 sheets: Client Master, Work
                Processing, Document Inward, Outward &amp; Billing). You can
                copy rows directly from any exported TaxCore Excel file — the
                column order matches exactly.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={downloadImportTemplate}
                className="gap-1.5"
                style={{
                  borderColor: "var(--theme-primary, #6B1A2B)",
                  color: "var(--theme-primary, #6B1A2B)",
                }}
                data-ocid="clients.import.download_template_button"
              >
                <FileDown className="w-4 h-4" /> Download Template (.xlsx)
              </Button>
            </div>

            <div
              className="rounded-lg border-2 border-dashed p-8 text-center"
              style={{ borderColor: "rgba(107,26,43,0.25)" }}
            >
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--theme-primary, #6B1A2B)" }}
              >
                Step 2 — Upload Your Filled File
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Accepts .xlsx or .xls files · All 4 sheets processed together
              </p>
              <label className="cursor-pointer inline-block">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  data-ocid="clients.import.upload_button"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    await handleFile(file);
                    e.target.value = "";
                  }}
                />
                <div
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer"
                  style={{ background: "var(--theme-primary, #6B1A2B)" }}
                >
                  <Upload className="w-4 h-4" />
                  {loading ? "Parsing file…" : "Choose Excel File"}
                </div>
              </label>
            </div>
          </div>
        )}

        {/* ─── Mode selector step ──────────────────────────────────────── */}
        {step === "mode" && (
          <div className="space-y-5 mt-2">
            <div
              className="rounded-lg border px-4 py-3"
              style={{
                background: "rgba(107,26,43,0.04)",
                borderColor: "rgba(107,26,43,0.18)",
              }}
            >
              <p className="text-xs text-gray-500">
                File:{" "}
                <span className="font-medium text-gray-700">{fileName}</span>
              </p>
            </div>

            <div>
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--theme-primary, #6B1A2B)" }}
              >
                How should existing clients be handled?
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Choose what happens when an imported row matches a client (same
                PAN + Tax Year) that already exists in your system.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Merge card */}
                <button
                  type="button"
                  onClick={() => setImportMode("merge")}
                  data-ocid="clients.import.mode.merge"
                  className={`relative text-left rounded-xl border-2 p-4 transition-all cursor-pointer ${
                    importMode === "merge"
                      ? "border-current shadow-md"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  style={
                    importMode === "merge"
                      ? {
                          borderColor: "var(--theme-primary, #6B1A2B)",
                          background: "rgba(107,26,43,0.04)",
                        }
                      : {}
                  }
                >
                  {importMode === "merge" && (
                    <span
                      className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: "var(--theme-primary, #6B1A2B)" }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </span>
                  )}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: "rgba(107,26,43,0.10)" }}
                  >
                    <GitMerge
                      className="w-5 h-5"
                      style={{ color: "var(--theme-primary, #6B1A2B)" }}
                    />
                  </div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">
                    Merge
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Update only the fields provided in the import file. Existing
                    fields not in the file stay as-is.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700 font-medium">
                      Safe — no data loss
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                      Recommended
                    </span>
                  </div>
                </button>

                {/* Replace card */}
                <button
                  type="button"
                  onClick={() => setImportMode("replace")}
                  data-ocid="clients.import.mode.replace"
                  className={`relative text-left rounded-xl border-2 p-4 transition-all cursor-pointer ${
                    importMode === "replace"
                      ? "border-current shadow-md"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  style={
                    importMode === "replace"
                      ? {
                          borderColor: "var(--theme-primary, #6B1A2B)",
                          background: "rgba(107,26,43,0.04)",
                        }
                      : {}
                  }
                >
                  {importMode === "replace" && (
                    <span
                      className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: "var(--theme-primary, #6B1A2B)" }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </span>
                  )}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: "rgba(239,68,68,0.08)" }}
                  >
                    <RefreshCw className="w-5 h-5 text-red-500" />
                  </div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">
                    Replace
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Fully overwrite the existing client record with the imported
                    data. All previous field values are replaced.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-medium">
                      Overwrites existing data
                    </span>
                  </div>
                </button>
              </div>

              <p className="text-[11px] text-gray-400 mt-3">
                <span className="font-medium">Note:</span> New clients (no PAN
                match) are always added. Work Processing, Document Inward, and
                Billing records follow their own update logic regardless of this
                setting.
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => setStep("preview")}
                className="flex-1"
                data-ocid="clients.import.mode_back_button"
              >
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={loading}
                style={{ background: "var(--theme-primary, #6B1A2B)" }}
                className="text-white flex-1"
                data-ocid="clients.import.mode_confirm_button"
              >
                {loading
                  ? "Importing…"
                  : importMode === "merge"
                    ? "Import with Merge"
                    : "Import with Replace"}
              </Button>
            </div>
          </div>
        )}

        {/* ─── Preview step ────────────────────────────────────────────────── */}
        {step === "preview" && importState && (
          <div className="space-y-4 mt-2">
            {/* Summary */}
            <div className="flex items-center gap-3 flex-wrap text-sm">
              <span className="font-medium text-gray-600">
                File: {fileName}
              </span>
              <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> {totalValid} valid rows
              </span>
              {totalInvalid > 0 && (
                <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full text-xs font-medium">
                  <XCircle className="w-3.5 h-3.5" /> {totalInvalid} invalid
                  rows
                </span>
              )}
            </div>

            {/* Section tabs */}
            <div className="flex gap-1 flex-wrap border-b">
              {(["clients", "work", "docs", "billing"] as SectionTab[]).map(
                (tab) => {
                  const rows =
                    tab === "clients"
                      ? importState.clients
                      : tab === "work"
                        ? importState.work
                        : tab === "docs"
                          ? importState.docs
                          : importState.billing;
                  const inv = rows.filter((r) => !r.valid).length;
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      data-ocid={`clients.import.tab.${tab}`}
                      className={`px-3 py-2 text-xs font-medium rounded-t border-b-2 transition-colors ${
                        isActive
                          ? "border-current"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                      style={
                        isActive
                          ? {
                              color: "var(--theme-primary, #6B1A2B)",
                              borderColor: "var(--theme-primary, #6B1A2B)",
                            }
                          : {}
                      }
                    >
                      {SECTION_LABELS[tab]}
                      <span className="ml-1.5 text-xs">({rows.length})</span>
                      {inv > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold">
                          {inv}
                        </span>
                      )}
                    </button>
                  );
                },
              )}
            </div>

            {/* Active section: count badges + table */}
            <CountBadges rows={activeRows} />
            <PreviewTable rows={activeRows} columns={activeCols} />

            {/* Error list for active section */}
            {activeRows.some((r) => !r.valid) && (
              <div className="rounded-lg border border-red-200 p-3 bg-red-50 space-y-1">
                <p className="text-xs font-semibold text-red-700 mb-1">
                  Validation Errors in {SECTION_LABELS[activeTab]}:
                </p>
                {activeRows
                  .filter((r) => !r.valid)
                  .slice(0, 10)
                  .map((r) => (
                    <p key={r.rowNum} className="text-xs text-red-600">
                      <span className="font-medium">Row {r.rowNum}:</span>{" "}
                      {r.errors.join("; ")}
                    </p>
                  ))}
                {activeRows.filter((r) => !r.valid).length > 10 && (
                  <p className="text-xs text-red-400">
                    …and {activeRows.filter((r) => !r.valid).length - 10} more
                    errors
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setImportState(null);
                  setFileName("");
                }}
                className="flex-1"
                data-ocid="clients.import.cancel_button"
              >
                Back
              </Button>
              <Button
                disabled={totalValid === 0 || loading}
                onClick={() => setStep("mode")}
                style={{ background: "var(--theme-primary, #6B1A2B)" }}
                className="text-white flex-1"
                data-ocid="clients.import.confirm_button"
              >
                {`Review ${totalValid} Valid Row${totalValid !== 1 ? "s" : ""} →`}
              </Button>
            </div>
          </div>
        )}

        {/* ─── Done step ───────────────────────────────────────────────────── */}
        {step === "done" && (
          <div className="space-y-5 mt-2">
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <p
                className="text-base font-semibold"
                style={{ color: "var(--theme-primary, #6B1A2B)" }}
              >
                Import Completed Successfully
              </p>
              <p className="text-xs text-gray-400">
                Mode:{" "}
                <span className="font-semibold text-gray-600">
                  {importMode === "merge" ? "Merge" : "Replace"}
                </span>
              </p>
            </div>

            {/* Client summary grid */}
            {importSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div
                  className="rounded-lg border text-center p-3"
                  style={{
                    borderColor: "rgba(107,26,43,0.15)",
                    background: "rgba(107,26,43,0.03)",
                  }}
                >
                  <p
                    className="text-xl font-bold"
                    style={{ color: "var(--theme-primary, #6B1A2B)" }}
                  >
                    {importSummary.added}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                    New Clients Added
                  </p>
                </div>
                <div className="rounded-lg border text-center p-3 border-blue-100 bg-blue-50">
                  <p className="text-xl font-bold text-blue-700">
                    {importSummary.merged}
                  </p>
                  <p className="text-[11px] text-blue-500 mt-0.5 font-medium">
                    Clients Merged
                  </p>
                </div>
                <div className="rounded-lg border text-center p-3 border-amber-100 bg-amber-50">
                  <p className="text-xl font-bold text-amber-700">
                    {importSummary.replaced}
                  </p>
                  <p className="text-[11px] text-amber-500 mt-0.5 font-medium">
                    Clients Replaced
                  </p>
                </div>
                <div className="rounded-lg border text-center p-3 border-gray-100 bg-gray-50">
                  <p className="text-xl font-bold text-gray-500">
                    {importSummary.skipped}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                    Invalid / Skipped
                  </p>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 text-center">
              The dashboard and client list reflect the new data immediately.
            </p>

            <div className="flex gap-3 justify-center">
              {hadErrors && importState && (
                <Button
                  variant="outline"
                  onClick={() => downloadErrorReport(importState, fileName)}
                  className="gap-2"
                  style={{
                    borderColor: "var(--theme-primary, #6B1A2B)",
                    color: "var(--theme-primary, #6B1A2B)",
                  }}
                  data-ocid="clients.import.error_report_button"
                >
                  <Download className="w-4 h-4" /> Download Error Report
                </Button>
              )}
              <Button
                onClick={handleClose}
                style={{ background: "var(--theme-primary, #6B1A2B)" }}
                className="text-white"
                data-ocid="clients.import.close_button"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
