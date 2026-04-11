import { d as createLucideIcon, r as reactExports, g as getDeadlineAlertClients, e as getEVerificationAlerts, s as storage, o as onStorageChange, j as jsxRuntimeExports, R as RefreshCw, U as Users, C as CircleCheckBig, S as ShieldCheck, f as ShieldAlert, B as Button, h as getClientWork, i as getLatestDocStatus, k as getPanCategory, a as refreshFromCanister, u as ue, l as getLatestDoc, q as queueDueDateNotifications } from "./index-Ds9srQjX.js";
import { M as MessageSquare, C as Card, a as CardHeader, b as CardTitle, c as CardContent } from "./card-WjwgtR0m.js";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-g1N4ES4G.js";
import { T as TriangleAlert, I as InlineStatusCell } from "./InlineStatusCell-CjV47FHQ.js";
import { g as getTaxYears } from "./taxYears-JUInSDi_.js";
import "./index-iEi2S07_.js";
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$2 = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["polyline", { points: "12 6 12 12 16 14", key: "68esgv" }]
];
const Clock = createLucideIcon("clock", __iconNode$2);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$1 = [
  ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
  ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
  ["path", { d: "M10 9H8", key: "b1mrlr" }],
  ["path", { d: "M16 13H8", key: "t4e002" }],
  ["path", { d: "M16 17H8", key: "z1uh3a" }]
];
const FileText = createLucideIcon("file-text", __iconNode$1);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
  ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
  ["path", { d: "m14.5 12.5-5 5", key: "b62r18" }],
  ["path", { d: "m9.5 12.5 5 5", key: "1rk7el" }]
];
const FileX = createLucideIcon("file-x", __iconNode);
const TAX_YEARS = ["All", ...getTaxYears()];
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
const TAB_DEFS = [
  {
    key: "total",
    label: "Total Clients",
    bgColor: "#d3d1c7",
    textColor: "#2C2C2A",
    tooltip: "All registered clients in your firm",
    icon: Users
  },
  {
    key: "pending",
    label: "Pending Work",
    bgColor: "#fac775",
    textColor: "#2C2C2A",
    tooltip: "Tasks due or in progress across all clients",
    icon: Clock
  },
  {
    key: "pendingITR",
    label: "ITR Pending for Filing",
    bgColor: "#f5c4b3",
    textColor: "#2C2C2A",
    tooltip: "Returns prepared but not yet submitted to the portal",
    icon: FileX
  },
  {
    key: "itrFiled",
    label: "ITR Filed",
    bgColor: "#c0dd97",
    textColor: "#2C2C2A",
    tooltip: "Returns successfully submitted and acknowledged",
    icon: CircleCheckBig
  },
  {
    key: "pendingVerif",
    label: "Pending for Verification",
    bgColor: "#b5d4f4",
    textColor: "#2C2C2A",
    tooltip: "Filed returns awaiting e-verification from client",
    icon: ShieldCheck
  },
  {
    key: "eVerified",
    label: "ITR E-Verified",
    bgColor: "#5dcaa5",
    textColor: "#F1EFE8",
    tooltip: "Returns fully e-verified — process complete",
    icon: CircleCheckBig,
    isNew: true
  }
];
function computeStats(taxYear, userId, userRole) {
  let allClients = storage.getClients();
  if (userRole === "Staff") {
    allClients = allClients.filter((c) => c.createdBy === userId);
  }
  const clients = taxYear === "All" ? allClients : allClients.filter((c) => c.taxYear === taxYear);
  const allWork = storage.getWork();
  const allBilling = storage.getBilling();
  const clientIds = new Set(clients.map((c) => c.id));
  const work = allWork.filter((w) => clientIds.has(w.clientId));
  const billing = allBilling.filter((b) => clientIds.has(b.clientId));
  const recentClients = allClients.slice(-10).reverse();
  const pending = work.filter(
    (w) => w.status === "Pending" || w.status === "In Progress"
  ).length;
  const pendingITR = work.filter(
    (w) => !w.filingStatus || w.filingStatus === "Pending"
  ).length;
  const itrFiled = work.filter(
    (w) => w.filingStatus === "E-Verified" || w.filingStatus === "Pending for E-verification"
  ).length;
  const pendingForVerification = work.filter(
    (w) => w.filingStatus === "Pending for E-verification"
  ).length;
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
    clients
  };
}
function DashboardPage({ user }) {
  var _a, _b;
  const [taxYear, setTaxYear] = reactExports.useState("All");
  const [stats, setStats] = reactExports.useState(
    () => computeStats("All", user.id, user.role)
  );
  const [alertClients, setAlertClients] = reactExports.useState(
    () => getDeadlineAlertClients(user.id, user.role)
  );
  const [eVerifAlerts, setEVerifAlerts] = reactExports.useState(
    () => getEVerificationAlerts()
  );
  const [isRefreshing, setIsRefreshing] = reactExports.useState(false);
  const [cardsLoading, setCardsLoading] = reactExports.useState(
    storage.getClients().length === 0 && storage.getWork().length === 0
  );
  const [activeTab, setActiveTab] = reactExports.useState("total");
  const [hoveredTab, setHoveredTab] = reactExports.useState(null);
  const refresh = reactExports.useCallback(
    (year) => {
      setStats(computeStats(year, user.id, user.role));
      setAlertClients(getDeadlineAlertClients(user.id, user.role));
      setEVerifAlerts(getEVerificationAlerts());
    },
    [user.id, user.role]
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
  reactExports.useEffect(() => {
    refresh(taxYear);
  }, [taxYear, refresh]);
  reactExports.useEffect(() => {
    const unsub = onStorageChange(() => {
      setCardsLoading(false);
      refresh(taxYear);
    });
    if (storage.getClients().length > 0 || storage.getWork().length > 0) {
      setCardsLoading(false);
    }
    return unsub;
  }, [taxYear, refresh]);
  const handleWorkStatusSave = (client, newVal) => {
    const work = getClientWork(client.id);
    if (!work) return;
    const oldVal = work.status;
    if (oldVal === newVal) return;
    const allWork2 = storage.getWork();
    storage.saveWork(
      allWork2.map(
        (w) => w.id === work.id ? {
          ...w,
          status: newVal,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        } : w
      )
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
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    ue.success("Status updated", {
      description: `${client.name} → ${newVal}`
    });
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
      userId: user.id,
      userName: user.name,
      userRole: user.role,
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
  };
  const handleQueueWhatsAppAlerts = () => {
    var _a2;
    const queued = queueDueDateNotifications();
    const whatsappSettings = storage.getWhatsAppSettings();
    const hasApiKey = (((_a2 = whatsappSettings == null ? void 0 : whatsappSettings.apiKey) == null ? void 0 : _a2.trim().length) ?? 0) > 0;
    if (queued === 0) {
      ue.info("No new alerts to queue", {
        description: "All due date alerts are already queued."
      });
      return;
    }
    if (!hasApiKey) {
      ue.success(`${queued} alert${queued > 1 ? "s" : ""} queued`, {
        description: "Queued — add API key in Settings to send."
      });
    } else {
      ue.success(
        `${queued} alert${queued > 1 ? "s" : ""} queued for WhatsApp`,
        {
          description: "Notifications are ready to send once triggered."
        }
      );
    }
  };
  const tabCounts = {
    total: stats.total,
    pending: stats.pending,
    pendingITR: stats.pendingITR,
    itrFiled: stats.itrFiled,
    pendingVerif: stats.pendingForVerification,
    eVerified: stats.eVerified
  };
  const allWork = storage.getWork();
  const getTabClients = () => {
    const clientIds = new Set(stats.clients.map((c) => c.id));
    const filteredWork = allWork.filter((w) => clientIds.has(w.clientId));
    if (activeTab === "total") return stats.clients;
    if (activeTab === "pending")
      return stats.clients.filter((c) => {
        const w = filteredWork.find((fw) => fw.clientId === c.id);
        return (w == null ? void 0 : w.status) === "Pending" || (w == null ? void 0 : w.status) === "In Progress";
      });
    if (activeTab === "pendingITR")
      return stats.clients.filter((c) => {
        const w = filteredWork.find((fw) => fw.clientId === c.id);
        return !(w == null ? void 0 : w.filingStatus) || (w == null ? void 0 : w.filingStatus) === "Pending";
      });
    if (activeTab === "itrFiled")
      return stats.clients.filter((c) => {
        const w = filteredWork.find((fw) => fw.clientId === c.id);
        return (w == null ? void 0 : w.filingStatus) === "E-Verified" || (w == null ? void 0 : w.filingStatus) === "Pending for E-verification";
      });
    if (activeTab === "pendingVerif")
      return stats.clients.filter((c) => {
        const w = filteredWork.find((fw) => fw.clientId === c.id);
        return (w == null ? void 0 : w.filingStatus) === "Pending for E-verification";
      });
    if (activeTab === "eVerified")
      return stats.clients.filter((c) => {
        const w = filteredWork.find((fw) => fw.clientId === c.id);
        return (w == null ? void 0 : w.filingStatus) === "E-Verified";
      });
    return stats.clients;
  };
  const tabClients = getTabClients();
  const whatsappEnabled = ((_a = storage.getWhatsAppSettings()) == null ? void 0 : _a.dueDateAlertEnabled) ?? false;
  const highEVerifAlerts = eVerifAlerts.filter((a) => a.urgency === "high");
  const normalEVerifAlerts = eVerifAlerts.filter((a) => a.urgency === "normal");
  const urgencyBadgeClass = (urgency) => {
    if (urgency === "red") return "bg-red-600 text-white";
    if (urgency === "yellow") return "bg-yellow-500 text-white";
    return "bg-amber-500 text-white";
  };
  const greeting = user.role === "Staff" ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "rounded-lg p-2.5 border",
      style: {
        background: "var(--theme-primary-light, rgba(107,26,43,0.05))",
        borderColor: "rgba(107,26,43,0.15)"
      },
      "data-ocid": "dashboard.greeting.panel",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "p",
          {
            className: "text-sm font-semibold",
            style: { color: "var(--theme-primary, #6B1A2B)" },
            children: [
              "Welcome, ",
              user.name
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "You are viewing your assigned clients." })
      ]
    }
  ) : /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "rounded-lg p-2.5 border flex items-center justify-between",
      style: {
        background: "rgba(201,164,76,0.08)",
        borderColor: "rgba(201,164,76,0.3)"
      },
      "data-ocid": "dashboard.greeting.panel",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "p",
            {
              className: "text-sm font-semibold",
              style: {
                color: "var(--theme-primary, #6B1A2B)",
                fontFamily: "'Playfair Display', Georgia, serif"
              },
              children: [
                "Welcome back, ",
                user.name
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-gray-500 mt-0.5", children: [
            (/* @__PURE__ */ new Date()).toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric"
            }),
            user.accessType ? ` · ${user.accessType} Plan` : ""
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hidden sm:flex items-center gap-4 text-xs", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-center", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-bold text-lg", style: { color: "#2563EB" }, children: stats.total }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-gray-500", children: "Clients" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-px h-8 bg-gray-200" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-center", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-bold text-lg", style: { color: "#D97706" }, children: stats.pending }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-gray-500", children: "Pending" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-px h-8 bg-gray-200" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-center", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-bold text-lg", style: { color: "#16A34A" }, children: stats.itrFiled }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-gray-500", children: "Completed" })
          ] })
        ] })
      ]
    }
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", children: [
    greeting,
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "h2",
        {
          className: "text-base font-semibold",
          style: { color: "var(--theme-primary, #6B1A2B)" },
          children: "Overview"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Select, { value: taxYear, onValueChange: setTaxYear, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: "w-36", "data-ocid": "dashboard.filter.select", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {}) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: TAX_YEARS.map((y) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: y, children: y }, y)) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          type: "button",
          onClick: handleRefresh,
          disabled: isRefreshing,
          className: "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition",
          title: "Refresh from server",
          "data-ocid": "dashboard.refresh.button",
          children: [
            isRefreshing ? /* @__PURE__ */ jsxRuntimeExports.jsx(
              "span",
              {
                className: "w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin",
                style: {
                  borderColor: "var(--theme-primary, #6B1A2B)",
                  borderTopColor: "transparent"
                }
              }
            ) : /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "w-3.5 h-3.5 text-gray-500" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-gray-600", children: isRefreshing ? "Refreshing…" : "Refresh" })
          ]
        }
      )
    ] }),
    cardsLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "flex gap-2",
        style: { overflowX: "auto" },
        "data-ocid": "dashboard.loading_state",
        children: [1, 2, 3, 4, 5, 6].map((i) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "rounded-lg border bg-white p-3 shadow-sm animate-pulse",
            style: { flex: "1", minWidth: 0 },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-3 bg-gray-200 rounded w-3/4 mb-2" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-6 bg-gray-200 rounded w-1/3" })
            ]
          },
          i
        ))
      }
    ) : (
      /* Tab Strip outer wrapper: overflowX:auto for scrolling, overflowY:visible so tooltip shows */
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: "no-scrollbar",
          style: {
            overflowX: "auto",
            overflowY: "visible",
            paddingBottom: "36px",
            marginBottom: "-36px"
          },
          children: /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              style: {
                display: "flex",
                flexWrap: "nowrap",
                gap: "8px",
                minWidth: "max-content",
                width: "100%"
              },
              "data-ocid": "dashboard.tabs.strip",
              children: TAB_DEFS.map((tab) => {
                const isActive = activeTab === tab.key;
                const count = tabCounts[tab.key];
                return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "div",
                  {
                    style: { flex: "1", minWidth: "100px", position: "relative" },
                    onMouseEnter: () => setHoveredTab(tab.key),
                    onMouseLeave: () => setHoveredTab(null),
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs(
                        "button",
                        {
                          type: "button",
                          onClick: () => setActiveTab(tab.key),
                          "data-ocid": `dashboard.tab.${tab.key}`,
                          style: {
                            width: "100%",
                            backgroundColor: tab.bgColor,
                            color: tab.textColor,
                            border: isActive ? `2px solid ${tab.textColor === "#2C2C2A" ? "rgba(44,44,42,0.5)" : "rgba(241,239,232,0.5)"}` : "2px solid transparent",
                            borderRadius: "10px",
                            padding: "8px 6px",
                            cursor: "pointer",
                            boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.18)" : "0 1px 3px rgba(0,0,0,0.08)",
                            transition: "box-shadow 0.15s, border 0.15s",
                            textAlign: "center",
                            outline: "none",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center"
                          },
                          children: [
                            /* @__PURE__ */ jsxRuntimeExports.jsxs(
                              "div",
                              {
                                style: {
                                  display: "flex",
                                  alignItems: "flex-start",
                                  justifyContent: "center",
                                  gap: "3px",
                                  marginBottom: "4px",
                                  width: "100%"
                                },
                                children: [
                                  tab.key === "eVerified" && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                                    "svg",
                                    {
                                      width: "14",
                                      height: "14",
                                      viewBox: "0 0 16 16",
                                      fill: "none",
                                      style: { flexShrink: 0, marginTop: "1px" },
                                      "aria-hidden": "true",
                                      children: [
                                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                                          "circle",
                                          {
                                            cx: "8",
                                            cy: "8",
                                            r: "7",
                                            fill: "rgba(241,239,232,0.25)"
                                          }
                                        ),
                                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                                          "path",
                                          {
                                            d: "M5 8.5L7 10.5L11 6",
                                            stroke: "#F1EFE8",
                                            strokeWidth: "1.8",
                                            strokeLinecap: "round",
                                            strokeLinejoin: "round"
                                          }
                                        )
                                      ]
                                    }
                                  ),
                                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                                    "span",
                                    {
                                      style: {
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        color: tab.textColor,
                                        lineHeight: 1.2,
                                        whiteSpace: "normal",
                                        wordWrap: "break-word",
                                        textAlign: "center",
                                        minWidth: 0
                                      },
                                      children: tab.label
                                    }
                                  )
                                ]
                              }
                            ),
                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                              "span",
                              {
                                style: {
                                  fontSize: "22px",
                                  fontWeight: 700,
                                  color: tab.textColor,
                                  lineHeight: 1,
                                  display: "block"
                                },
                                children: count
                              }
                            )
                          ]
                        }
                      ),
                      hoveredTab === tab.key && /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "div",
                        {
                          style: {
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
                            pointerEvents: "none"
                          },
                          role: "tooltip",
                          children: tab.tooltip
                        }
                      )
                    ]
                  },
                  tab.key
                );
              })
            }
          )
        }
      )
    ),
    stats.pendingITR > stats.pending && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "border border-l-4 rounded-lg p-3 bg-amber-50 border-amber-300 border-l-amber-500",
        "data-ocid": "dashboard.consistency_alert.panel",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "w-4 h-4 text-amber-600 flex-shrink-0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold text-amber-700 text-sm", children: "⚠ Data Inconsistency Alert" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-amber-700 mt-1.5", children: [
            "Pending ITR Filed (",
            stats.pendingITR,
            ") cannot exceed Pending Work (",
            stats.pending,
            "). Please review Work Processing records to ensure data accuracy."
          ] })
        ]
      }
    ),
    highEVerifAlerts.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "border border-l-4 rounded-lg p-3 bg-red-50 border-red-200 border-l-red-600",
        "data-ocid": "dashboard.everif_high.panel",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(ShieldAlert, { className: "w-4 h-4 text-red-600 flex-shrink-0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold text-red-700 text-sm", children: "⚠ HIGH PRIORITY: E-Verification Deadline" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ml-auto text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-bold", children: [
              highEVerifAlerts.length,
              " urgent"
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-1", children: highEVerifAlerts.map(({ client, work, daysToDeadline }) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "flex items-center justify-between text-sm bg-white rounded px-3 py-1.5 border border-red-100",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold text-gray-800", children: client.name }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-gray-500 text-xs font-mono", children: client.pan }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-gray-600 text-xs", children: [
                  "Filed: ",
                  work.filingDate || "—"
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-bold text-xs px-2 py-0.5 rounded-full bg-red-600 text-white", children: daysToDeadline <= 0 ? "OVERDUE" : `${daysToDeadline}d to verify` })
              ]
            },
            work.id
          )) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-red-600 mt-1.5 font-medium", children: "E-verification must be completed within 30 days of filing date." })
        ]
      }
    ),
    normalEVerifAlerts.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "border border-l-4 rounded-lg p-3 bg-amber-50 border-amber-200 border-l-amber-500",
        "data-ocid": "dashboard.everif_normal.panel",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-1.5", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(ShieldAlert, { className: "w-4 h-4 text-amber-600 flex-shrink-0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-semibold text-amber-700 text-sm", children: [
              "E-Verification Deadline Alert (",
              normalEVerifAlerts.length,
              ")"
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-1", children: normalEVerifAlerts.map(({ client, work, daysToDeadline }) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "flex items-center justify-between text-sm bg-white rounded px-3 py-1.5 border border-amber-100",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-gray-800", children: client.name }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-gray-600 text-xs", children: [
                  "Filed: ",
                  work.filingDate || "—"
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-bold text-xs px-2 py-0.5 rounded-full bg-amber-500 text-white", children: [
                  daysToDeadline,
                  "d remaining"
                ] })
              ]
            },
            work.id
          )) })
        ]
      }
    ),
    alertClients.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: `border border-l-4 rounded-lg p-3 ${alertClients.some((a) => a.urgency === "red") ? "bg-red-50 border-red-200 border-l-red-500" : alertClients.some((a) => a.urgency === "yellow") ? "bg-yellow-50 border-yellow-200 border-l-yellow-500" : "bg-amber-50 border-amber-200 border-l-amber-500"}`,
        "data-ocid": "dashboard.alert.panel",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2 mb-1.5", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                TriangleAlert,
                {
                  className: `w-4 h-4 flex-shrink-0 ${alertClients.some((a) => a.urgency === "red") ? "text-red-500" : "text-amber-500"}`
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "span",
                {
                  className: `font-semibold text-sm ${alertClients.some((a) => a.urgency === "red") ? "text-red-700" : "text-amber-700"}`,
                  children: [
                    alertClients.length,
                    " client",
                    alertClients.length > 1 ? "s" : "",
                    " ",
                    "with due date within 10 days"
                  ]
                }
              )
            ] }),
            whatsappEnabled && /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Button,
              {
                size: "sm",
                onClick: handleQueueWhatsAppAlerts,
                className: "flex items-center gap-1.5 text-xs font-medium flex-shrink-0",
                style: {
                  background: "var(--theme-gold, #C9A44C)",
                  color: "#fff",
                  border: "none"
                },
                "data-ocid": "dashboard.queue_whatsapp.button",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(MessageSquare, { className: "w-3.5 h-3.5" }),
                  "Queue Alerts"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-1", children: alertClients.map(({ client, daysLeft, urgency }) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "flex items-center justify-between text-sm bg-white rounded px-3 py-1.5 border border-gray-100",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-gray-800", children: client.name }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-gray-500 text-xs font-mono", children: client.pan }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-gray-600 text-xs", children: client.dueDate }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "span",
                  {
                    className: `font-bold text-xs px-2 py-0.5 rounded-full ${urgencyBadgeClass(urgency)}`,
                    children: daysLeft < 0 ? `${Math.abs(daysLeft)}d OVERDUE` : daysLeft === 0 ? "TODAY" : `${daysLeft}d left`
                  }
                )
              ]
            },
            client.id
          )) })
        ]
      }
    ),
    activeTab === "eVerified" ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", "data-ocid": "dashboard.everified.section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-3 gap-2.5", children: [
        {
          label: "Total E-verified",
          value: tabClients.length,
          color: "#16A34A"
        },
        {
          label: "Verified via Aadhaar OTP",
          value: 0,
          color: "#0D9488"
        },
        {
          label: "Verified via other methods",
          value: 0,
          color: "#6366F1"
        }
      ].map((card) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "rounded-lg border bg-white shadow-sm p-3",
          style: { borderColor: "#d1fae5" },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-gray-500 font-medium mb-1", children: card.label }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "span",
              {
                className: "text-xl font-bold",
                style: { color: card.color },
                children: card.value
              }
            )
          ]
        },
        card.label
      )) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { className: "shadow-sm", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-2 pt-3 px-3", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
          CardTitle,
          {
            className: "text-sm flex items-center gap-2",
            style: { color: "var(--theme-primary, #6B1A2B)" },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "svg",
                {
                  width: "16",
                  height: "16",
                  viewBox: "0 0 16 16",
                  fill: "none",
                  "aria-hidden": "true",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: "8", cy: "8", r: "7", fill: "#5dcaa5" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "path",
                      {
                        d: "M5 8.5L7 10.5L11 6",
                        stroke: "#fff",
                        strokeWidth: "1.8",
                        strokeLinecap: "round",
                        strokeLinejoin: "round"
                      }
                    )
                  ]
                }
              ),
              "ITR E-Verified Clients (",
              tabClients.length,
              ")"
            ]
          }
        ) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "px-3 pb-3 pt-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full text-sm", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(
            "tr",
            {
              className: "border-b",
              style: {
                background: "var(--theme-table-header-bg, #6B1414)"
              },
              children: [
                "Client Name",
                "PAN",
                "Filed On",
                "E-verified On",
                "Verification Mode",
                "Status"
              ].map((h) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                "th",
                {
                  className: "text-left py-2 px-2 font-semibold text-xs",
                  style: { color: "#fff" },
                  children: h
                },
                h
              ))
            }
          ) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
            tabClients.map((client) => {
              const work = getClientWork(client.id);
              return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "tr",
                {
                  className: "border-b last:border-0 hover:bg-gray-50",
                  "data-ocid": "dashboard.everified.row",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-1.5 px-2 font-medium text-xs", children: client.name }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-1.5 px-2 text-gray-500 text-xs font-mono", children: client.pan }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-1.5 px-2 text-xs", children: (work == null ? void 0 : work.filingDate) || "—" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-1.5 px-2 text-xs", children: (work == null ? void 0 : work.filingDate) || "—" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-1.5 px-2 text-xs text-gray-500", children: "\\u2014" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-1.5 px-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "span",
                      {
                        className: "px-2 py-0.5 rounded-full text-xs font-medium",
                        style: {
                          background: "#d1fae5",
                          color: "#065f46"
                        },
                        children: "E-verified"
                      }
                    ) })
                  ]
                },
                client.id
              );
            }),
            tabClients.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(
              "td",
              {
                colSpan: 6,
                className: "py-6 text-center text-gray-400",
                "data-ocid": "dashboard.everified.empty_state",
                children: "No e-verified returns yet"
              }
            ) })
          ] })
        ] }) }) })
      ] })
    ] }) : (
      /* Tabs 1–5: Standard clients table */
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { className: "shadow-sm", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "pb-2 pt-3 px-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          CardTitle,
          {
            className: "text-sm",
            style: { color: "var(--theme-primary, #6B1A2B)" },
            children: activeTab === "total" ? "Recent Clients (last 10)" : `${((_b = TAB_DEFS.find((t) => t.key === activeTab)) == null ? void 0 : _b.label) ?? ""} — ${tabClients.length} client${tabClients.length !== 1 ? "s" : ""}`
          }
        ) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "px-3 pb-3 pt-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full text-sm", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { className: "border-b", children: [
            "Name",
            "PAN",
            "Client Type",
            "Tax Year",
            "ITR Form",
            "Return Type",
            "Inward Docs",
            "Work Status",
            "Filing Status"
          ].map((h) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "th",
            {
              className: "text-left py-1.5 px-2 font-semibold text-gray-600 text-xs",
              children: h
            },
            h
          )) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
            (activeTab === "total" ? stats.recentClients : tabClients).map((client) => {
              const work = getClientWork(client.id);
              const docStatus = getLatestDocStatus(client.id);
              const docHasEntry = docStatus !== "-";
              const filingStatus = (work == null ? void 0 : work.filingStatus) ?? ((work == null ? void 0 : work.eVerified) ? "E-Verified" : "Pending");
              const filingStatusColor = filingStatus === "E-Verified" ? "bg-green-100 text-green-700" : filingStatus === "Pending for E-verification" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700";
              const workStatusDisplay = (work == null ? void 0 : work.status) === "Filed" ? "Completed" : (work == null ? void 0 : work.status) || "Pending";
              const workStatusOptions = WORK_STATUS_OPTIONS;
              return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "tr",
                {
                  className: "border-b last:border-0 hover:bg-gray-50",
                  "data-ocid": "dashboard.client.row",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-1.5 px-2 font-medium text-xs", children: client.name }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-1.5 px-2 text-gray-500 text-xs font-mono", children: client.pan }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-1.5 px-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "span",
                      {
                        className: "text-xs px-1.5 py-0.5 rounded font-medium",
                        style: {
                          background: "var(--theme-primary-light, rgba(107,26,43,0.09))",
                          color: "var(--theme-primary, #6B1A2B)"
                        },
                        children: getPanCategory(client.pan)
                      }
                    ) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-1.5 px-2 text-xs", children: client.taxYear }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-1.5 px-2", children: (work == null ? void 0 : work.itrForm) ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(FileText, { className: "w-3 h-3 inline mr-0.5" }),
                      work.itrForm
                    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-gray-300", children: "\\u2014" }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-1.5 px-2", children: (work == null ? void 0 : work.returnType) ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600", children: work.returnType }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-gray-300", children: "\\u2014" }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-1.5 px-2", children: docHasEntry ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                      InlineStatusCell,
                      {
                        value: docStatus,
                        options: DOC_STATUS_OPTIONS,
                        onSave: (newVal) => handleDocStatusSave(client, newVal)
                      }
                    ) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-gray-400 italic", children: "No docs" }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-1.5 px-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                      InlineStatusCell,
                      {
                        value: workStatusDisplay,
                        options: workStatusOptions,
                        onSave: (newVal) => handleWorkStatusSave(client, newVal)
                      }
                    ) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-1.5 px-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "span",
                      {
                        className: `px-1.5 py-0.5 rounded-full text-xs font-medium ${filingStatusColor}`,
                        children: filingStatus
                      }
                    ) })
                  ]
                },
                client.id
              );
            }),
            (activeTab === "total" ? stats.recentClients : tabClients).length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(
              "td",
              {
                colSpan: 9,
                className: "py-6 text-center text-gray-400",
                "data-ocid": "dashboard.empty_state",
                children: "No clients found"
              }
            ) })
          ] })
        ] }) }) })
      ] })
    )
  ] });
}
export {
  DashboardPage as default
};
