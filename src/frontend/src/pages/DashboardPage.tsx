import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  FileX,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import InlineStatusCell from "../components/InlineStatusCell";
import {
  getClientWork,
  getDeadlineAlertClients,
  getEVerificationAlerts,
  getLatestDoc,
  getLatestDocStatus,
  getPanCategory,
  onStorageChange,
  queueDueDateNotifications,
  refreshFromCanister,
  storage,
} from "../data/storage-api";
import type { Client, User, WorkProcessing } from "../types";
import { getTaxYears } from "../utils/taxYears";

const TAX_YEARS = ["All", ...getTaxYears()];

const WORK_STATUS_OPTIONS = [
  {
    label: "Pending",
    value: "Pending",
    colorClass: "bg-orange-100 text-orange-700",
  },
  {
    label: "In Progress",
    value: "In Progress",
    colorClass: "bg-blue-100 text-blue-700",
  },
  {
    label: "Completed",
    value: "Completed",
    colorClass: "bg-green-100 text-green-700",
  },
];

const DOC_STATUS_OPTIONS = [
  {
    label: "Complete",
    value: "Complete",
    colorClass: "bg-emerald-100 text-emerald-700",
  },
  {
    label: "Partial",
    value: "Partial",
    colorClass: "bg-yellow-100 text-yellow-700",
  },
];

// Tab definitions with colors and tooltips
const TAB_DEFS = [
  {
    key: "total",
    label: "Total Clients",
    bgColor: "#d3d1c7",
    textColor: "#2C2C2A",
    tooltip: "All registered clients in your firm",
    icon: Users,
  },
  {
    key: "pending",
    label: "Pending Work",
    bgColor: "#fac775",
    textColor: "#2C2C2A",
    tooltip: "Tasks due or in progress across all clients",
    icon: Clock,
  },
  {
    key: "pendingITR",
    label: "ITR Pending for Filing",
    bgColor: "#f5c4b3",
    textColor: "#2C2C2A",
    tooltip: "Returns prepared but not yet submitted to the portal",
    icon: FileX,
  },
  {
    key: "itrFiled",
    label: "ITR Filed",
    bgColor: "#c0dd97",
    textColor: "#2C2C2A",
    tooltip: "Returns successfully submitted and acknowledged",
    icon: CheckCircle,
  },
  {
    key: "pendingVerif",
    label: "Pending for Verification",
    bgColor: "#b5d4f4",
    textColor: "#2C2C2A",
    tooltip: "Filed returns awaiting e-verification from client",
    icon: ShieldCheck,
  },
  {
    key: "eVerified",
    label: "ITR E-Verified",
    bgColor: "#5dcaa5",
    textColor: "#F1EFE8",
    tooltip: "Returns fully e-verified — process complete",
    icon: CheckCircle,
    isNew: true,
  },
] as const;

type TabKey = (typeof TAB_DEFS)[number]["key"];

function computeStats(taxYear: string, userId: string, userRole: string) {
  let allClients = storage.getClients();
  // Staff: only see their own clients
  if (userRole === "Staff") {
    allClients = allClients.filter((c) => c.createdBy === userId);
  }
  const clients: Client[] =
    taxYear === "All"
      ? allClients
      : allClients.filter((c) => c.taxYear === taxYear);
  const allWork = storage.getWork();
  const allBilling = storage.getBilling();

  const clientIds = new Set(clients.map((c) => c.id));
  const work = allWork.filter((w) => clientIds.has(w.clientId));
  const billing = allBilling.filter((b) => clientIds.has(b.clientId));

  const recentClients = allClients.slice(-10).reverse();

  // Pending Work = Work Status is Pending or In Progress
  const pending = work.filter(
    (w) => w.status === "Pending" || w.status === "In Progress",
  ).length;

  // Pending ITR Filed = Filing Status is Pending (return not yet filed)
  const pendingITR = work.filter(
    (w) => !w.filingStatus || w.filingStatus === "Pending",
  ).length;

  // ITR Filed = E-Verified + Pending for E-verification (return has been filed)
  const itrFiled = work.filter(
    (w) =>
      w.filingStatus === "E-Verified" ||
      w.filingStatus === "Pending for E-verification",
  ).length;

  // Pending for Verification = returns awaiting e-verification
  const pendingForVerification = work.filter(
    (w) => w.filingStatus === "Pending for E-verification",
  ).length;

  // E-Verified = fully e-verified
  const eVerified = work.filter((w) => w.filingStatus === "E-Verified").length;

  return {
    total: clients.length,
    pending,
    pendingITR,
    itrFiled,
    pendingForVerification,
    eVerified,
    ready: billing.filter((b) => b.outwardStatus === "Ready").length,
    recentClients,
    clients,
  };
}

