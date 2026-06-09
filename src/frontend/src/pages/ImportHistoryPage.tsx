/**
 * ImportHistoryPage.tsx
 *
 * Shows a log of all past Excel imports:
 * date/time, mode (Merge/Replace), row counts per tab, and
 * a "Download Changes" button to export only the rows that were added
 * or modified during that specific import.
 */
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileDown,
  GitMerge,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { getImportHistory, onStorageChange } from "../data/storage";
import { getHeadOfIncome } from "../types";
import type { ImportHistoryEntry } from "../types";

interface Props {
  onBack: () => void;
}

// ─── Excel export for changed rows ───────────────────────────────────────────

function downloadChanges(entry: ImportHistoryEntry): void {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date(entry.importedAt)
    .toLocaleDateString("en-IN")
    .replace(/\//g, "-");

  // Client Master sheet
  const clientHeaders = [
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
  ];
  const clientRows =
    entry.changedRows.clients.length > 0
      ? entry.changedRows.clients.map((c, idx) => [
          idx + 1,
          c.name,
          c.pan,
          getHeadOfIncome(c),
          c.businessName || "-",
          c.clientCategory,
          c.taxYear,
          c.dueDate,
          c.clientType,
          c.mobile,
          c.email || "-",
          new Date(c.createdAt).toLocaleDateString("en-IN"),
        ])
      : [["No changes in this section"]];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([clientHeaders, ...clientRows]),
    "Client Master",
  );

  // Work Processing sheet
  const workHeaders = [
    "Sr.No.",
    "Client ID",
    "Tax Year",
    "Return Type",
    "Work Status",
    "Filing Status",
    "ITR Form",
    "Acknowledgement Number",
    "Filing Date",
    "Remarks",
  ];
  const workRows =
    entry.changedRows.workProcessing.length > 0
      ? entry.changedRows.workProcessing.map((w, idx) => [
          idx + 1,
          w.clientId,
          w.taxYear,
          w.returnType || "Original",
          w.status,
          w.filingStatus || "Pending",
          w.itrForm || "-",
          w.ackNumber || "-",
          w.filingDate || "-",
          w.remark || "-",
        ])
      : [["No changes in this section"]];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([workHeaders, ...workRows]),
    "Work Processing",
  );

  // Document Inward sheet
  const docHeaders = [
    "Sr.No.",
    "Client ID",
    "Date",
    "Mode",
    "Status",
    "Remarks",
  ];
  const docRows =
    entry.changedRows.documentInward.length > 0
      ? entry.changedRows.documentInward.map((d, idx) => [
          idx + 1,
          d.clientId,
          d.date,
          d.mode,
          d.status,
          d.remarks || "-",
        ])
      : [["No changes in this section"]];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([docHeaders, ...docRows]),
    "Document Inward",
  );

  // Billing sheet
  const billingHeaders = [
    "Sr.No.",
    "Client ID",
    "Tax Year",
    "Bill Amount (₹)",
    "Receipt (₹)",
    "Balance (₹)",
    "Outward Status",
  ];
  const billingRows =
    entry.changedRows.billing.length > 0
      ? entry.changedRows.billing.map((b, idx) => [
          idx + 1,
          b.clientId,
          b.taxYear,
          b.billAmount,
          b.receipt,
          b.balance,
          b.outwardStatus,
        ])
      : [["No changes in this section"]];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([billingHeaders, ...billingRows]),
    "Billing",
  );

  XLSX.writeFile(wb, `taxcore-import-changes-${dateStr}.xlsx`);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ModeBadge({ mode }: { mode: "Merge" | "Replace" }) {
  if (mode === "Merge") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700">
        <GitMerge className="w-3 h-3" /> Merge
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
      <RefreshCw className="w-3 h-3" /> Replace
    </span>
  );
}

