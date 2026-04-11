import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Download, Upload, FileSpreadsheet, XCircle } from "lucide-react";
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { storage } from "../data/storage";
import { getPanCategory, getHeadOfIncome } from "../types";
import type { Client } from "../types";
import { toast } from "sonner";

type ImportStatus = "idle" | "validating" | "importing" | "success" | "error";

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export default function ImportPage() {
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const primaryColor = "var(--theme-primary, #6B1A2B)";

  // Download template
  const handleDownloadTemplate = () => {
    const template = [
      {
        Name: "Rajesh Kumar",
        PAN: "ABCPK1234F",
        "Head of Income": "Salaried",
        "Business Name": "",
        "Tax Year": "2024-2025",
        "Due Date": "31-07-2025",
        "Client Type": "Existing",
        Mobile: "9876543210",
        Email: "rajesh@example.com",
      },
      {
        Name: "Sharma & Co.",
        PAN: "BCQFS5678G",
        "Head of Income": "Business",
        "Business Name": "Sharma Traders",
        "Tax Year": "2024-2025",
        "Due Date": "31-10-2025",
        "Client Type": "New",
        Mobile: "8765432109",
        Email: "sharma@example.com",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Client Template");
    
    // Set column widths
    ws["!cols"] = [
      { wch: 20 }, // Name
      { wch: 15 }, // PAN
      { wch: 15 }, // Head of Income
      { wch: 20 }, // Business Name
      { wch: 12 }, // Tax Year
      { wch: 12 }, // Due Date
      { wch: 12 }, // Client Type
      { wch: 15 }, // Mobile
      { wch: 25 }, // Email
    ];

    XLSX.writeFile(wb, `TaxCore_Import_Template_${new Date().toLocaleDateString("en-IN").replace(/\//g, "-")}.xlsx`);
    toast.success("Template downloaded successfully!");
  };

  const validateRow = (row: any, rowNum: number): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Required fields
    if (!row.Name || String(row.Name).trim() === "") {
      errors.push({ row: rowNum, field: "Name", message: "Name is required" });
    }
    if (!row.PAN || String(row.PAN).trim() === "") {
      errors.push({ row: rowNum, field: "PAN", message: "PAN is required" });
    } else {
      const pan = String(row.PAN).trim().toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
        errors.push({ row: rowNum, field: "PAN", message: "Invalid PAN format (should be ABCPK1234F)" });
      }
    }
    if (!row.Mobile || String(row.Mobile).trim() === "") {
      errors.push({ row: rowNum, field: "Mobile", message: "Mobile is required" });
    } else {
      const mobile = String(row.Mobile).replace(/\D/g, "");
      if (mobile.length !== 10) {
        errors.push({ row: rowNum, field: "Mobile", message: "Mobile must be 10 digits" });
      }
    }
    if (!row["Tax Year"] || String(row["Tax Year"]).trim() === "") {
      errors.push({ row: rowNum, field: "Tax Year", message: "Tax Year is required" });
    }
    if (!row["Due Date"] || String(row["Due Date"]).trim() === "") {
      errors.push({ row: rowNum, field: "Due Date", message: "Due Date is required" });
    } else {
      const dueDateStr = String(row["Due Date"]).trim();
      if (!/^\d{2}-\d{2}-\d{4}$/.test(dueDateStr)) {
        errors.push({ row: rowNum, field: "Due Date", message: "Due Date must be DD-MM-YYYY format" });
      }
    }

    // Validate Head of Income
    const validHeadOfIncome = ["Salaried", "Business", "Agricultural", "Capital Gain"];
    if (row["Head of Income"] && !validHeadOfIncome.includes(String(row["Head of Income"]).trim())) {
      errors.push({ row: rowNum, field: "Head of Income", message: `Must be one of: ${validHeadOfIncome.join(", ")}` });
    }

    // Validate Client Type
    const validClientTypes = ["Existing", "New"];
    if (row["Client Type"] && !validClientTypes.includes(String(row["Client Type"]).trim())) {
      errors.push({ row: rowNum, field: "Client Type", message: `Must be either: ${validClientTypes.join(", ")}` });
    }

    // Validate Email if provided
    if (row.Email && String(row.Email).trim() !== "") {
      const email = String(row.Email).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ row: rowNum, field: "Email", message: "Invalid email format" });
      }
    }

    return errors;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportStatus("idle");
      setValidationErrors([]);
      setImportedCount(0);
      setDuplicateCount(0);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file to import");
      return;
    }

    setImportStatus("validating");
    setValidationErrors([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error("The file is empty");
        setImportStatus("error");
        return;
      }

      // Validate all rows
      const allErrors: ValidationError[] = [];
      jsonData.forEach((row, idx) => {
        const rowErrors = validateRow(row, idx + 2); // +2 because row 1 is header
        allErrors.push(...rowErrors);
      });

      if (allErrors.length > 0) {
        setValidationErrors(allErrors);
        setImportStatus("error");
        toast.error(`Found ${allErrors.length} validation errors. Please fix them and try again.`);
        return;
      }

      // If validation passed, import the data
      setImportStatus("importing");

      const existingClients = storage.getClients();
      const existingPANs = new Set(existingClients.map(c => c.pan.toUpperCase()));
      const users = storage.getUsers();
      const currentUser = storage.getCurrentUser();
      const ownerUser = users.find(u => u.role === "Owner") || currentUser;

      let imported = 0;
      let duplicates = 0;

      const newClients: Client[] = [];

      for (const row of jsonData as any[]) {
        const pan = String(row.PAN).trim().toUpperCase();
        
        // Check for duplicates
        if (existingPANs.has(pan)) {
          duplicates++;
          continue;
        }

        const client: Client = {
          id: storage.uid(),
          name: String(row.Name).trim(),
          pan,
          mobile: String(row.Mobile).replace(/\D/g, "").slice(0, 10),
          email: row.Email ? String(row.Email).trim() : "",
          clientType: (row["Client Type"] || "Existing") as "Existing" | "New",
          headOfIncome: (row["Head of Income"] || "Salaried") as any,
          businessName: row["Business Name"] ? String(row["Business Name"]).trim() : "",
          taxYear: String(row["Tax Year"]).trim(),
          dueDate: String(row["Due Date"]).trim(),
          clientCategory: getPanCategory(pan),
          createdAt: new Date().toISOString(),
          createdBy: ownerUser?.id || "system",
        };

        newClients.push(client);
        existingPANs.add(pan);
        imported++;
      }

      // Save all new clients
      if (newClients.length > 0) {
        const updatedClients = [...existingClients, ...newClients];
        storage.saveClients(updatedClients);
      }

      setImportedCount(imported);
      setDuplicateCount(duplicates);
      setImportStatus("success");
      toast.success(`Successfully imported ${imported} clients!`);
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setFile(null);
    } catch (err) {
      console.error("Import error:", err);
      setImportStatus("error");
      toast.error("Failed to import file. Please check the file format.");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2
          className="text-lg font-semibold mb-1"
          style={{ color: primaryColor }}
        >
          Import Clients
        </h2>
        <p className="text-sm text-gray-500">
          Upload an Excel file to bulk import client data into TaxCore
        </p>
      </div>

      {/* Step 1: Download Template */}
      <div
        className="rounded-lg border p-5"
        style={{
          background: "rgba(37,99,235,0.04)",
          borderColor: "rgba(37,99,235,0.2)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "#2563EB15" }}
          >
            <FileSpreadsheet className="w-5 h-5" style={{ color: "#2563EB" }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "#2563EB" }}
              >
                1
              </span>
              <h3 className="font-semibold text-sm" style={{ color: "#2563EB" }}>
                Download Template
              </h3>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              Download the Excel template with sample data and required column headers
            </p>
            <Button
              onClick={handleDownloadTemplate}
              size="sm"
              className="text-white"
              style={{ background: "#2563EB" }}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download Template
            </Button>
          </div>
        </div>
      </div>

      {/* Step 2: Fill Template */}
      <div
        className="rounded-lg border p-5"
        style={{
          background: "rgba(217,119,6,0.04)",
          borderColor: "rgba(217,119,6,0.2)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "#D9770615" }}
          >
            <FileSpreadsheet className="w-5 h-5" style={{ color: "#D97706" }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "#D97706" }}
              >
                2
              </span>
              <h3 className="font-semibold text-sm" style={{ color: "#D97706" }}>
                Fill Template with Client Data
              </h3>
            </div>
            <p className="text-xs text-gray-600">
              Open the template in Excel/Google Sheets and fill in your client details
            </p>
            <ul className="text-xs text-gray-500 mt-2 space-y-0.5 list-disc list-inside">
              <li><strong>Required fields:</strong> Name, PAN, Mobile, Tax Year, Due Date</li>
              <li><strong>PAN Format:</strong> ABCPK1234F (5 letters, 4 digits, 1 letter)</li>
              <li><strong>Due Date Format:</strong> DD-MM-YYYY (e.g., 31-07-2025)</li>
              <li><strong>Head of Income:</strong> Salaried, Business, Agricultural, or Capital Gain</li>
              <li><strong>Client Type:</strong> Existing or New</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Step 3: Upload & Import */}
      <div
        className="rounded-lg border p-5"
        style={{
          background: "rgba(22,163,74,0.04)",
          borderColor: "rgba(22,163,74,0.2)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "#16A34A15" }}
          >
            <Upload className="w-5 h-5" style={{ color: "#16A34A" }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "#16A34A" }}
              >
                3
              </span>
              <h3 className="font-semibold text-sm" style={{ color: "#16A34A" }}>
                Upload & Import
              </h3>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              Upload your filled Excel file to import clients
            </p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="file-upload" className="text-xs font-medium text-gray-700">
                  Select Excel File
                </Label>
                <Input
                  ref={fileInputRef}
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="mt-1"
                  data-testid="import-file-input"
                />
                {file && (
                  <p className="text-xs text-gray-500 mt-1">
                    Selected: {file.name}
                  </p>
                )}
              </div>
              <Button
                onClick={handleImport}
                disabled={!file || importStatus === "validating" || importStatus === "importing"}
                className="text-white"
                style={{ background: "#16A34A" }}
                data-testid="import-submit-button"
              >
                {importStatus === "validating" && "Validating..."}
                {importStatus === "importing" && "Importing..."}
                {importStatus !== "validating" && importStatus !== "importing" && (
                  <>
                    <Upload className="w-4 h-4 mr-1.5" />
                    Import Clients
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {importStatus === "success" && (
        <div
          className="rounded-lg border p-4 flex items-start gap-3"
          style={{ background: "#F0FDF4", borderColor: "#BBF7D0" }}
          data-testid="import-success-message"
        >
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-green-800">Import Successful!</p>
            <p className="text-xs text-green-700 mt-0.5">
              {importedCount} clients imported successfully.
              {duplicateCount > 0 && ` ${duplicateCount} duplicates were skipped (PAN already exists).`}
            </p>
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {importStatus === "error" && validationErrors.length > 0 && (
        <div
          className="rounded-lg border p-4"
          style={{ background: "#FEF2F2", borderColor: "#FCA5A5" }}
          data-testid="import-error-message"
        >
          <div className="flex items-start gap-3 mb-3">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-red-800">Validation Errors Found</p>
              <p className="text-xs text-red-700 mt-0.5">
                Please fix the following errors in your Excel file and try again:
              </p>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1.5">
            {validationErrors.map((err, idx) => (
              <div key={idx} className="text-xs text-red-700 bg-white rounded px-2 py-1.5 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Row {err.row}, {err.field}:</strong> {err.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import Notes */}
      <div
        className="rounded-lg border p-3 text-xs text-gray-500"
        style={{ background: "#f9f7f4", borderColor: "rgba(107,26,43,0.1)" }}
      >
        <p className="font-medium text-gray-700 mb-1">Import Notes:</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>Duplicate clients (same PAN) will be skipped automatically</li>
          <li>All validation must pass before import begins</li>
          <li>Excel files (.xlsx, .xls) are supported</li>
          <li>Maximum recommended: 500 clients per file</li>
          <li>Imported clients will be assigned to the current owner account</li>
        </ul>
      </div>
    </div>
  );
}