interface DashboardPageProps {
  user: User;
}

export default function DashboardPage({ user }: DashboardPageProps) {
  const [taxYear, setTaxYear] = useState("All");
  const [stats, setStats] = useState(() =>
    computeStats("All", user.id, user.role),
  );
  const [alertClients, setAlertClients] = useState(() =>
    getDeadlineAlertClients(user.id, user.role),
  );
  const [eVerifAlerts, setEVerifAlerts] = useState(() =>
    getEVerificationAlerts(),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cardsLoading, setCardsLoading] = useState(
    storage.getClients().length === 0 && storage.getWork().length === 0,
  );
  const [activeTab, setActiveTab] = useState<TabKey>("total");
  const [hoveredTab, setHoveredTab] = useState<TabKey | null>(null);

  const refresh = useCallback(
    (year: string) => {
      setStats(computeStats(year, user.id, user.role));
      setAlertClients(getDeadlineAlertClients(user.id, user.role));
      setEVerifAlerts(getEVerificationAlerts());
    },
    [user.id, user.role],
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshFromCanister();
      refresh(taxYear);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refresh(taxYear);
  }, [taxYear, refresh]);

  useEffect(() => {
    const unsub = onStorageChange(() => {
      setCardsLoading(false);
      refresh(taxYear);
    });
    // If already loaded (cache exists), don't show skeleton
    if (storage.getClients().length > 0 || storage.getWork().length > 0) {
      setCardsLoading(false);
    }
    return unsub;
  }, [taxYear, refresh]);

  const handleWorkStatusSave = (client: Client, newVal: string) => {
    const work = getClientWork(client.id);
    if (!work) return;
    const oldVal = work.status;
    if (oldVal === newVal) return;

    const allWork = storage.getWork();
    storage.saveWork(
      allWork.map((w) =>
        w.id === work.id
          ? {
              ...w,
              status: newVal as WorkProcessing["status"],
              updatedAt: new Date().toISOString(),
            }
          : w,
      ),
    );

    storage.addAuditLog({
      id: storage.uid(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "Updated Work Status",
      clientId: client.id,
      clientName: client.name,
      fieldChanged: "Work Status",
      oldValue: oldVal,
      newValue: newVal,
      timestamp: new Date().toISOString(),
    });

    toast.success("Status updated", {
      description: `${client.name} \u2192 ${newVal}`,
    });
  };

  const handleDocStatusSave = (client: Client, newVal: string) => {
    const latestDoc = getLatestDoc(client.id);
    const oldVal = latestDoc?.status ?? "-";
    if (oldVal === newVal) return;

    if (latestDoc) {
      const allDocs = storage.getDocuments();
      storage.saveDocuments(
        allDocs.map((d) =>
          d.id === latestDoc.id
            ? { ...d, status: newVal as "Complete" | "Partial" }
            : d,
        ),
      );
    }

    storage.addAuditLog({
      id: storage.uid(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "Updated Inward Docs Status",
      clientId: client.id,
      clientName: client.name,
      fieldChanged: "Inward Docs Status",
      oldValue: oldVal,
      newValue: newVal,
      timestamp: new Date().toISOString(),
    });

    toast.success("Doc status updated", {
      description: `${client.name} \u2192 ${newVal}`,
    });
  };

  const handleQueueWhatsAppAlerts = () => {
    const queued = queueDueDateNotifications(user);
    const whatsappSettings = storage.getWhatsAppSettings();
    const hasApiKey = (whatsappSettings?.apiKey?.trim().length ?? 0) > 0;

    if (queued === 0) {
      toast.info("No new alerts to queue", {
        description: "All due date alerts are already queued.",
      });
      return;
    }

    if (!hasApiKey) {
      toast.success(`${queued} alert${queued > 1 ? "s" : ""} queued`, {
        description: "Queued \u2014 add API key in Settings to send.",
      });
    } else {
      toast.success(
        `${queued} alert${queued > 1 ? "s" : ""} queued for WhatsApp`,
        {
          description: "Notifications are ready to send once triggered.",
        },
      );
    }
  };

  // Tab count values
  const tabCounts: Record<TabKey, number> = {
    total: stats.total,
    pending: stats.pending,
    pendingITR: stats.pendingITR,
    itrFiled: stats.itrFiled,
    pendingVerif: stats.pendingForVerification,
    eVerified: stats.eVerified,
  };

  // Get filtered clients for current tab
  const allWork = storage.getWork();
  const getTabClients = (): Client[] => {
    const clientIds = new Set(stats.clients.map((c) => c.id));
    const filteredWork = allWork.filter((w) => clientIds.has(w.clientId));
    if (activeTab === "total") return stats.clients;
    if (activeTab === "pending")
      return stats.clients.filter((c) => {
        const w = filteredWork.find((fw) => fw.clientId === c.id);
        return w?.status === "Pending" || w?.status === "In Progress";
      });
    if (activeTab === "pendingITR")
      return stats.clients.filter((c) => {
        const w = filteredWork.find((fw) => fw.clientId === c.id);
        return !w?.filingStatus || w?.filingStatus === "Pending";
      });
    if (activeTab === "itrFiled")
      return stats.clients.filter((c) => {
        const w = filteredWork.find((fw) => fw.clientId === c.id);
        return (
          w?.filingStatus === "E-Verified" ||
          w?.filingStatus === "Pending for E-verification"
        );
      });
    if (activeTab === "pendingVerif")
      return stats.clients.filter((c) => {
        const w = filteredWork.find((fw) => fw.clientId === c.id);
        return w?.filingStatus === "Pending for E-verification";
      });
    if (activeTab === "eVerified")
      return stats.clients.filter((c) => {
        const w = filteredWork.find((fw) => fw.clientId === c.id);
        return w?.filingStatus === "E-Verified";
      });
    return stats.clients;
  };

  const tabClients = getTabClients();

  const whatsappEnabled =
    storage.getWhatsAppSettings()?.dueDateAlertEnabled ?? false;

  const highEVerifAlerts = eVerifAlerts.filter((a) => a.urgency === "high");
  const normalEVerifAlerts = eVerifAlerts.filter((a) => a.urgency === "normal");

  const urgencyBadgeClass = (urgency: "red" | "amber" | "yellow") => {
    if (urgency === "red") return "bg-red-600 text-white";
    if (urgency === "yellow") return "bg-yellow-500 text-white";
    return "bg-amber-500 text-white";
  };

  const greeting =
    user.role === "Staff" ? (
      <div
        className="rounded-lg p-2.5 border"
        style={{
          background: "var(--theme-primary-light, rgba(107,26,43,0.05))",
          borderColor: "rgba(107,26,43,0.15)",
        }}
        data-ocid="dashboard.greeting.panel"
      >
        <p
          className="text-sm font-semibold"
          style={{ color: "var(--theme-primary, #6B1A2B)" }}
        >
          Welcome, {user.name}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          You are viewing your assigned clients.
        </p>
      </div>
    ) : (
      <div
        className="rounded-lg p-2.5 border flex items-center justify-between"
        style={{
          background: "rgba(201,164,76,0.08)",
          borderColor: "rgba(201,164,76,0.3)",
        }}
        data-ocid="dashboard.greeting.panel"
      >
        <div>
          <p
            className="text-sm font-semibold"
            style={{
              color: "var(--theme-primary, #6B1A2B)",
              fontFamily: "'Playfair Display', Georgia, serif",
            }}
          >
            Welcome back, {user.name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {user.accessType ? ` \u00b7 ${user.accessType} Plan` : ""}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs">
          <div className="text-center">
            <div className="font-bold text-lg" style={{ color: "#2563EB" }}>
              {stats.total}
            </div>
            <div className="text-gray-500">Clients</div>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="text-center">
            <div className="font-bold text-lg" style={{ color: "#D97706" }}>
              {stats.pending}
            </div>
            <div className="text-gray-500">Pending</div>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="text-center">
            <div className="font-bold text-lg" style={{ color: "#16A34A" }}>
              {stats.itrFiled}
            </div>
            <div className="text-gray-500">Completed</div>
          </div>
        </div>
      </div>
    );

  return (
    <div className="space-y-3">
      {greeting}

      <div className="flex items-center gap-3">
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--theme-primary, #6B1A2B)" }}
        >
          Overview
        </h2>
        <Select value={taxYear} onValueChange={setTaxYear}>
          <SelectTrigger className="w-36" data-ocid="dashboard.filter.select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TAX_YEARS.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition"
          title="Refresh from server"
          data-ocid="dashboard.refresh.button"
        >
          {isRefreshing ? (
            <span
              className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
              style={{
                borderColor: "var(--theme-primary, #6B1A2B)",
                borderTopColor: "transparent",
              }}
            />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
          )}
          <span className="text-gray-600">
            {isRefreshing ? "Refreshing\u2026" : "Refresh"}
          </span>
        </button>
      </div>

      {/* Tab Strip — 6 tabs, single non-wrapping row */}
      {cardsLoading ? (
        <div
          className="flex gap-2"
          style={{ overflowX: "auto" }}
          data-ocid="dashboard.loading_state"
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-lg border bg-white p-3 shadow-sm animate-pulse"
              style={{ flex: "1", minWidth: 0 }}
            >
              <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-6 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        /* Tab Strip outer wrapper: overflowX:auto for scrolling, overflowY:visible so tooltip shows */
        <div
          className="no-scrollbar"
          style={{
            overflowX: "auto",
            overflowY: "visible",
            paddingBottom: "36px",
            marginBottom: "-36px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "nowrap",
              gap: "8px",
              minWidth: "max-content",
              width: "100%",
            }}
            data-ocid="dashboard.tabs.strip"
          >
            {TAB_DEFS.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = tabCounts[tab.key];
              return (
                <div
                  key={tab.key}
                  style={{ flex: "1", minWidth: "100px", position: "relative" }}
                  onMouseEnter={() => setHoveredTab(tab.key)}
                  onMouseLeave={() => setHoveredTab(null)}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    data-ocid={`dashboard.tab.${tab.key}`}
                    style={{
                      width: "100%",
                      backgroundColor: tab.bgColor,
                      color: tab.textColor,
                      border: isActive
                        ? `2px solid ${tab.textColor === "#2C2C2A" ? "rgba(44,44,42,0.5)" : "rgba(241,239,232,0.5)"}`
                        : "2px solid transparent",
                      borderRadius: "10px",
                      padding: "8px 6px",
                      cursor: "pointer",
                      boxShadow: isActive
                        ? "0 2px 8px rgba(0,0,0,0.18)"
                        : "0 1px 3px rgba(0,0,0,0.08)",
                      transition: "box-shadow 0.15s, border 0.15s",
                      textAlign: "center",
                      outline: "none",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "center",
                        gap: "3px",
                        marginBottom: "4px",
                        width: "100%",
                      }}
                    >
                      {tab.key === "eVerified" && (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          style={{ flexShrink: 0, marginTop: "1px" }}
                          aria-hidden="true"
                        >
                          <circle
                            cx="8"
                            cy="8"
                            r="7"
                            fill="rgba(241,239,232,0.25)"
                          />
                          <path
                            d="M5 8.5L7 10.5L11 6"
                            stroke="#F1EFE8"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: tab.textColor,
                          lineHeight: 1.2,
                          whiteSpace: "normal",
                          wordWrap: "break-word",
                          textAlign: "center",
                          minWidth: 0,
                        }}
                      >
                        {tab.label}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "22px",
                        fontWeight: 700,
                        color: tab.textColor,
                        lineHeight: 1,
                        display: "block",
                      }}
                    >
                      {count}
                    </span>
                  </button>

                  {/* Hover Tooltip — rendered outside overflow-hidden parent */}
                  {hoveredTab === tab.key && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        backgroundColor: "#2C2C2A",
                        color: "#F1EFE8",
                        fontSize: "11px",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        whiteSpace: "nowrap",
                        zIndex: 20,
                        pointerEvents: "none",
                      }}
                      role="tooltip"
                    >
                      {tab.tooltip}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Data Consistency Alert: Pending ITR should not exceed Pending Work */}
      {stats.pendingITR > stats.pending && (
        <div
          className="border border-l-4 rounded-lg p-3 bg-amber-50 border-amber-300 border-l-amber-500"
          data-ocid="dashboard.consistency_alert.panel"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="font-semibold text-amber-700 text-sm">
              &#9888; Data Inconsistency Alert
            </span>
          </div>
          <p className="text-xs text-amber-700 mt-1.5">
            Pending ITR Filed ({stats.pendingITR}) cannot exceed Pending Work (
            {stats.pending}). Please review Work Processing records to ensure
            data accuracy.
          </p>
        </div>
      )}

      {/* E-Verification Deadline Alert - HIGH PRIORITY */}
      {highEVerifAlerts.length > 0 && (
        <div
          className="border border-l-4 rounded-lg p-3 bg-red-50 border-red-200 border-l-red-600"
          data-ocid="dashboard.everif_high.panel"
        >
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span className="font-semibold text-red-700 text-sm">
              &#9888; HIGH PRIORITY: E-Verification Deadline
            </span>
            <span className="ml-auto text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">
              {highEVerifAlerts.length} urgent
            </span>
          </div>
          <div className="space-y-1">
            {highEVerifAlerts.map(({ client, work, daysToDeadline }) => (
              <div
                key={work.id}
                className="flex items-center justify-between text-sm bg-white rounded px-3 py-1.5 border border-red-100"
              >
                <span className="font-semibold text-gray-800">
                  {client.name}
                </span>
                <span className="text-gray-500 text-xs font-mono">
                  {client.pan}
                </span>
                <span className="text-gray-600 text-xs">
                  Filed: {work.filingDate || "\u2014"}
                </span>
                <span className="font-bold text-xs px-2 py-0.5 rounded-full bg-red-600 text-white">
                  {daysToDeadline <= 0
                    ? "OVERDUE"
                    : `${daysToDeadline}d to verify`}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-red-600 mt-1.5 font-medium">
            E-verification must be completed within 30 days of filing date.
          </p>
        </div>
      )}

      {/* E-Verification Deadline Alert - NORMAL */}
      {normalEVerifAlerts.length > 0 && (
        <div
          className="border border-l-4 rounded-lg p-3 bg-amber-50 border-amber-200 border-l-amber-500"
          data-ocid="dashboard.everif_normal.panel"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="font-semibold text-amber-700 text-sm">
              E-Verification Deadline Alert ({normalEVerifAlerts.length})
            </span>
          </div>
          <div className="space-y-1">
            {normalEVerifAlerts.map(({ client, work, daysToDeadline }) => (
              <div
                key={work.id}
                className="flex items-center justify-between text-sm bg-white rounded px-3 py-1.5 border border-amber-100"
              >
                <span className="font-medium text-gray-800">{client.name}</span>
                <span className="text-gray-600 text-xs">
                  Filed: {work.filingDate || "\u2014"}
                </span>
                <span className="font-bold text-xs px-2 py-0.5 rounded-full bg-amber-500 text-white">
                  {daysToDeadline}d remaining
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Due Date Alerts */}
      {alertClients.length > 0 && (
        <div
          className={`border border-l-4 rounded-lg p-3 ${
            alertClients.some((a) => a.urgency === "red")
              ? "bg-red-50 border-red-200 border-l-red-500"
              : alertClients.some((a) => a.urgency === "yellow")
                ? "bg-yellow-50 border-yellow-200 border-l-yellow-500"
                : "bg-amber-50 border-amber-200 border-l-amber-500"
          }`}
          data-ocid="dashboard.alert.panel"
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={`w-4 h-4 flex-shrink-0 ${
                  alertClients.some((a) => a.urgency === "red")
                    ? "text-red-500"
                    : "text-amber-500"
                }`}
              />
              <span
                className={`font-semibold text-sm ${
                  alertClients.some((a) => a.urgency === "red")
                    ? "text-red-700"
                    : "text-amber-700"
                }`}
              >
                {alertClients.length} client{alertClients.length > 1 ? "s" : ""}{" "}
                with due date within 10 days
              </span>
            </div>
            {whatsappEnabled && (
              <Button
                size="sm"
                onClick={handleQueueWhatsAppAlerts}
                className="flex items-center gap-1.5 text-xs font-medium flex-shrink-0"
                style={{
                  background: "var(--theme-gold, #C9A44C)",
                  color: "#fff",
                  border: "none",
                }}
                data-ocid="dashboard.queue_whatsapp.button"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Queue Alerts
              </Button>
            )}
          </div>
          <div className="space-y-1">
            {alertClients.map(({ client, daysLeft, urgency }) => (
              <div
                key={client.id}
                className="flex items-center justify-between text-sm bg-white rounded px-3 py-1.5 border border-gray-100"
              >
                <span className="font-medium text-gray-800">{client.name}</span>
                <span className="text-gray-500 text-xs font-mono">
                  {client.pan}
                </span>
                <span className="text-gray-600 text-xs">{client.dueDate}</span>
                <span
                  className={`font-bold text-xs px-2 py-0.5 rounded-full ${urgencyBadgeClass(urgency)}`}
                >
                  {daysLeft < 0
                    ? `${Math.abs(daysLeft)}d OVERDUE`
                    : daysLeft === 0
                      ? "TODAY"
                      : `${daysLeft}d left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 6: E-Verified Summary Cards + Table */}
      {activeTab === "eVerified" ? (
        <div className="space-y-3" data-ocid="dashboard.everified.section">
          {/* 3 Summary Mini-Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              {
                label: "Total E-verified",
                value: tabClients.length,
                color: "#16A34A",
              },
              {
                label: "Verified via Aadhaar OTP",
                value: 0,
                color: "#0D9488",
              },
              {
                label: "Verified via other methods",
                value: 0,
                color: "#6366F1",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-lg border bg-white shadow-sm p-3"
                style={{ borderColor: "#d1fae5" }}
              >
                <p className="text-xs text-gray-500 font-medium mb-1">
                  {card.label}
                </p>
                <span
                  className="text-xl font-bold"
                  style={{ color: card.color }}
                >
                  {card.value}
                </span>
              </div>
            ))}
          </div>

          {/* E-Verified Table */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle
                className="text-sm flex items-center gap-2"
                style={{ color: "var(--theme-primary, #6B1A2B)" }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="8" r="7" fill="#5dcaa5" />
                  <path
                    d="M5 8.5L7 10.5L11 6"
                    stroke="#fff"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                ITR E-Verified Clients ({tabClients.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="border-b"
                      style={{
                        background: "var(--theme-table-header-bg, #6B1414)",
                      }}
                    >
                      {[
                        "Client Name",
                        "PAN",
                        "Filed On",
                        "E-verified On",
                        "Verification Mode",
                        "Status",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left py-2 px-2 font-semibold text-xs"
                          style={{ color: "#fff" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tabClients.map((client) => {
                      const work = getClientWork(client.id);
                      return (
                        <tr
                          key={client.id}
                          className="border-b last:border-0 hover:bg-gray-50"
                          data-ocid="dashboard.everified.row"
                        >
                          <td className="py-1.5 px-2 font-medium text-xs">
                            {client.name}
                          </td>
                          <td className="py-1.5 px-2 text-gray-500 text-xs font-mono">
                            {client.pan}
                          </td>
                          <td className="py-1.5 px-2 text-xs">
                            {work?.filingDate || "\u2014"}
                          </td>
                          <td className="py-1.5 px-2 text-xs">
                            {work?.filingDate || "\u2014"}
                          </td>
                          <td className="py-1.5 px-2 text-xs text-gray-500">
                            \u2014
                          </td>
                          <td className="py-1.5 px-2">
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                background: "#d1fae5",
                                color: "#065f46",
                              }}
                            >
                              E-verified
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {tabClients.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-6 text-center text-gray-400"
                          data-ocid="dashboard.everified.empty_state"
                        >
                          No e-verified returns yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Tabs 1–5: Standard clients table */
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle
              className="text-sm"
              style={{ color: "var(--theme-primary, #6B1A2B)" }}
            >
              {activeTab === "total"
                ? "Recent Clients (last 10)"
                : `${TAB_DEFS.find((t) => t.key === activeTab)?.label ?? ""} — ${tabClients.length} client${tabClients.length !== 1 ? "s" : ""}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {[
                      "Name",
                      "PAN",
                      "Client Type",
                      "Tax Year",
                      "ITR Form",
                      "Return Type",
                      "Inward Docs",
                      "Work Status",
                      "Filing Status",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left py-1.5 px-2 font-semibold text-gray-600 text-xs"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === "total"
                    ? stats.recentClients
                    : tabClients
                  ).map((client) => {
                    const work = getClientWork(client.id);
                    const docStatus = getLatestDocStatus(client.id);
                    const docHasEntry = docStatus !== "-";
                    const filingStatus =
                      work?.filingStatus ??
                      (work?.eVerified ? "E-Verified" : "Pending");
                    const filingStatusColor =
                      filingStatus === "E-Verified"
                        ? "bg-green-100 text-green-700"
                        : filingStatus === "Pending for E-verification"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-orange-100 text-orange-700";
                    // Normalize legacy "Filed" status to "Completed" for display
                    const workStatusDisplay =
                      work?.status === "Filed"
                        ? "Completed"
                        : work?.status || "Pending";
                    const workStatusOptions = WORK_STATUS_OPTIONS;
                    return (
                      <tr
                        key={client.id}
                        className="border-b last:border-0 hover:bg-gray-50"
                        data-ocid="dashboard.client.row"
                      >
                        <td className="py-1.5 px-2 font-medium text-xs">
                          {client.name}
                        </td>
                        <td className="py-1.5 px-2 text-gray-500 text-xs font-mono">
                          {client.pan}
                        </td>
                        <td className="py-1.5 px-2">
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{
                              background:
                                "var(--theme-primary-light, rgba(107,26,43,0.09))",
                              color: "var(--theme-primary, #6B1A2B)",
                            }}
                          >
                            {getPanCategory(client.pan)}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-xs">
                          {client.taxYear}
                        </td>
                        <td className="py-1.5 px-2">
                          {work?.itrForm ? (
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono">
                              <FileText className="w-3 h-3 inline mr-0.5" />
                              {work.itrForm}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">
                              \u2014
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2">
                          {work?.returnType ? (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              {work.returnType}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">
                              \u2014
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2">
                          {docHasEntry ? (
                            <InlineStatusCell
                              value={docStatus}
                              options={DOC_STATUS_OPTIONS}
                              onSave={(newVal) =>
                                handleDocStatusSave(client, newVal)
                              }
                            />
                          ) : (
                            <span className="text-xs text-gray-400 italic">
                              No docs
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2">
                          <InlineStatusCell
                            value={workStatusDisplay}
                            options={workStatusOptions}
                            onSave={(newVal) =>
                              handleWorkStatusSave(client, newVal)
                            }
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${filingStatusColor}`}
                          >
                            {filingStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {(activeTab === "total" ? stats.recentClients : tabClients)
                    .length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-6 text-center text-gray-400"
                        data-ocid="dashboard.empty_state"
                      >
                        No clients found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