function CountCell({
  added,
  updated,
  skipped,
}: {
  added: number;
  updated: number;
  skipped: number;
}) {
  return (
    <div className="flex flex-col gap-0.5 text-[11px] leading-tight">
      {added > 0 && (
        <span className="text-green-700 font-medium">{added} added</span>
      )}
      {updated > 0 && (
        <span className="text-blue-700 font-medium">{updated} updated</span>
      )}
      {skipped > 0 && <span className="text-gray-400">{skipped} skipped</span>}
      {added === 0 && updated === 0 && skipped === 0 && (
        <span className="text-gray-300">—</span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ImportHistoryPage({ onBack }: Props) {
  const [history, setHistory] = useState<ImportHistoryEntry[]>(() =>
    getImportHistory()
      .slice()
      .sort(
        (a, b) =>
          new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime(),
      ),
  );

  useEffect(() => {
    const unsub = onStorageChange(() => {
      setHistory(
        getImportHistory()
          .slice()
          .sort(
            (a, b) =>
              new Date(b.importedAt).getTime() -
              new Date(a.importedAt).getTime(),
          ),
      );
    });
    return unsub;
  }, []);

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity"
          style={{ color: "var(--theme-primary, #6B1A2B)" }}
          data-ocid="import_history.back_button"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Export
        </button>
      </div>

      <div>
        <h2
          className="text-lg font-semibold mb-1"
          style={{ color: "var(--theme-primary, #6B1A2B)" }}
        >
          Import History
        </h2>
        <p className="text-sm text-gray-500">
          A log of all past Excel imports. Download the changed rows from any
          import as an Excel file.
        </p>
      </div>

      {/* Empty state */}
      {history.length === 0 && (
        <div
          className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-16 text-center"
          style={{ borderColor: "rgba(107,26,43,0.18)" }}
          data-ocid="import_history.empty_state"
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ background: "rgba(107,26,43,0.07)" }}
          >
            <FileDown
              className="w-7 h-7"
              style={{ color: "var(--theme-primary, #6B1A2B)" }}
            />
          </div>
          <p
            className="text-base font-semibold mb-1"
            style={{ color: "var(--theme-primary, #6B1A2B)" }}
          >
            No imports yet
          </p>
          <p className="text-sm text-gray-400 max-w-xs">
            Once you import data from Excel, each import will appear here with a
            full record of what changed.
          </p>
        </div>
      )}

      {/* History table */}
      {history.length > 0 && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: "rgba(107,26,43,0.15)" }}
          data-ocid="import_history.table"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr
                  style={{
                    background: "var(--theme-primary, #6B1A2B)",
                  }}
                >
                  <th className="text-left py-3 px-3 text-white font-semibold text-xs w-10">
                    #
                  </th>
                  <th className="text-left py-3 px-3 text-white font-semibold text-xs whitespace-nowrap">
                    Date &amp; Time
                  </th>
                  <th className="text-left py-3 px-3 text-white font-semibold text-xs">
                    Mode
                  </th>
                  <th className="text-left py-3 px-3 text-white font-semibold text-xs">
                    Imported By
                  </th>
                  <th className="text-left py-3 px-3 text-white font-semibold text-xs">
                    Client Master
                  </th>
                  <th className="text-left py-3 px-3 text-white font-semibold text-xs">
                    Work Processing
                  </th>
                  <th className="text-left py-3 px-3 text-white font-semibold text-xs">
                    Documents
                  </th>
                  <th className="text-left py-3 px-3 text-white font-semibold text-xs">
                    Billing
                  </th>
                  <th className="text-left py-3 px-3 text-white font-semibold text-xs">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                    style={{ borderColor: "rgba(107,26,43,0.08)" }}
                    data-ocid={`import_history.item.${idx + 1}`}
                  >
                    <td className="py-3 px-3 text-gray-400 text-xs font-mono">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="text-xs font-medium text-gray-800">
                        {new Date(entry.importedAt).toLocaleDateString(
                          "en-IN",
                          { day: "2-digit", month: "short", year: "numeric" },
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {new Date(entry.importedAt).toLocaleTimeString(
                          "en-IN",
                          { hour: "2-digit", minute: "2-digit", hour12: true },
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <ModeBadge mode={entry.mode} />
                    </td>
                    <td className="py-3 px-3 text-xs text-gray-700 font-medium">
                      {entry.importedBy}
                    </td>
                    <td className="py-3 px-3">
                      <CountCell {...entry.tabCounts.clients} />
                    </td>
                    <td className="py-3 px-3">
                      <CountCell {...entry.tabCounts.workProcessing} />
                    </td>
                    <td className="py-3 px-3">
                      <CountCell {...entry.tabCounts.documentInward} />
                    </td>
                    <td className="py-3 px-3">
                      <CountCell {...entry.tabCounts.billing} />
                    </td>
                    <td className="py-3 px-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadChanges(entry)}
                        className="gap-1.5 text-xs h-7"
                        style={{
                          borderColor: "var(--theme-primary, #6B1A2B)",
                          color: "var(--theme-primary, #6B1A2B)",
                        }}
                        data-ocid={`import_history.download_button.${idx + 1}`}
                      >
                        <Download className="w-3 h-3" />
                        Download Changes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      {history.length > 0 && (
        <div
          className="rounded-lg border p-3 text-xs text-gray-500"
          style={{
            background: "#f9f7f4",
            borderColor: "rgba(107,26,43,0.1)",
          }}
        >
          <p className="font-medium text-gray-700 mb-1">
            Download Changes Notes:
          </p>
          <ul className="space-y-0.5 list-disc list-inside">
            <li>
              Downloads an .xlsx file with 4 sheets: Client Master, Work
              Processing, Document Inward, Billing
            </li>
            <li>Only rows added or modified during that import are included</li>
            <li>Sheets with no changes show "No changes in this section"</li>
            <li>
              File is named:{" "}
              <code className="font-mono text-gray-600">
                taxcore-import-changes-DD-MM-YYYY.xlsx
              </code>
            </li>
          </ul>
        </div>
      )}

      {/* Total count */}
      {history.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          {history.length} import{history.length !== 1 ? "s" : ""} in history
        </p>
      )}
    </div>
  );
}
