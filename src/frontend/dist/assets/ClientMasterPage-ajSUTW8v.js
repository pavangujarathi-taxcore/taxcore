import { f as createLucideIcon, r as reactExports, s as storage, j as jsxRuntimeExports, D as Dialog, p as DialogContent, t as DialogHeader, v as DialogTitle, B as Button, R as RefreshCw, x as Download, u as ue, m as getPanCategory, y as saveImportHistory, z as forceSyncToCanister, A as getDueAlertClients, o as onStorageChange, X, F as Bell, I as Input, G as getDaysUntilDue, l as getLatestDocStatus, k as getClientWork, H as getHeadOfIncome, b as Eye, L as Label, J as tombstoneDeletedClients, n as getLatestDoc } from "./index-D5ov2zgF.js";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-BIhiYm88.js";
import { D as DatePickerInput } from "./DatePickerInput-IINpEjCQ.js";
import { F as FileDown, G as GitMerge, r as readSync, u as utils, w as writeFileSync } from "./xlsx-CJhT2rDE.js";
import { C as CircleCheck, a as CircleAlert } from "./circle-check-1FCMYPAZ.js";
import { C as CircleX } from "./circle-x-DLvMQXF9.js";
import { T as TriangleAlert, I as InlineStatusCell } from "./InlineStatusCell-DMk8gU4c.js";
import { a as getCurrentTaxYear, g as getTaxYears } from "./taxYears-JUInSDi_.js";
import { S as Search } from "./search-DL00bT8o.js";
import { P as Plus } from "./plus-CzTznfEj.js";
import { P as Pen } from "./pen-B6N4mabi.js";
import { T as Trash2 } from "./trash-2-B5b0TUJR.js";
import "./index-C_NlLzNf.js";
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  ["path", { d: "M12 3v12", key: "1x0j5s" }],
  ["path", { d: "m17 8-5-5-5 5", key: "7q97r8" }],
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }]
];
const Upload = createLucideIcon("upload", __iconNode);
const SECTION_LABELS = {
  clients: "Client Master",
  work: "Work Processing",
  docs: "Document Inward",
  billing: "Outward & Billing"
};
const col = (row, i) => {
  const v = row[i];
  return v == null ? "" : String(v).trim();
};
const isValidPan = (pan) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);
const isValidDate = (d) => /^\d{2}-\d{2}-\d{4}$/.test(d);
const isValidEmail = (e) => /^[^@]+@[^@]+\.[^@]+$/.test(e);
function deriveFilingDateFromAck(ack) {
  if (ack.length !== 15) return null;
  const last6 = ack.slice(9, 15);
  const dd = last6.slice(0, 2);
  const mm = last6.slice(2, 4);
  const yy = last6.slice(4, 6);
  const yyyy = `20${yy}`;
  const d = Number(dd);
  const m = Number(mm);
  const y = Number(yyyy);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2e3 || y > 2099) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d)
    return null;
  return `${dd}-${mm}-${yyyy}`;
}
function isAfterTaxYearEnd(dateStr, taxYear) {
  if (!isValidDate(dateStr) || !/^\d{4}-\d{4}$/.test(taxYear)) return false;
  const endYear = Number(taxYear.split("-")[1]);
  const [dd, mm, yyyy] = dateStr.split("-").map(Number);
  const dt = new Date(yyyy, mm - 1, dd);
  const taxEnd = new Date(endYear, 2, 31);
  return dt > taxEnd;
}
function getSheet(wb, preferredName, fallbackIndex) {
  if (wb.Sheets[preferredName]) return wb.Sheets[preferredName];
  const match = wb.SheetNames.find(
    (n) => n.toLowerCase().trim() === preferredName.toLowerCase()
  );
  if (match) return wb.Sheets[match];
  if (wb.SheetNames[fallbackIndex])
    return wb.Sheets[wb.SheetNames[fallbackIndex]];
  return null;
}
function validateClientRow(raw, rowNum, existingClients, importedSoFar) {
  const offset = raw[0] != null && !Number.isNaN(Number(raw[0])) && String(raw[0]).trim() !== "" ? 1 : 0;
  const name = col(raw, offset);
  const pan = col(raw, offset + 1).toUpperCase();
  const headOfIncome = col(raw, offset + 2) || "Salaried";
  const businessName = col(raw, offset + 3);
  const taxYear = col(raw, offset + 5);
  const dueDate = col(raw, offset + 6);
  const clientType = col(raw, offset + 7) || "Existing";
  const mobile = col(raw, offset + 8).replace(/\D/g, "");
  const email = col(raw, offset + 9);
  const errors = [];
  if (!name) errors.push("Name is required");
  if (!pan || !isValidPan(pan))
    errors.push("PAN must be 10 chars (AAAAA9999A format)");
  if (!taxYear || !/^\d{4}-\d{4}$/.test(taxYear))
    errors.push("Tax Year must be YYYY-YYYY");
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
  const dupInSystem = existingClients.some(
    (c) => c.pan.toUpperCase() === pan && c.taxYear === taxYear
  );
  const dupInFile = importedSoFar.has(key);
  if (dupInFile && errors.length === 0) {
    errors.push(
      "Duplicate in file: same PAN + Tax Year appears more than once"
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
      email
    },
    valid: errors.length === 0,
    errors,
    duplicate: dupInSystem
  };
}
function validateWorkRow(raw, rowNum) {
  const offset = raw[0] != null && !Number.isNaN(Number(raw[0])) && String(raw[0]).trim() !== "" ? 1 : 0;
  const name = col(raw, offset);
  const pan = col(raw, offset + 1).toUpperCase();
  const taxYear = col(raw, offset + 2);
  const returnType = col(raw, offset + 3);
  let workStatus = col(raw, offset + 4) || "Pending";
  const filingStatusRaw = col(raw, offset + 5);
  const itrForm = col(raw, offset + 6);
  const ackNumber = col(raw, offset + 7).replace(/\D/g, "");
  const remark = col(raw, offset + 10);
  if (workStatus === "Filed") workStatus = "Completed";
  const errors = [];
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
  let filingDate = "";
  let filingStatus = "Pending";
  if (ackNumber && ackNumber.length === 15) {
    const derived = deriveFilingDateFromAck(ackNumber);
    if (derived) {
      if (taxYear && !isAfterTaxYearEnd(derived, taxYear)) {
        const endYear = Number(taxYear.split("-")[1]);
        errors.push(
          `Filing Date ${derived} derived from Ack is not after 31-03-${endYear}`
        );
      } else {
        filingDate = derived;
        filingStatus = filingStatusRaw === "E-Verified" ? "E-Verified" : "Pending for E-verification";
      }
    } else {
      errors.push(
        "Cannot derive Filing Date from Acknowledgement Number digits"
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
      remark
    },
    valid: errors.length === 0,
    errors
  };
}
function validateDocRow(raw, rowNum) {
  const offset = raw[0] != null && !Number.isNaN(Number(raw[0])) && String(raw[0]).trim() !== "" ? 1 : 0;
  const name = col(raw, offset);
  const pan = col(raw, offset + 1).toUpperCase();
  const taxYear = col(raw, offset + 2);
  const mode = col(raw, offset + 3);
  const date = col(raw, offset + 4);
  const remarks = col(raw, offset + 5);
  const status = col(raw, offset + 6);
  const errors = [];
  if (!name) errors.push("Client Name is required");
  if (!pan || !isValidPan(pan)) errors.push("PAN must be 10 chars");
  if (!date || !isValidDate(date)) errors.push("Date must be DD-MM-YYYY");
  else {
    const [dd, mm, yyyy] = date.split("-").map(Number);
    const dt = new Date(yyyy, mm - 1, dd);
    if (dt > /* @__PURE__ */ new Date()) errors.push("Date cannot be in the future");
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
    errors
  };
}
function validateBillingRow(raw, rowNum) {
  const offset = raw[0] != null && !Number.isNaN(Number(raw[0])) && String(raw[0]).trim() !== "" ? 1 : 0;
  const name = col(raw, offset);
  const pan = col(raw, offset + 1).toUpperCase();
  const taxYear = col(raw, offset + 2);
  const billAmountRaw = col(raw, offset + 3).replace(/[^\d.]/g, "");
  const receiptRaw = col(raw, offset + 4).replace(/[^\d.]/g, "");
  const outwardStatus = col(raw, offset + 8) || "Pending";
  const errors = [];
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
      outwardStatus
    },
    valid: errors.length === 0,
    errors
  };
}
function parseWorkbook(wb, existingClients) {
  const toRows = (ws) => {
    if (!ws) return [];
    return utils.sheet_to_json(ws, {
      header: 1
    }).slice(1).filter((r) => r == null ? void 0 : r.some((c) => c != null && String(c).trim() !== ""));
  };
  const clientSheet = getSheet(wb, "Client Master", 0);
  const workSheet = getSheet(wb, "Work Processing", 1);
  const docSheet = getSheet(wb, "Document Inward", 2);
  const billingSheet = getSheet(wb, "Outward & Billing", 3);
  const clientRaws = toRows(clientSheet);
  const seenPanYear = /* @__PURE__ */ new Set();
  const clients = clientRaws.map((r, i) => {
    const result = validateClientRow(r, i + 2, existingClients, seenPanYear);
    if (result.valid)
      seenPanYear.add(`${result.data.pan}|${result.data.taxYear}`);
    return result;
  });
  const work = toRows(workSheet).map(
    (r, i) => validateWorkRow(r, i + 2)
  );
  const docs = toRows(docSheet).map(
    (r, i) => validateDocRow(r, i + 2)
  );
  const billing = toRows(billingSheet).map(
    (r, i) => validateBillingRow(r, i + 2)
  );
  return { clients, work, docs, billing };
}
function downloadErrorReport(state, fileName) {
  const wb = utils.book_new();
  const makeSheet = (label, items) => {
    const invalid = items.filter((r) => !r.valid);
    const rows = [
      ["Sr.No.", "PAN", "Client Name", "Tax Year", "Error Reason"],
      ...invalid.map((r, i) => [
        i + 1,
        r.data.pan || "",
        r.data.name || "",
        r.data.taxYear || "",
        r.errors.join(" | ")
      ])
    ];
    utils.book_append_sheet(wb, utils.aoa_to_sheet(rows), label);
  };
  makeSheet("Client Master", state.clients);
  makeSheet("Work Processing", state.work);
  makeSheet("Document Inward", state.docs);
  makeSheet("Outward & Billing", state.billing);
  writeFileSync(
    wb,
    `TaxCore_ImportErrors_${fileName.replace(/[^a-z0-9]/gi, "_")}.xlsx`
  );
}
function downloadImportTemplate() {
  const wb = utils.book_new();
  utils.book_append_sheet(
    wb,
    utils.aoa_to_sheet([
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
        "Created At"
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
        ""
      ]
    ]),
    "Client Master"
  );
  utils.book_append_sheet(
    wb,
    utils.aoa_to_sheet([
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
        "Remarks"
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
        ""
      ]
    ]),
    "Work Processing"
  );
  utils.book_append_sheet(
    wb,
    utils.aoa_to_sheet([
      [
        "Sr.No.",
        "Client Name",
        "PAN",
        "Tax Year",
        "Document Type",
        "Received Date",
        "Remarks",
        "Status"
      ],
      [
        1,
        "Rajan Mehta",
        "ABCDE1234F",
        "2024-2025",
        "Email",
        "15-06-2025",
        "",
        "Complete"
      ]
    ]),
    "Document Inward"
  );
  utils.book_append_sheet(
    wb,
    utils.aoa_to_sheet([
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
        "Outward Status"
      ],
      [
        1,
        "Rajan Mehta",
        "ABCDE1234F",
        "2024-2025",
        5e3,
        5e3,
        0,
        "",
        "",
        "Ready"
      ]
    ]),
    "Outward & Billing"
  );
  writeFileSync(wb, "TaxCore_Import_Template.xlsx");
}
function CountBadges({ rows }) {
  const valid = rows.filter((r) => r.valid).length;
  const invalid = rows.length - valid;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "w-3.5 h-3.5" }),
      " ",
      valid,
      " valid"
    ] }),
    invalid > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(CircleX, { className: "w-3.5 h-3.5" }),
      " ",
      invalid,
      " invalid"
    ] }),
    rows.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-gray-400 italic", children: "No rows found in this sheet" })
  ] });
}
function PreviewTable({
  rows,
  columns
}) {
  const shown = rows.slice(0, 100);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      className: "overflow-x-auto overflow-y-auto rounded-lg border text-xs",
      style: { maxHeight: 320 },
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full min-w-max", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "thead",
          {
            className: "sticky top-0 z-10",
            style: { background: "var(--theme-primary, #6B1A2B)" },
            children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "th",
                {
                  className: "text-left py-2 px-2 text-white font-medium whitespace-nowrap",
                  style: { width: 52 },
                  children: "Row"
                }
              ),
              columns.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                "th",
                {
                  className: "text-left py-2 px-2 text-white font-medium whitespace-nowrap",
                  children: c.label
                },
                c.key
              )),
              /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "text-left py-2 px-2 text-white font-medium whitespace-nowrap", children: "Status" })
            ] })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
          shown.map((row) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "tr",
            {
              className: `border-b last:border-0 ${row.valid ? "" : "bg-red-50"}`,
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-1.5 px-2 text-gray-400 font-mono", children: row.rowNum }),
                columns.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "td",
                  {
                    className: "py-1.5 px-2 max-w-[120px] truncate",
                    title: row.data[c.key],
                    children: row.data[c.key] || /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-gray-300", children: "—" })
                  },
                  c.key
                )),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-1.5 px-2", children: row.valid ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "w-3 h-3" }),
                  " Valid"
                ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "span",
                  {
                    className: "inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded-full cursor-help max-w-[200px] truncate",
                    title: row.errors.join(" | "),
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(CircleAlert, { className: "w-3 h-3 flex-shrink-0" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: row.errors[0] })
                    ]
                  }
                ) })
              ]
            },
            row.rowNum
          )),
          rows.length > 100 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "td",
            {
              colSpan: columns.length + 2,
              className: "py-2 px-3 text-center text-gray-400",
              children: [
                "+ ",
                rows.length - 100,
                " more rows not shown"
              ]
            }
          ) }),
          rows.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(
            "td",
            {
              colSpan: columns.length + 2,
              className: "py-6 text-center text-gray-400 italic",
              children: "No data rows found in this sheet"
            }
          ) })
        ] })
      ] })
    }
  );
}
const CLIENT_COLS = [
  { key: "name", label: "Name" },
  { key: "pan", label: "PAN" },
  { key: "headOfIncome", label: "Head of Income" },
  { key: "taxYear", label: "Tax Year" },
  { key: "dueDate", label: "Due Date" },
  { key: "mobile", label: "Mobile" }
];
const WORK_COLS = [
  { key: "name", label: "Client Name" },
  { key: "pan", label: "PAN" },
  { key: "taxYear", label: "Tax Year" },
  { key: "returnType", label: "Return Type" },
  { key: "workStatus", label: "Work Status" },
  { key: "ackNumber", label: "Ack Number" },
  { key: "filingDate", label: "Filing Date (derived)" },
  { key: "filingStatus", label: "Filing Status" }
];
const DOC_COLS = [
  { key: "name", label: "Client Name" },
  { key: "pan", label: "PAN" },
  { key: "taxYear", label: "Tax Year" },
  { key: "date", label: "Date" },
  { key: "mode", label: "Mode" },
  { key: "status", label: "Status" }
];
const BILLING_COLS = [
  { key: "name", label: "Client Name" },
  { key: "pan", label: "PAN" },
  { key: "taxYear", label: "Tax Year" },
  { key: "billAmount", label: "Bill Amount" },
  { key: "receipt", label: "Receipt" },
  { key: "outwardStatus", label: "Status" }
];
function ExcelImportDialog({
  open,
  onClose,
  currentUserId,
  currentUserName,
  onImportDone
}) {
  const [step, setStep] = reactExports.useState("upload");
  const [importState, setImportState] = reactExports.useState(null);
  const [activeTab, setActiveTab] = reactExports.useState("clients");
  const [fileName, setFileName] = reactExports.useState("");
  const [loading, setLoading] = reactExports.useState(false);
  const [hadErrors, setHadErrors] = reactExports.useState(false);
  const [importMode, setImportMode] = reactExports.useState("merge");
  const [importSummary, setImportSummary] = reactExports.useState(
    null
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
  const handleFile = async (file) => {
    setLoading(true);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = readSync(buf, { type: "array" });
      const existing = storage.getClients();
      const state = parseWorkbook(wb, existing);
      setImportState(state);
      setStep("preview");
    } catch (err) {
      console.error(err);
      ue.error("Failed to parse file. Please use the provided template.");
    } finally {
      setLoading(false);
    }
  };
  const handleImport = async () => {
    var _a;
    if (!importState) return;
    setLoading(true);
    const currentFirmId = (currentUser == null ? void 0 : currentUser.firmId) ?? (currentUser == null ? void 0 : currentUser.id) ?? "";
    try {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const allClients = storage.getClients();
      const allWork = storage.getWork();
      const allDocs = storage.getDocuments();
      const allBilling = storage.getBilling();
      const user = storage.getUsers().find((u) => u.id === currentUserId);
      const isTrialUser = (user == null ? void 0 : user.accessType) === "Trial" || !(user == null ? void 0 : user.accessType);
      const trialLimit = 5;
      const currentClientCount = allClients.filter(
        (c) => c.createdBy === currentUserId
      ).length;
      const validClientRows = importState.clients.filter((r) => r.valid);
      const newClients = [];
      const mergedClients = [];
      let trialBlockedCount = 0;
      let clientsMergedCount = 0;
      let clientsReplacedCount = 0;
      const panYearToId = /* @__PURE__ */ new Map();
      let updatedClientsList = [...allClients];
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
          email
        } = row.data;
        const existingIdx = updatedClientsList.findIndex(
          (c) => c.pan.toUpperCase() === pan && c.taxYear === taxYear
        );
        if (existingIdx !== -1) {
          const existing = updatedClientsList[existingIdx];
          panYearToId.set(`${pan}|${taxYear}`, existing.id);
          if (importMode === "merge") {
            const merged = { ...existing };
            if (name) merged.name = name;
            if (mobile) merged.mobile = mobile;
            if (email && email !== "-") merged.email = email;
            if (headOfIncome)
              merged.headOfIncome = headOfIncome;
            if (businessName && headOfIncome === "Business")
              merged.businessName = businessName;
            if (dueDate && dueDate !== "-") merged.dueDate = dueDate;
            if (clientType)
              merged.clientType = clientType;
            merged.clientCategory = getPanCategory(pan);
            updatedClientsList[existingIdx] = merged;
            mergedClients.push(merged);
            clientsMergedCount++;
          } else {
            const replaced = {
              id: existing.id,
              createdAt: existing.createdAt,
              createdBy: existing.createdBy,
              firmId: existing.firmId ?? currentFirmId,
              name,
              pan,
              mobile: mobile || "",
              email: email === "-" ? "" : email,
              clientType: clientType || "Existing",
              headOfIncome: headOfIncome || "Salaried",
              businessName: headOfIncome === "Business" ? businessName : "",
              taxYear,
              dueDate: dueDate === "-" ? "" : dueDate,
              clientCategory: getPanCategory(pan)
            };
            updatedClientsList[existingIdx] = replaced;
            mergedClients.push(replaced);
            clientsReplacedCount++;
          }
        } else {
          if (isTrialUser && currentClientCount + newClients.length >= trialLimit) {
            trialBlockedCount++;
            continue;
          }
          const clientId = `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
          panYearToId.set(`${pan}|${taxYear}`, clientId);
          const newClient = {
            id: clientId,
            name,
            pan,
            mobile: mobile || "",
            email: email === "-" ? "" : email,
            clientType: clientType || "Existing",
            headOfIncome: headOfIncome || "Salaried",
            businessName: headOfIncome === "Business" ? businessName : "",
            taxYear,
            dueDate: dueDate === "-" ? "" : dueDate,
            clientCategory: getPanCategory(pan),
            createdAt: now,
            createdBy: currentUserId,
            firmId: currentFirmId
          };
          newClients.push(newClient);
          updatedClientsList = [...updatedClientsList, newClient];
        }
      }
      const validWorkRows = importState.work.filter((r) => r.valid);
      const newWorkRecords = [];
      const updatedWork = [...allWork];
      const importedWorkKeys = /* @__PURE__ */ new Set();
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
          remark
        } = row.data;
        const taxYear = wpTaxYear;
        let clientId = panYearToId.get(`${pan}|${taxYear}`);
        if (!clientId) {
          const match = allClients.find(
            (c) => c.pan.toUpperCase() === pan && c.taxYear === taxYear
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
            status: workStatus,
            itrForm: itrForm || "",
            returnType: returnType || void 0,
            ackNumber: ackNumber || "",
            filingDate: filingDate || "",
            filingStatus,
            eVerified,
            remark: remark && remark !== "-" ? remark : existingWp.remark,
            updatedAt: now
          };
        } else {
          newWorkRecords.push({
            id: `imp_wp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
            clientId,
            taxYear,
            status: workStatus,
            itrForm: itrForm || "",
            returnType: returnType || void 0,
            ackNumber: ackNumber || "",
            filingDate: filingDate || "",
            filingStatus: filingStatus || "Pending",
            eVerified,
            remark: remark && remark !== "-" ? remark : "",
            updatedAt: now
          });
        }
      }
      for (const c of newClients) {
        const key = `${c.pan}|${c.taxYear}`;
        const alreadyHasWork = importedWorkKeys.has(key) || updatedWork.some((w) => w.clientId === c.id);
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
            updatedAt: now
          });
        }
      }
      const validDocRows = importState.docs.filter((r) => r.valid);
      const newDocs = [];
      for (const row of validDocRows) {
        const {
          pan,
          taxYear: docTaxYear,
          date,
          mode,
          status,
          remarks
        } = row.data;
        let clientId = panYearToId.get(`${pan}|${docTaxYear}`);
        if (!clientId && docTaxYear) {
          const match = allClients.find(
            (c) => c.pan.toUpperCase() === pan && c.taxYear === docTaxYear
          );
          if (match) clientId = match.id;
        }
        if (!clientId) {
          clientId = panYearToId.get(
            [...panYearToId.keys()].find((k) => k.startsWith(`${pan}|`)) || ""
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
          mode,
          status,
          remarks: remarks === "-" ? "" : remarks,
          createdAt: now,
          firmId: currentFirmId
        });
      }
      const validBillingRows = importState.billing.filter((r) => r.valid);
      const newBillingRecords = [];
      const updatedBilling = [...allBilling];
      for (const row of validBillingRows) {
        const { pan, taxYear, billAmount, receipt, balance, outwardStatus } = row.data;
        let clientId = panYearToId.get(`${pan}|${taxYear}`);
        if (!clientId) {
          const match = allClients.find(
            (c) => c.pan.toUpperCase() === pan && c.taxYear === taxYear
          );
          if (match) clientId = match.id;
        }
        if (!clientId) continue;
        const existingBill = updatedBilling.find(
          (b) => b.clientId === clientId
        );
        if (existingBill) {
          const idx = updatedBilling.indexOf(existingBill);
          updatedBilling[idx] = {
            ...existingBill,
            billAmount: Number(billAmount) || 0,
            receipt: Number(receipt) || 0,
            balance: Number(balance) || 0,
            outwardStatus,
            updatedAt: now
          };
        } else {
          newBillingRecords.push({
            id: `imp_bill_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
            clientId,
            taxYear,
            billAmount: Number(billAmount) || 0,
            receipt: Number(receipt) || 0,
            balance: Number(balance) || 0,
            outwardStatus,
            updatedAt: now
          });
        }
      }
      const finalWork = [...updatedWork, ...newWorkRecords];
      const finalDocs = [...allDocs, ...newDocs];
      const finalBilling = [...updatedBilling, ...newBillingRecords];
      storage.saveClients(updatedClientsList);
      storage.saveWork(finalWork);
      storage.saveDocuments(finalDocs);
      storage.saveBilling(finalBilling);
      const usersList = storage.getUsers();
      const userName = currentUserName ?? ((_a = usersList.find((u) => u.id === currentUserId)) == null ? void 0 : _a.name) ?? "Unknown";
      const modeLabel = importMode === "merge" ? "Merge mode" : "Replace mode";
      const invalidClientRows = importState.clients.filter(
        (r) => !r.valid
      ).length;
      storage.addAuditLog({
        id: storage.uid(),
        userId: currentUserId,
        userName,
        userRole: currentUser == null ? void 0 : currentUser.role,
        action: `Excel Import (${modeLabel})`,
        clientId: "BULK",
        clientName: "Excel Import",
        fieldChanged: "Import",
        oldValue: "-",
        newValue: `Mode: ${modeLabel}. Clients: ${newClients.length} added, ${clientsMergedCount} merged, ${clientsReplacedCount} replaced, ${invalidClientRows + trialBlockedCount} skipped. Work: ${newWorkRecords.length} imported. Docs: ${newDocs.length} imported. Billing: ${newBillingRecords.length} imported.`,
        timestamp: now
      });
      const changedWorkRecords = [];
      for (const row of validWorkRows) {
        const { pan, taxYear: wpTaxYear } = row.data;
        let cid = panYearToId.get(`${pan}|${wpTaxYear}`);
        if (!cid) {
          const match = allClients.find(
            (c) => c.pan.toUpperCase() === pan && c.taxYear === wpTaxYear
          );
          if (match) cid = match.id;
        }
        if (!cid) continue;
        const wp = finalWork.find((w) => w.clientId === cid);
        if (wp) changedWorkRecords.push(wp);
      }
      const changedBillingRecords = [];
      for (const row of validBillingRows) {
        const { pan, taxYear } = row.data;
        let cid = panYearToId.get(`${pan}|${taxYear}`);
        if (!cid) {
          const match = allClients.find(
            (c) => c.pan.toUpperCase() === pan && c.taxYear === taxYear
          );
          if (match) cid = match.id;
        }
        if (!cid) continue;
        const bill = finalBilling.find((b) => b.clientId === cid);
        if (bill) changedBillingRecords.push(bill);
      }
      const importHistoryEntry = {
        id: `ih_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
        importedAt: now,
        mode: importMode === "merge" ? "Merge" : "Replace",
        importedBy: userName,
        tabCounts: {
          clients: {
            added: newClients.length,
            updated: clientsMergedCount + clientsReplacedCount,
            skipped: invalidClientRows + trialBlockedCount
          },
          workProcessing: {
            added: newWorkRecords.filter(
              (w) => w.id.startsWith("imp_wp_") || w.id.startsWith("imp_awp_")
            ).length,
            updated: validWorkRows.length - newWorkRecords.filter(
              (w) => w.id.startsWith("imp_wp_") || w.id.startsWith("imp_awp_")
            ).length,
            skipped: importState.work.filter((r) => !r.valid).length
          },
          documentInward: {
            added: newDocs.length,
            updated: 0,
            skipped: importState.docs.filter((r) => !r.valid).length
          },
          billing: {
            added: newBillingRecords.length,
            updated: validBillingRows.length - newBillingRecords.length,
            skipped: importState.billing.filter((r) => !r.valid).length
          }
        },
        changedRows: {
          clients: [...newClients, ...mergedClients],
          workProcessing: changedWorkRecords,
          documentInward: newDocs,
          billing: changedBillingRecords
        }
      };
      await saveImportHistory(importHistoryEntry);
      await forceSyncToCanister();
      const anyErrors = importState.clients.some((r) => !r.valid) || importState.work.some((r) => !r.valid) || importState.docs.some((r) => !r.valid) || importState.billing.some((r) => !r.valid);
      setHadErrors(anyErrors);
      setImportSummary({
        added: newClients.length,
        merged: clientsMergedCount,
        replaced: clientsReplacedCount,
        skipped: invalidClientRows + trialBlockedCount
      });
      setStep("done");
      onImportDone();
      ue.success(
        `Import complete (${modeLabel}): ${newClients.length} added, ${clientsMergedCount + clientsReplacedCount} updated, ${newWorkRecords.length} work records, ${newDocs.length} documents.`
      );
    } catch (err) {
      console.error("Import error:", err);
      ue.error("Import failed. Please check the file and try again.");
    } finally {
      setLoading(false);
    }
  };
  const totalValid = ((importState == null ? void 0 : importState.clients.filter((r) => r.valid).length) ?? 0) + ((importState == null ? void 0 : importState.work.filter((r) => r.valid).length) ?? 0) + ((importState == null ? void 0 : importState.docs.filter((r) => r.valid).length) ?? 0) + ((importState == null ? void 0 : importState.billing.filter((r) => r.valid).length) ?? 0);
  const totalInvalid = ((importState == null ? void 0 : importState.clients.filter((r) => !r.valid).length) ?? 0) + ((importState == null ? void 0 : importState.work.filter((r) => !r.valid).length) ?? 0) + ((importState == null ? void 0 : importState.docs.filter((r) => !r.valid).length) ?? 0) + ((importState == null ? void 0 : importState.billing.filter((r) => !r.valid).length) ?? 0);
  const activeRows = activeTab === "clients" ? (importState == null ? void 0 : importState.clients) ?? [] : activeTab === "work" ? (importState == null ? void 0 : importState.work) ?? [] : activeTab === "docs" ? (importState == null ? void 0 : importState.docs) ?? [] : (importState == null ? void 0 : importState.billing) ?? [];
  const activeCols = activeTab === "clients" ? CLIENT_COLS : activeTab === "work" ? WORK_COLS : activeTab === "docs" ? DOC_COLS : BILLING_COLS;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Dialog,
    {
      open,
      onOpenChange: (o) => {
        if (!o) handleClose();
      },
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        DialogContent,
        {
          className: "max-w-4xl w-full max-h-[92vh] overflow-y-auto",
          "data-ocid": "clients.import.dialog",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(DialogHeader, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { style: { color: "var(--theme-primary, #6B1A2B)" }, children: "Import Data from Excel" }) }),
            step === "upload" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-5 mt-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "rounded-lg border p-4",
                  style: {
                    background: "rgba(107,26,43,0.04)",
                    borderColor: "rgba(107,26,43,0.18)"
                  },
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "p",
                      {
                        className: "text-sm font-semibold mb-1",
                        style: { color: "var(--theme-primary, #6B1A2B)" },
                        children: "Step 1 — Download Template"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-gray-500 mb-3", children: "Download the import template (4 sheets: Client Master, Work Processing, Document Inward, Outward & Billing). You can copy rows directly from any exported TaxCore Excel file — the column order matches exactly." }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      Button,
                      {
                        size: "sm",
                        variant: "outline",
                        onClick: downloadImportTemplate,
                        className: "gap-1.5",
                        style: {
                          borderColor: "var(--theme-primary, #6B1A2B)",
                          color: "var(--theme-primary, #6B1A2B)"
                        },
                        "data-ocid": "clients.import.download_template_button",
                        children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx(FileDown, { className: "w-4 h-4" }),
                          " Download Template (.xlsx)"
                        ]
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "rounded-lg border-2 border-dashed p-8 text-center",
                  style: { borderColor: "rgba(107,26,43,0.25)" },
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "p",
                      {
                        className: "text-sm font-semibold mb-1",
                        style: { color: "var(--theme-primary, #6B1A2B)" },
                        children: "Step 2 — Upload Your Filled File"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-gray-400 mb-4", children: "Accepts .xlsx or .xls files · All 4 sheets processed together" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "cursor-pointer inline-block", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "input",
                        {
                          type: "file",
                          accept: ".xlsx,.xls",
                          className: "hidden",
                          "data-ocid": "clients.import.upload_button",
                          onChange: async (e) => {
                            var _a;
                            const file = (_a = e.target.files) == null ? void 0 : _a[0];
                            if (!file) return;
                            await handleFile(file);
                            e.target.value = "";
                          }
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs(
                        "div",
                        {
                          className: "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer",
                          style: { background: "var(--theme-primary, #6B1A2B)" },
                          children: [
                            /* @__PURE__ */ jsxRuntimeExports.jsx(Upload, { className: "w-4 h-4" }),
                            loading ? "Parsing file…" : "Choose Excel File"
                          ]
                        }
                      )
                    ] })
                  ]
                }
              )
            ] }),
            step === "mode" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-5 mt-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "div",
                {
                  className: "rounded-lg border px-4 py-3",
                  style: {
                    background: "rgba(107,26,43,0.04)",
                    borderColor: "rgba(107,26,43,0.18)"
                  },
                  children: /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-gray-500", children: [
                    "File:",
                    " ",
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-gray-700", children: fileName })
                  ] })
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "p",
                  {
                    className: "text-sm font-semibold mb-1",
                    style: { color: "var(--theme-primary, #6B1A2B)" },
                    children: "How should existing clients be handled?"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-gray-500 mb-4", children: "Choose what happens when an imported row matches a client (same PAN + Tax Year) that already exists in your system." }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "button",
                    {
                      type: "button",
                      onClick: () => setImportMode("merge"),
                      "data-ocid": "clients.import.mode.merge",
                      className: `relative text-left rounded-xl border-2 p-4 transition-all cursor-pointer ${importMode === "merge" ? "border-current shadow-md" : "border-gray-200 hover:border-gray-300"}`,
                      style: importMode === "merge" ? {
                        borderColor: "var(--theme-primary, #6B1A2B)",
                        background: "rgba(107,26,43,0.04)"
                      } : {},
                      children: [
                        importMode === "merge" && /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "span",
                          {
                            className: "absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center",
                            style: { background: "var(--theme-primary, #6B1A2B)" },
                            children: /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "w-3.5 h-3.5 text-white" })
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "div",
                          {
                            className: "w-10 h-10 rounded-lg flex items-center justify-center mb-3",
                            style: { background: "rgba(107,26,43,0.10)" },
                            children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                              GitMerge,
                              {
                                className: "w-5 h-5",
                                style: { color: "var(--theme-primary, #6B1A2B)" }
                              }
                            )
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-semibold text-gray-800 mb-1", children: "Merge" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-gray-500 leading-relaxed", children: "Update only the fields provided in the import file. Existing fields not in the file stay as-is." }),
                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 flex flex-wrap gap-1", children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700 font-medium", children: "Safe — no data loss" }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium", children: "Recommended" })
                        ] })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "button",
                    {
                      type: "button",
                      onClick: () => setImportMode("replace"),
                      "data-ocid": "clients.import.mode.replace",
                      className: `relative text-left rounded-xl border-2 p-4 transition-all cursor-pointer ${importMode === "replace" ? "border-current shadow-md" : "border-gray-200 hover:border-gray-300"}`,
                      style: importMode === "replace" ? {
                        borderColor: "var(--theme-primary, #6B1A2B)",
                        background: "rgba(107,26,43,0.04)"
                      } : {},
                      children: [
                        importMode === "replace" && /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "span",
                          {
                            className: "absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center",
                            style: { background: "var(--theme-primary, #6B1A2B)" },
                            children: /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "w-3.5 h-3.5 text-white" })
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "div",
                          {
                            className: "w-10 h-10 rounded-lg flex items-center justify-center mb-3",
                            style: { background: "rgba(239,68,68,0.08)" },
                            children: /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "w-5 h-5 text-red-500" })
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-semibold text-gray-800 mb-1", children: "Replace" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-gray-500 leading-relaxed", children: "Fully overwrite the existing client record with the imported data. All previous field values are replaced." }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-3 flex flex-wrap gap-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-medium", children: "Overwrites existing data" }) })
                      ]
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-[11px] text-gray-400 mt-3", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium", children: "Note:" }),
                  " New clients (no PAN match) are always added. Work Processing, Document Inward, and Billing records follow their own update logic regardless of this setting."
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-3 pt-1", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Button,
                  {
                    variant: "outline",
                    onClick: () => setStep("preview"),
                    className: "flex-1",
                    "data-ocid": "clients.import.mode_back_button",
                    children: "Back"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Button,
                  {
                    onClick: handleImport,
                    disabled: loading,
                    style: { background: "var(--theme-primary, #6B1A2B)" },
                    className: "text-white flex-1",
                    "data-ocid": "clients.import.mode_confirm_button",
                    children: loading ? "Importing…" : importMode === "merge" ? "Import with Merge" : "Import with Replace"
                  }
                )
              ] })
            ] }),
            step === "preview" && importState && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4 mt-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 flex-wrap text-sm", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-medium text-gray-600", children: [
                  "File: ",
                  fileName
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full text-xs font-medium", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "w-3.5 h-3.5" }),
                  " ",
                  totalValid,
                  " valid rows"
                ] }),
                totalInvalid > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full text-xs font-medium", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(CircleX, { className: "w-3.5 h-3.5" }),
                  " ",
                  totalInvalid,
                  " invalid rows"
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex gap-1 flex-wrap border-b", children: ["clients", "work", "docs", "billing"].map(
                (tab) => {
                  const rows = tab === "clients" ? importState.clients : tab === "work" ? importState.work : tab === "docs" ? importState.docs : importState.billing;
                  const inv = rows.filter((r) => !r.valid).length;
                  const isActive = activeTab === tab;
                  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "button",
                    {
                      type: "button",
                      onClick: () => setActiveTab(tab),
                      "data-ocid": `clients.import.tab.${tab}`,
                      className: `px-3 py-2 text-xs font-medium rounded-t border-b-2 transition-colors ${isActive ? "border-current" : "border-transparent text-gray-500 hover:text-gray-700"}`,
                      style: isActive ? {
                        color: "var(--theme-primary, #6B1A2B)",
                        borderColor: "var(--theme-primary, #6B1A2B)"
                      } : {},
                      children: [
                        SECTION_LABELS[tab],
                        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ml-1.5 text-xs", children: [
                          "(",
                          rows.length,
                          ")"
                        ] }),
                        inv > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold", children: inv })
                      ]
                    },
                    tab
                  );
                }
              ) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(CountBadges, { rows: activeRows }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(PreviewTable, { rows: activeRows, columns: activeCols }),
              activeRows.some((r) => !r.valid) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-lg border border-red-200 p-3 bg-red-50 space-y-1", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs font-semibold text-red-700 mb-1", children: [
                  "Validation Errors in ",
                  SECTION_LABELS[activeTab],
                  ":"
                ] }),
                activeRows.filter((r) => !r.valid).slice(0, 10).map((r) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-red-600", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-medium", children: [
                    "Row ",
                    r.rowNum,
                    ":"
                  ] }),
                  " ",
                  r.errors.join("; ")
                ] }, r.rowNum)),
                activeRows.filter((r) => !r.valid).length > 10 && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-red-400", children: [
                  "…and ",
                  activeRows.filter((r) => !r.valid).length - 10,
                  " more errors"
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-3 pt-1", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Button,
                  {
                    variant: "outline",
                    onClick: () => {
                      setStep("upload");
                      setImportState(null);
                      setFileName("");
                    },
                    className: "flex-1",
                    "data-ocid": "clients.import.cancel_button",
                    children: "Back"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Button,
                  {
                    disabled: totalValid === 0 || loading,
                    onClick: () => setStep("mode"),
                    style: { background: "var(--theme-primary, #6B1A2B)" },
                    className: "text-white flex-1",
                    "data-ocid": "clients.import.confirm_button",
                    children: `Review ${totalValid} Valid Row${totalValid !== 1 ? "s" : ""} →`
                  }
                )
              ] })
            ] }),
            step === "done" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-5 mt-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center gap-3 py-4 text-center", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-14 h-14 rounded-full bg-green-100 flex items-center justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "w-7 h-7 text-green-600" }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "p",
                  {
                    className: "text-base font-semibold",
                    style: { color: "var(--theme-primary, #6B1A2B)" },
                    children: "Import Completed Successfully"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-gray-400", children: [
                  "Mode:",
                  " ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold text-gray-600", children: importMode === "merge" ? "Merge" : "Replace" })
                ] })
              ] }),
              importSummary && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "div",
                  {
                    className: "rounded-lg border text-center p-3",
                    style: {
                      borderColor: "rgba(107,26,43,0.15)",
                      background: "rgba(107,26,43,0.03)"
                    },
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "p",
                        {
                          className: "text-xl font-bold",
                          style: { color: "var(--theme-primary, #6B1A2B)" },
                          children: importSummary.added
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] text-gray-500 mt-0.5 font-medium", children: "New Clients Added" })
                    ]
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-lg border text-center p-3 border-blue-100 bg-blue-50", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xl font-bold text-blue-700", children: importSummary.merged }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] text-blue-500 mt-0.5 font-medium", children: "Clients Merged" })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-lg border text-center p-3 border-amber-100 bg-amber-50", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xl font-bold text-amber-700", children: importSummary.replaced }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] text-amber-500 mt-0.5 font-medium", children: "Clients Replaced" })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-lg border text-center p-3 border-gray-100 bg-gray-50", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xl font-bold text-gray-500", children: importSummary.skipped }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] text-gray-400 mt-0.5 font-medium", children: "Invalid / Skipped" })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-gray-400 text-center", children: "The dashboard and client list reflect the new data immediately." }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-3 justify-center", children: [
                hadErrors && importState && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  Button,
                  {
                    variant: "outline",
                    onClick: () => downloadErrorReport(importState, fileName),
                    className: "gap-2",
                    style: {
                      borderColor: "var(--theme-primary, #6B1A2B)",
                      color: "var(--theme-primary, #6B1A2B)"
                    },
                    "data-ocid": "clients.import.error_report_button",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(Download, { className: "w-4 h-4" }),
                      " Download Error Report"
                    ]
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Button,
                  {
                    onClick: handleClose,
                    style: { background: "var(--theme-primary, #6B1A2B)" },
                    className: "text-white",
                    "data-ocid": "clients.import.close_button",
                    children: "Close"
                  }
                )
              ] })
            ] })
          ]
        }
      )
    }
  );
}
const TAX_YEARS = getTaxYears();
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const WORK_STATUS_OPTIONS = [
  {
    label: "Pending",
    value: "Pending",
    colorClass: "bg-orange-100 text-orange-700"
  },
  {
    label: "In Progress",
    value: "In Progress",
    colorClass: "bg-blue-100 text-blue-700"
  },
  {
    label: "Completed",
    value: "Completed",
    colorClass: "bg-green-100 text-green-700"
  }
];
const DOC_STATUS_OPTIONS = [
  {
    label: "Complete",
    value: "Complete",
    colorClass: "bg-emerald-100 text-emerald-700"
  },
  {
    label: "Partial",
    value: "Partial",
    colorClass: "bg-yellow-100 text-yellow-700"
  }
];
const HEAD_OF_INCOME_OPTIONS = [
  "Salaried",
  "Business",
  "Agricultural",
  "Capital Gain"
];
function ClientMasterPage({
  onViewClient,
  currentUserId
}) {
  const currentUser = storage.getCurrentUser();
  const TRIAL_LIMIT = 5;
  const [search, setSearch] = reactExports.useState("");
  const [filterYear, setFilterYear] = reactExports.useState("All");
  const [showForm, setShowForm] = reactExports.useState(false);
  const [editClient, setEditClient] = reactExports.useState(null);
  const [formError, setFormError] = reactExports.useState("");
  const [refreshKey, setRefreshKey] = reactExports.useState(0);
  const [alertDismissed, setAlertDismissed] = reactExports.useState(false);
  const [alertClients, setAlertClients] = reactExports.useState(() => getDueAlertClients());
  const [showUpgradeModal, setShowUpgradeModal] = reactExports.useState(false);
  const [importOpen, setImportOpen] = reactExports.useState(false);
  reactExports.useEffect(() => {
    setAlertClients(getDueAlertClients());
    const unsub = onStorageChange(() => {
      setAlertClients(getDueAlertClients());
      setRefreshKey((k) => k + 1);
    });
    return unsub;
  }, []);
  const [form, setForm] = reactExports.useState({
    name: "",
    pan: "",
    mobile: "",
    email: "",
    clientType: "Existing",
    headOfIncome: "Salaried",
    businessName: "",
    taxYear: getCurrentTaxYear(),
    dueDate: ""
  });
  const clients = reactExports.useMemo(() => {
    let list = storage.getClients();
    if (filterYear !== "All")
      list = list.filter((c) => c.taxYear === filterYear);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || c.pan.toLowerCase().includes(q) || c.mobile.includes(q)
      );
    }
    return list;
  }, [search, filterYear, refreshKey]);
  const getCurrentUserName = () => {
    var _a;
    return ((_a = storage.getUsers().find((u) => u.id === currentUserId)) == null ? void 0 : _a.name) || "Unknown";
  };
  const openAdd = () => {
    if ((currentUser == null ? void 0 : currentUser.accessType) === "Trial") {
      const ownerClients = storage.getClients().filter((c) => {
        return currentUser.role === "Owner" ? true : c.createdBy === currentUser.id;
      });
      if (ownerClients.length >= TRIAL_LIMIT) {
        setShowUpgradeModal(true);
        return;
      }
    }
    setEditClient(null);
    setForm({
      name: "",
      pan: "",
      mobile: "",
      email: "",
      clientType: "Existing",
      headOfIncome: "Salaried",
      businessName: "",
      taxYear: getCurrentTaxYear(),
      dueDate: ""
    });
    setFormError("");
    setShowForm(true);
  };
  const openEdit = (c) => {
    setEditClient(c);
    setForm({
      name: c.name,
      pan: c.pan,
      mobile: c.mobile,
      email: c.email,
      clientType: c.clientType,
      headOfIncome: getHeadOfIncome(c) || "Salaried",
      businessName: c.businessName,
      taxYear: c.taxYear,
      dueDate: c.dueDate
    });
    setFormError("");
    setShowForm(true);
  };
  const validateDate = (d) => {
    if (!d) return false;
    const parts = d.split("-");
    if (parts.length !== 3) return false;
    const [dd, mm, yyyy] = parts;
    const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return !Number.isNaN(dt.getTime()) && dt.getFullYear() === Number(yyyy);
  };
  const handleSave = () => {
    setFormError("");
    if (!form.name.trim()) return setFormError("Name is required.");
    if (!PAN_REGEX.test(form.pan.toUpperCase()))
      return setFormError("Invalid PAN format (e.g. ABCDE1234F).");
    if (!/^\d{10}$/.test(form.mobile))
      return setFormError("Mobile must be exactly 10 digits.");
    if (!form.taxYear) return setFormError("Tax Year is required.");
    if (!validateDate(form.dueDate))
      return setFormError("Due Date must be in DD-MM-YYYY format.");
    if (form.taxYear && validateDate(form.dueDate)) {
      const endYear = Number(form.taxYear.split("-")[1]);
      const taxYearEnd = new Date(endYear, 2, 31);
      const dueParts = form.dueDate.split("-");
      const dueDate = new Date(
        Number(dueParts[2]),
        Number(dueParts[1]) - 1,
        Number(dueParts[0])
      );
      if (dueDate <= taxYearEnd)
        return setFormError(
          `Due Date must be after 31-03-${endYear} (end of tax year ${form.taxYear}).`
        );
    }
    const pan = form.pan.toUpperCase();
    const allClients = storage.getClients();
    const dup = allClients.find(
      (c) => c.pan.toUpperCase() === pan && c.taxYear === form.taxYear && c.id !== (editClient == null ? void 0 : editClient.id)
    );
    if (dup)
      return setFormError(
        "A client with this PAN and Tax Year already exists. To file a Revised or Updated return, open the existing client and update the Return Type in Work Processing."
      );
    if (editClient) {
      const updated = {
        ...editClient,
        name: form.name,
        pan,
        mobile: form.mobile,
        email: form.email,
        clientType: form.clientType,
        headOfIncome: form.headOfIncome,
        businessName: form.headOfIncome === "Business" ? form.businessName : "",
        taxYear: form.taxYear,
        dueDate: form.dueDate,
        clientCategory: getPanCategory(pan)
      };
      storage.saveClients(
        allClients.map((c) => c.id === editClient.id ? updated : c)
      );
      storage.addAuditLog({
        id: storage.uid(),
        userId: currentUserId,
        userName: getCurrentUserName(),
        userRole: currentUser == null ? void 0 : currentUser.role,
        action: "Client Updated",
        clientId: editClient.id,
        clientName: form.name,
        fieldChanged: "Client Details",
        oldValue: editClient.name,
        newValue: `${form.name} | PAN: ${pan} | Year: ${form.taxYear}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } else {
      const newClient = {
        id: storage.uid(),
        name: form.name,
        pan,
        mobile: form.mobile,
        email: form.email,
        clientType: form.clientType,
        headOfIncome: form.headOfIncome,
        businessName: form.headOfIncome === "Business" ? form.businessName : "",
        taxYear: form.taxYear,
        dueDate: form.dueDate,
        clientCategory: getPanCategory(pan),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        createdBy: currentUserId
      };
      storage.saveClients([...allClients, newClient]);
      const work = storage.getWork();
      const wp = {
        id: storage.uid(),
        clientId: newClient.id,
        taxYear: form.taxYear,
        status: "Pending",
        itrForm: "",
        ackNumber: "",
        filingDate: "",
        filingStatus: "Pending",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      storage.saveWork([...work, wp]);
      storage.addAuditLog({
        id: storage.uid(),
        userId: currentUserId,
        userName: getCurrentUserName(),
        userRole: currentUser == null ? void 0 : currentUser.role,
        action: "Client Added",
        clientId: newClient.id,
        clientName: newClient.name,
        fieldChanged: "Client Added",
        oldValue: "-",
        newValue: `${newClient.name} | PAN: ${pan} | Year: ${form.taxYear}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  };
  const handleDelete = async (id) => {
    if (!confirm("Delete this client and all related data?")) return;
    const deletedClient = storage.getClients().find((c) => c.id === id);
    tombstoneDeletedClients([id]);
    storage.saveClients(storage.getClients().filter((c) => c.id !== id));
    storage.saveWork(storage.getWork().filter((w) => w.clientId !== id));
    storage.saveDocuments(
      storage.getDocuments().filter((d) => d.clientId !== id)
    );
    storage.saveBilling(storage.getBilling().filter((b) => b.clientId !== id));
    if (deletedClient) {
      storage.addAuditLog({
        id: storage.uid(),
        userId: currentUserId,
        userName: getCurrentUserName(),
        userRole: currentUser == null ? void 0 : currentUser.role,
        action: "Client Deleted",
        clientId: id,
        clientName: deletedClient.name,
        fieldChanged: "Client",
        oldValue: `${deletedClient.name} | PAN: ${deletedClient.pan}`,
        newValue: "Deleted",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    try {
      await forceSyncToCanister();
    } catch (err) {
      console.warn("[handleDelete] forceSyncToCanister failed:", err);
    }
    setRefreshKey((k) => k + 1);
  };
  const handleWorkStatusSave = (client, newVal) => {
    const work = getClientWork(client.id);
    if (!work) return;
    const oldVal = work.status === "Filed" ? "Completed" : work.status;
    if (oldVal === newVal) return;
    const allWork = storage.getWork();
    storage.saveWork(
      allWork.map(
        (w) => w.id === work.id ? {
          ...w,
          status: newVal,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        } : w
      )
    );
    storage.addAuditLog({
      id: storage.uid(),
      userId: currentUserId,
      userName: getCurrentUserName(),
      userRole: currentUser == null ? void 0 : currentUser.role,
      action: "Updated Work Status",
      clientId: client.id,
      clientName: client.name,
      fieldChanged: "Work Status",
      oldValue: oldVal,
      newValue: newVal,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    ue.success("Status updated", {
      description: `${client.name} → ${newVal}`
    });
    setRefreshKey((k) => k + 1);
  };
  const handleDocStatusSave = (client, newVal) => {
    const latestDoc = getLatestDoc(client.id);
    const oldVal = (latestDoc == null ? void 0 : latestDoc.status) ?? "-";
    if (oldVal === newVal) return;
    if (latestDoc) {
      const allDocs = storage.getDocuments();
      storage.saveDocuments(
        allDocs.map(
          (d) => d.id === latestDoc.id ? { ...d, status: newVal } : d
        )
      );
    }
    storage.addAuditLog({
      id: storage.uid(),
      userId: currentUserId,
      userName: getCurrentUserName(),
      userRole: currentUser == null ? void 0 : currentUser.role,
      action: "Updated Inward Docs Status",
      clientId: client.id,
      clientName: client.name,
      fieldChanged: "Inward Docs Status",
      oldValue: oldVal,
      newValue: newVal,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    ue.success("Doc status updated", {
      description: `${client.name} → ${newVal}`
    });
    setRefreshKey((k) => k + 1);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", children: [
    !alertDismissed && alertClients.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        "data-ocid": "clients.alert.panel",
        className: "relative rounded-lg shadow-md p-4 mb-4 border",
        style: {
          background: "rgba(220,38,38,0.05)",
          borderColor: "rgba(220,38,38,0.25)",
          borderLeft: "4px solid #dc2626"
        },
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              onClick: () => setAlertDismissed(true),
              className: "absolute top-2 right-2 p-1 rounded hover:bg-red-100 text-gray-400",
              "aria-label": "Dismiss",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(X, { className: "w-4 h-4" })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Bell, { className: "w-4 h-4 text-red-500" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-semibold text-red-700", children: [
              alertClients.length,
              " client",
              alertClients.length > 1 ? "s" : "",
              " ",
              "with urgent due dates"
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "space-y-1", children: alertClients.map(({ client, daysLeft }) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex items-center gap-2 text-sm", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              TriangleAlert,
              {
                className: `w-3.5 h-3.5 flex-shrink-0 ${daysLeft < 0 ? "text-yellow-500" : daysLeft <= 5 ? "text-red-500" : "text-amber-500"}`
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium", children: client.name }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-gray-500 font-mono text-xs", children: client.pan }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-gray-600", children: [
              "Due: ",
              client.dueDate
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "span",
              {
                className: `ml-auto text-xs px-2 py-0.5 rounded-full font-bold ${daysLeft < 0 ? "bg-yellow-100 text-yellow-700" : daysLeft <= 5 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`,
                children: daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Due today" : `${daysLeft}d left`
              }
            )
          ] }, client.id)) })
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 flex-wrap justify-between", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-3 flex-wrap", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Input,
            {
              placeholder: "Search name, PAN, mobile...",
              value: search,
              onChange: (e) => setSearch(e.target.value),
              className: "pl-9 w-64",
              "data-ocid": "clients.search_input"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Select, { value: filterYear, onValueChange: setFilterYear, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: "w-36", "data-ocid": "clients.filter.select", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {}) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "All", children: "All Years" }),
            TAX_YEARS.map((y) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: y, children: y }, y))
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Button,
          {
            variant: "outline",
            onClick: () => setImportOpen(true),
            className: "text-sm",
            style: {
              borderColor: "var(--theme-primary, #6B1A2B)",
              color: "var(--theme-primary, #6B1A2B)"
            },
            "data-ocid": "clients.import_button",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Upload, { className: "w-4 h-4 mr-1" }),
              " Import Excel"
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Button,
          {
            onClick: openAdd,
            style: { background: "var(--theme-primary, #6B1A2B)" },
            className: "text-white",
            "data-ocid": "clients.primary_button",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Plus, { className: "w-4 h-4 mr-1" }),
              " Add Client"
            ]
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "bg-white rounded-lg shadow-sm border overflow-x-auto",
        "data-ocid": "clients.table",
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full text-sm", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { style: { background: "var(--theme-primary, #6B1A2B)" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "th",
              {
                className: "text-center py-3 px-3 text-white font-medium text-xs",
                style: { width: 52 },
                children: "Sr.No."
              }
            ),
            [
              "Name",
              "PAN",
              "Client Type",
              "Head of Income",
              "Business Name",
              "Tax Year",
              "Due Date",
              "Doc Status",
              "Work Status",
              "Work Remark",
              "Actions"
            ].map((h) => /* @__PURE__ */ jsxRuntimeExports.jsx(
              "th",
              {
                className: "text-left py-3 px-3 text-white font-medium text-xs",
                children: h
              },
              h
            ))
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
            clients.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(
              "td",
              {
                colSpan: 12,
                className: "py-10 text-center text-gray-400",
                "data-ocid": "clients.empty_state",
                children: "No clients found. Add your first client."
              }
            ) }),
            clients.map((client, i) => {
              const days = getDaysUntilDue(client.dueDate);
              const isAlert = days !== null && days <= 10;
              const latestDoc = getLatestDocStatus(client.id);
              const work = getClientWork(client.id);
              const docHasEntry = latestDoc !== "-";
              const headOfIncome = getHeadOfIncome(client);
              const workStatusDisplay = (work == null ? void 0 : work.status) === "Filed" ? "Completed" : (work == null ? void 0 : work.status) || "Pending";
              const alertRowClass = days !== null && days < 0 ? "bg-yellow-50 border-l-4 border-l-yellow-400" : isAlert && days !== null && days <= 5 ? "bg-red-50 border-l-4 border-l-red-500" : isAlert ? "bg-amber-50 border-l-4 border-l-amber-400" : "";
              return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "tr",
                {
                  "data-ocid": `clients.item.${i + 1}`,
                  className: `border-b last:border-0 hover:bg-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/30"} ${alertRowClass}`,
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "td",
                      {
                        className: "py-2.5 px-3 text-center text-xs text-gray-500 font-medium",
                        style: { width: 52 },
                        children: i + 1
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2.5 px-3 font-medium", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        type: "button",
                        onClick: () => onViewClient(client),
                        className: "hover:underline",
                        style: { color: "var(--theme-primary, #6B1A2B)" },
                        children: client.name
                      }
                    ) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2.5 px-3 font-mono text-xs", children: client.pan }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2.5 px-3 text-xs", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "span",
                      {
                        className: "px-1.5 py-0.5 rounded text-xs font-medium",
                        style: {
                          background: "var(--theme-primary-light, rgba(107,26,43,0.09))",
                          color: "var(--theme-primary, #6B1A2B)"
                        },
                        children: getPanCategory(client.pan)
                      }
                    ) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2.5 px-3 text-xs", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "span",
                      {
                        className: `px-1.5 py-0.5 rounded text-xs font-medium ${headOfIncome === "Business" ? "bg-purple-100 text-purple-700" : headOfIncome === "Salaried" ? "bg-blue-100 text-blue-700" : headOfIncome === "Agricultural" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`,
                        children: headOfIncome
                      }
                    ) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2.5 px-3 text-xs text-gray-600", children: headOfIncome === "Business" && client.businessName ? client.businessName : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-gray-300", children: "—" }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2.5 px-3 text-xs", children: client.taxYear }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2.5 px-3", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1", children: [
                      isAlert && /* @__PURE__ */ jsxRuntimeExports.jsx(
                        TriangleAlert,
                        {
                          className: `w-3.5 h-3.5 flex-shrink-0 ${days !== null && days < 0 ? "text-yellow-500" : "text-red-500"}`
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "span",
                        {
                          className: `text-xs ${days !== null && days < 0 ? "text-yellow-600 font-semibold" : isAlert ? "text-red-600 font-semibold" : ""}`,
                          children: client.dueDate
                        }
                      ),
                      isAlert && days !== null && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                        "span",
                        {
                          className: `text-xs ${days < 0 ? "text-yellow-500" : "text-red-500"}`,
                          children: [
                            "(",
                            days < 0 ? `${Math.abs(days)}d ago` : `${days}d`,
                            ")"
                          ]
                        }
                      )
                    ] }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2.5 px-3", children: docHasEntry ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                      InlineStatusCell,
                      {
                        value: latestDoc,
                        options: DOC_STATUS_OPTIONS,
                        onSave: (newVal) => handleDocStatusSave(client, newVal)
                      }
                    ) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-gray-400 italic", children: "No docs" }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2.5 px-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                      InlineStatusCell,
                      {
                        value: workStatusDisplay,
                        options: WORK_STATUS_OPTIONS,
                        onSave: (newVal) => handleWorkStatusSave(client, newVal)
                      }
                    ) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2.5 px-3 max-w-[160px]", children: (work == null ? void 0 : work.remark) ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "span",
                      {
                        className: "text-xs text-gray-700 italic block truncate",
                        title: work.remark,
                        children: work.remark
                      }
                    ) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-gray-300", children: "—" }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2.5 px-3", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-1", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          type: "button",
                          onClick: () => onViewClient(client),
                          title: "View",
                          className: "p-1 rounded hover:bg-gray-200 text-gray-500",
                          "data-ocid": `clients.item.${i + 1}`,
                          children: /* @__PURE__ */ jsxRuntimeExports.jsx(Eye, { className: "w-4 h-4" })
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          type: "button",
                          onClick: () => openEdit(client),
                          title: "Edit",
                          className: "p-1 rounded hover:bg-gray-200 text-gray-500",
                          "data-ocid": `clients.edit_button.${i + 1}`,
                          children: /* @__PURE__ */ jsxRuntimeExports.jsx(Pen, { className: "w-4 h-4" })
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          type: "button",
                          onClick: () => handleDelete(client.id),
                          title: "Delete",
                          className: "p-1 rounded hover:bg-red-100 text-red-400",
                          "data-ocid": `clients.delete_button.${i + 1}`,
                          children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "w-4 h-4" })
                        }
                      )
                    ] }) })
                  ]
                },
                client.id
              );
            })
          ] })
        ] })
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Dialog, { open: showForm, onOpenChange: setShowForm, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      DialogContent,
      {
        className: "max-w-lg max-h-[90vh] overflow-y-auto",
        "data-ocid": "clients.dialog",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(DialogHeader, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { style: { color: "var(--theme-primary, #6B1A2B)" }, children: editClient ? "Edit Client" : "Add New Client" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4 mt-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "col-span-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Name *" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Input,
                  {
                    value: form.name,
                    onChange: (e) => setForm((f) => ({ ...f, name: e.target.value })),
                    placeholder: "Full name",
                    className: "mt-1",
                    "data-ocid": "clients.input"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "PAN *" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Input,
                  {
                    value: form.pan,
                    onChange: (e) => setForm((f) => ({
                      ...f,
                      pan: e.target.value.toUpperCase()
                    })),
                    placeholder: "ABCDE1234F",
                    maxLength: 10,
                    className: "mt-1 font-mono uppercase"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Mobile * (10 digits)" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Input,
                  {
                    value: form.mobile,
                    onChange: (e) => setForm((f) => ({
                      ...f,
                      mobile: e.target.value.replace(/\D/g, "").slice(0, 10)
                    })),
                    placeholder: "Enter 10-digit mobile",
                    type: "tel",
                    inputMode: "numeric",
                    className: "mt-1"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "col-span-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Email" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Input,
                  {
                    type: "email",
                    value: form.email,
                    onChange: (e) => setForm((f) => ({ ...f, email: e.target.value })),
                    placeholder: "email@example.com (optional)",
                    className: "mt-1"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Client Type" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  Select,
                  {
                    value: form.clientType,
                    onValueChange: (v) => setForm((f) => ({
                      ...f,
                      clientType: v
                    })),
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: "mt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {}) }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "Existing", children: "Existing" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "New", children: "New" })
                      ] })
                    ]
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Head of Income" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  Select,
                  {
                    value: form.headOfIncome,
                    onValueChange: (v) => setForm((f) => ({
                      ...f,
                      headOfIncome: v
                    })),
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: "mt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {}) }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: HEAD_OF_INCOME_OPTIONS.map((opt) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: opt, children: opt }, opt)) })
                    ]
                  }
                )
              ] }),
              form.headOfIncome === "Business" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "col-span-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Business Name *" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Input,
                  {
                    value: form.businessName,
                    onChange: (e) => setForm((f) => ({ ...f, businessName: e.target.value })),
                    placeholder: "Business / firm name",
                    className: "mt-1"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Tax Year *" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  Select,
                  {
                    value: form.taxYear,
                    onValueChange: (v) => setForm((f) => ({ ...f, taxYear: v })),
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: "mt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {}) }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: TAX_YEARS.map((y) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: y, children: y }, y)) })
                    ]
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Due Date * (DD-MM-YYYY)" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  DatePickerInput,
                  {
                    value: form.dueDate,
                    onChange: (v) => setForm((f) => ({ ...f, dueDate: v })),
                    placeholder: "DD-MM-YYYY",
                    className: "mt-1"
                  }
                )
              ] })
            ] }),
            formError && /* @__PURE__ */ jsxRuntimeExports.jsx(
              "p",
              {
                className: "text-red-600 text-sm bg-red-50 rounded p-2",
                "data-ocid": "clients.error_state",
                children: formError
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-3 pt-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Button,
                {
                  onClick: handleSave,
                  style: { background: "var(--theme-primary, #6B1A2B)" },
                  className: "text-white flex-1",
                  "data-ocid": "clients.submit_button",
                  children: "Save Client"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Button,
                {
                  variant: "outline",
                  onClick: () => setShowForm(false),
                  className: "flex-1",
                  "data-ocid": "clients.cancel_button",
                  children: "Cancel"
                }
              )
            ] })
          ] })
        ]
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      ExcelImportDialog,
      {
        open: importOpen,
        onClose: () => setImportOpen(false),
        currentUserId,
        onImportDone: () => setRefreshKey((k) => k + 1)
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Dialog, { open: showUpgradeModal, onOpenChange: setShowUpgradeModal, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogContent, { className: "max-w-sm", "data-ocid": "trial.dialog", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogHeader, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { style: { color: "var(--theme-primary, #6B1A2B)" }, children: "Trial Limit Reached" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4 mt-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center gap-3 py-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "w-7 h-7 text-amber-600" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm text-gray-700 text-center", children: [
            "You've reached the ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "5 client limit" }),
            " for the Trial plan."
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-gray-500 text-center", children: [
            "Contact your Administrator to upgrade to the",
            " ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Full plan" }),
            " for unlimited clients."
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Button,
          {
            onClick: () => setShowUpgradeModal(false),
            className: "w-full text-white",
            style: { background: "var(--theme-primary, #6B1A2B)" },
            "data-ocid": "trial.close_button",
            children: "OK, Got It"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  ClientMasterPage as default
};
