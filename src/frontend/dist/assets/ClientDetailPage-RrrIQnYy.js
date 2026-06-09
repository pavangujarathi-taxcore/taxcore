import { f as createLucideIcon, r as reactExports, a2 as useControllableState, j as jsxRuntimeExports, V as Primitive, a3 as useId, O as composeEventHandlers, P as Presence, Q as createContextScope, a4 as cn, s as storage, a6 as parseDDMMYYYY, a7 as getHeadOfIncome, m as getPanCategory, L as Label, I as Input, B as Button } from "./index-D5ov2zgF.js";
import { u as useDirection, S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-BIhiYm88.js";
import { R as Root, I as Item, c as createRovingFocusGroupScope } from "./index-C_NlLzNf.js";
import { D as DatePickerInput } from "./DatePickerInput-IINpEjCQ.js";
import { A as ArrowLeft } from "./arrow-left-BNi8jwA9.js";
import { B as Building2 } from "./building-2-BVDnYHSv.js";
import { P as Plus } from "./plus-CzTznfEj.js";
import { T as Trash2 } from "./trash-2-B5b0TUJR.js";
import { L as Lock } from "./lock-BIR_3XVY.js";
import { S as Save } from "./save-DkIda71Z.js";
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  ["path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", key: "975kel" }],
  ["circle", { cx: "12", cy: "7", r: "4", key: "17ys0d" }]
];
const User = createLucideIcon("user", __iconNode);
var TABS_NAME = "Tabs";
var [createTabsContext] = createContextScope(TABS_NAME, [
  createRovingFocusGroupScope
]);
var useRovingFocusGroupScope = createRovingFocusGroupScope();
var [TabsProvider, useTabsContext] = createTabsContext(TABS_NAME);
var Tabs$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const {
      __scopeTabs,
      value: valueProp,
      onValueChange,
      defaultValue,
      orientation = "horizontal",
      dir,
      activationMode = "automatic",
      ...tabsProps
    } = props;
    const direction = useDirection(dir);
    const [value, setValue] = useControllableState({
      prop: valueProp,
      onChange: onValueChange,
      defaultProp: defaultValue ?? "",
      caller: TABS_NAME
    });
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      TabsProvider,
      {
        scope: __scopeTabs,
        baseId: useId(),
        value,
        onValueChange: setValue,
        orientation,
        dir: direction,
        activationMode,
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          Primitive.div,
          {
            dir: direction,
            "data-orientation": orientation,
            ...tabsProps,
            ref: forwardedRef
          }
        )
      }
    );
  }
);
Tabs$1.displayName = TABS_NAME;
var TAB_LIST_NAME = "TabsList";
var TabsList$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeTabs, loop = true, ...listProps } = props;
    const context = useTabsContext(TAB_LIST_NAME, __scopeTabs);
    const rovingFocusGroupScope = useRovingFocusGroupScope(__scopeTabs);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      Root,
      {
        asChild: true,
        ...rovingFocusGroupScope,
        orientation: context.orientation,
        dir: context.dir,
        loop,
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          Primitive.div,
          {
            role: "tablist",
            "aria-orientation": context.orientation,
            ...listProps,
            ref: forwardedRef
          }
        )
      }
    );
  }
);
TabsList$1.displayName = TAB_LIST_NAME;
var TRIGGER_NAME = "TabsTrigger";
var TabsTrigger$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeTabs, value, disabled = false, ...triggerProps } = props;
    const context = useTabsContext(TRIGGER_NAME, __scopeTabs);
    const rovingFocusGroupScope = useRovingFocusGroupScope(__scopeTabs);
    const triggerId = makeTriggerId(context.baseId, value);
    const contentId = makeContentId(context.baseId, value);
    const isSelected = value === context.value;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      Item,
      {
        asChild: true,
        ...rovingFocusGroupScope,
        focusable: !disabled,
        active: isSelected,
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          Primitive.button,
          {
            type: "button",
            role: "tab",
            "aria-selected": isSelected,
            "aria-controls": contentId,
            "data-state": isSelected ? "active" : "inactive",
            "data-disabled": disabled ? "" : void 0,
            disabled,
            id: triggerId,
            ...triggerProps,
            ref: forwardedRef,
            onMouseDown: composeEventHandlers(props.onMouseDown, (event) => {
              if (!disabled && event.button === 0 && event.ctrlKey === false) {
                context.onValueChange(value);
              } else {
                event.preventDefault();
              }
            }),
            onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
              if ([" ", "Enter"].includes(event.key)) context.onValueChange(value);
            }),
            onFocus: composeEventHandlers(props.onFocus, () => {
              const isAutomaticActivation = context.activationMode !== "manual";
              if (!isSelected && !disabled && isAutomaticActivation) {
                context.onValueChange(value);
              }
            })
          }
        )
      }
    );
  }
);
TabsTrigger$1.displayName = TRIGGER_NAME;
var CONTENT_NAME = "TabsContent";
var TabsContent$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeTabs, value, forceMount, children, ...contentProps } = props;
    const context = useTabsContext(CONTENT_NAME, __scopeTabs);
    const triggerId = makeTriggerId(context.baseId, value);
    const contentId = makeContentId(context.baseId, value);
    const isSelected = value === context.value;
    const isMountAnimationPreventedRef = reactExports.useRef(isSelected);
    reactExports.useEffect(() => {
      const rAF = requestAnimationFrame(() => isMountAnimationPreventedRef.current = false);
      return () => cancelAnimationFrame(rAF);
    }, []);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Presence, { present: forceMount || isSelected, children: ({ present }) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      Primitive.div,
      {
        "data-state": isSelected ? "active" : "inactive",
        "data-orientation": context.orientation,
        role: "tabpanel",
        "aria-labelledby": triggerId,
        hidden: !present,
        id: contentId,
        tabIndex: 0,
        ...contentProps,
        ref: forwardedRef,
        style: {
          ...props.style,
          animationDuration: isMountAnimationPreventedRef.current ? "0s" : void 0
        },
        children: present && children
      }
    ) });
  }
);
TabsContent$1.displayName = CONTENT_NAME;
function makeTriggerId(baseId, value) {
  return `${baseId}-trigger-${value}`;
}
function makeContentId(baseId, value) {
  return `${baseId}-content-${value}`;
}
var Root2 = Tabs$1;
var List = TabsList$1;
var Trigger = TabsTrigger$1;
var Content = TabsContent$1;
function Tabs({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Root2,
    {
      "data-slot": "tabs",
      className: cn("flex flex-col gap-2", className),
      ...props
    }
  );
}
function TabsList({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    List,
    {
      "data-slot": "tabs-list",
      className: cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
        className
      ),
      ...props
    }
  );
}
function TabsTrigger({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Trigger,
    {
      "data-slot": "tabs-trigger",
      className: cn(
        "data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      ),
      ...props
    }
  );
}
function TabsContent({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Content,
    {
      "data-slot": "tabs-content",
      className: cn("flex-1 outline-none", className),
      ...props
    }
  );
}
const PAN_TYPE_INFO = {
  Individual: {
    label: "Individual",
    description: "Natural person filing personal income tax returns.",
    icon: "person"
  },
  Company: {
    label: "Company",
    description: "Incorporated company registered under Companies Act.",
    icon: "building"
  },
  Firm: {
    label: "Firm",
    description: "Partnership firm, LLP, or proprietary firm.",
    icon: "building"
  },
  HUF: {
    label: "HUF",
    description: "Hindu Undivided Family — a unique Indian tax entity.",
    icon: "person"
  },
  AOP: {
    label: "AOP",
    description: "Association of Persons — a group filing jointly.",
    icon: "building"
  },
  BOI: {
    label: "BOI",
    description: "Body of Individuals — similar to AOP but for individuals.",
    icon: "person"
  },
  Government: {
    label: "Government",
    description: "Central or state government entity.",
    icon: "building"
  },
  AJP: {
    label: "AJP",
    description: "Artificial Juridical Person — entities recognized by law.",
    icon: "building"
  },
  "Local Authority": {
    label: "Local Authority",
    description: "Municipal corporation, panchayat, or other local body.",
    icon: "building"
  },
  Trust: {
    label: "Trust",
    description: "Charitable, religious, or other trust entity.",
    icon: "building"
  },
  Other: {
    label: "Other",
    description: "Unknown or unrecognized PAN format.",
    icon: "person"
  }
};
const PAN_POSITIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
function PanCharDisplay({ pan }) {
  const upper = pan.toUpperCase();
  return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-mono text-sm tracking-widest text-gray-700 flex gap-0.5 flex-wrap", children: PAN_POSITIONS.map((pos) => {
    const ch = upper.length > pos ? upper[pos] : " ";
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      "span",
      {
        className: "inline-block w-6 text-center rounded",
        style: pos === 3 ? {
          background: "var(--theme-gold, #C9A44C)",
          color: "#fff",
          fontWeight: 700
        } : {
          background: "#f3f4f6"
        },
        children: ch
      },
      pos
    );
  }) });
}
function ClientTypePanel({ pan }) {
  const panChar = pan && pan.length >= 4 ? pan[3].toUpperCase() : "";
  const clientType = pan && pan.length >= 4 ? getPanCategory(pan) : "";
  const info = clientType ? PAN_TYPE_INFO[clientType] ?? PAN_TYPE_INFO.Other : null;
  const isPerson = (info == null ? void 0 : info.icon) === "person";
  if (!pan || pan.length < 4) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bg-white rounded-lg border p-6 max-w-lg", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center justify-center gap-3 text-center py-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: "w-14 h-14 rounded-full flex items-center justify-center",
          style: {
            background: "var(--theme-primary-light, rgba(107,26,43,0.08))"
          },
          children: /* @__PURE__ */ jsxRuntimeExports.jsx(
            User,
            {
              className: "w-7 h-7",
              style: { color: "var(--theme-primary, #6B1A2B)" }
            }
          )
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-semibold text-gray-700", children: "PAN not entered" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-gray-400", children: "Client Type cannot be determined until a valid PAN number is saved." })
    ] }) });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "max-w-lg space-y-3", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "rounded-xl border p-5",
        style: {
          background: "var(--theme-primary-light, rgba(107,26,43,0.05))",
          borderColor: "var(--theme-primary-light, rgba(107,26,43,0.2))"
        },
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "p",
            {
              className: "text-xs font-semibold uppercase tracking-widest mb-3",
              style: { color: "var(--theme-primary, #6B1A2B)", opacity: 0.7 },
              children: "Income Tax Client Type"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-4", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "div",
              {
                className: "w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0",
                style: { background: "var(--theme-primary, #6B1A2B)" },
                children: isPerson ? /* @__PURE__ */ jsxRuntimeExports.jsx(User, { className: "w-8 h-8 text-white" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Building2, { className: "w-8 h-8 text-white" })
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "h3",
                {
                  className: "text-2xl font-bold leading-tight",
                  style: { color: "var(--theme-primary, #6B1A2B)" },
                  children: (info == null ? void 0 : info.label) ?? clientType
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-gray-600 mt-1 leading-snug", children: info == null ? void 0 : info.description })
            ] })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-lg border bg-white p-4 flex items-center gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-mono font-bold text-lg",
          style: {
            background: "var(--theme-gold, #C9A44C)",
            color: "#fff"
          },
          children: panChar
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-gray-500", children: "Based on PAN 4th character" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm font-semibold text-gray-800", children: [
          "Character ",
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-mono", children: [
            '"',
            panChar,
            '"'
          ] }),
          " →",
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "var(--theme-primary, #6B1A2B)" }, children: (info == null ? void 0 : info.label) ?? clientType })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-lg border bg-white p-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-gray-400 mb-2 font-medium", children: "PAN Number" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(PanCharDisplay, { pan }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-gray-400 mt-1.5", children: "4th character highlighted" })
    ] })
  ] });
}
function ClientDetailPage({
  client,
  onBack,
  onUpdateClient
}) {
  var _a, _b, _c;
  const currentUser = storage.getCurrentUser();
  const [docForm, setDocForm] = reactExports.useState({
    date: "",
    mode: "Email",
    status: "Complete",
    remarks: ""
  });
  const [docError, setDocError] = reactExports.useState("");
  const [refreshKey, setRefreshKey] = reactExports.useState(0);
  const [workForm, setWorkForm] = reactExports.useState({
    filingStatus: "Pending",
    returnType: "Original",
    remark: ""
  });
  const [filingDateLocked, setFilingDateLocked] = reactExports.useState(false);
  const [workError, setWorkError] = reactExports.useState("");
  const [ackError, setAckError] = reactExports.useState("");
  const [workSaved, setWorkSaved] = reactExports.useState(false);
  const [dueDate, setDueDate] = reactExports.useState(client.dueDate || "");
  const workInitialized = reactExports.useRef(false);
  const docs = reactExports.useMemo(() => {
    return storage.getDocuments().filter((d) => d.clientId === client.id).sort((a, b) => {
      var _a2, _b2;
      const da = ((_a2 = parseDDMMYYYY(a.date)) == null ? void 0 : _a2.getTime()) || 0;
      const db = ((_b2 = parseDDMMYYYY(b.date)) == null ? void 0 : _b2.getTime()) || 0;
      return db - da;
    });
  }, [client.id, refreshKey]);
  const work = reactExports.useMemo(() => {
    return storage.getWork().find((w) => w.clientId === client.id) || null;
  }, [client.id, refreshKey]);
  reactExports.useEffect(() => {
    if (work && !workInitialized.current) {
      workInitialized.current = true;
      const hasValidAck = !!(work.ackNumber && /^\d{15}$/.test(work.ackNumber));
      let fs = work.filingStatus ?? (work.eVerified ? "E-Verified" : "Pending");
      if (!hasValidAck) {
        fs = "Pending";
      }
      const filingDate = hasValidAck ? work.filingDate || "" : "";
      setWorkForm({
        status: work.status,
        itrForm: work.itrForm,
        returnType: work.returnType || "Original",
        remark: work.remark || "",
        ackNumber: work.ackNumber,
        filingDate,
        filingStatus: fs
      });
      if (hasValidAck) {
        setFilingDateLocked(true);
      }
    }
  }, [work]);
  const validateDate = (d) => {
    if (!d) return false;
    const parts = d.split("-");
    if (parts.length !== 3) return false;
    const [dd, mm, yyyy] = parts;
    const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return !Number.isNaN(dt.getTime()) && dt.getFullYear() === Number(yyyy);
  };
  const isDateInFuture = (d) => {
    const dt = parseDDMMYYYY(d);
    if (!dt) return false;
    return dt > /* @__PURE__ */ new Date();
  };
  const deriveFilingDateFromAck = (digits) => {
    if (digits.length !== 15) return null;
    const last6 = digits.slice(9, 15);
    const dd = last6.slice(0, 2);
    const mm = last6.slice(2, 4);
    const yy = last6.slice(4, 6);
    const yyyy = `20${yy}`;
    const dayNum = Number(dd);
    const monthNum = Number(mm);
    const yearNum = Number(yyyy);
    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 2e3 || yearNum > 2099) {
      return null;
    }
    const dt = new Date(yearNum, monthNum - 1, dayNum);
    if (dt.getFullYear() !== yearNum || dt.getMonth() !== monthNum - 1 || dt.getDate() !== dayNum) {
      return null;
    }
    return `${dd}-${mm}-${yyyy}`;
  };
  const handleAckNumberChange = (raw) => {
    var _a2;
    const digits = raw.replace(/\D/g, "").slice(0, 15);
    setAckError("");
    if (digits.length === 15) {
      const derived = deriveFilingDateFromAck(digits);
      if (derived) {
        const tyParts = (_a2 = client.taxYear) == null ? void 0 : _a2.split("-");
        let isAfterYearEnd = true;
        let endYear = 0;
        if (tyParts && tyParts.length === 2) {
          endYear = Number(tyParts[1]);
          const taxYearEndDate = new Date(endYear, 2, 31);
          taxYearEndDate.setHours(0, 0, 0, 0);
          const fdParts = derived.split("-");
          if (fdParts.length === 3) {
            const filingDt = new Date(
              Number(fdParts[2]),
              Number(fdParts[1]) - 1,
              Number(fdParts[0])
            );
            filingDt.setHours(0, 0, 0, 0);
            if (filingDt <= taxYearEndDate) {
              isAfterYearEnd = false;
            }
          }
        }
        if (!isAfterYearEnd) {
          setAckError(
            `Filing Date ${derived} derived from Ack No must be after 31-03-${endYear} (Tax Year ${client.taxYear}). Please check the Acknowledgement Number.`
          );
          setWorkForm((f) => ({
            ...f,
            ackNumber: digits,
            filingDate: "",
            filingStatus: "Pending"
          }));
          setFilingDateLocked(false);
          return;
        }
        setWorkForm((f) => ({
          ...f,
          ackNumber: digits,
          filingDate: derived,
          filingStatus: f.filingStatus === "E-Verified" ? "E-Verified" : "Pending for E-verification"
        }));
        setFilingDateLocked(true);
        return;
      }
    }
    setWorkForm((f) => ({
      ...f,
      ackNumber: digits,
      filingDate: "",
      filingStatus: "Pending"
    }));
    setFilingDateLocked(false);
  };
  const handleAddDoc = () => {
    setDocError("");
    if (!docForm.date) return setDocError("Date is required.");
    if (!validateDate(docForm.date))
      return setDocError("Date must be DD-MM-YYYY format.");
    if (isDateInFuture(docForm.date))
      return setDocError("Date cannot be in the future.");
    const newDoc = {
      id: storage.uid(),
      clientId: client.id,
      date: docForm.date,
      mode: docForm.mode,
      status: docForm.status,
      remarks: docForm.remarks,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    storage.saveDocuments([...storage.getDocuments(), newDoc]);
    setDocForm({ date: "", mode: "Email", status: "Complete", remarks: "" });
    setRefreshKey((k) => k + 1);
  };
  const handleDeleteDoc = (id) => {
    storage.saveDocuments(storage.getDocuments().filter((d) => d.id !== id));
    setRefreshKey((k) => k + 1);
  };
  const handleSaveWork = () => {
    var _a2;
    setWorkError("");
    setAckError("");
    if (workForm.ackNumber && !/^\d{15}$/.test(workForm.ackNumber))
      return setWorkError(
        "Acknowledgement Number must be exactly 15 numeric digits."
      );
    const hasValidAck = !!(workForm.ackNumber && /^\d{15}$/.test(workForm.ackNumber));
    if (!hasValidAck && workForm.filingStatus && workForm.filingStatus !== "Pending") {
      return setWorkError(
        'Filing Status can only be "Pending for E-verification" or "E-Verified" when a valid 15-digit Acknowledgement Number is entered.'
      );
    }
    if (dueDate) {
      if (!validateDate(dueDate))
        return setWorkError("Due Date must be in DD-MM-YYYY format.");
      if (client.taxYear) {
        const tyParts = client.taxYear.split("-");
        if (tyParts.length === 2) {
          const endYear = Number(tyParts[1]);
          const taxYearEnd = new Date(endYear, 2, 31);
          taxYearEnd.setHours(0, 0, 0, 0);
          const dueParts = dueDate.split("-");
          if (dueParts.length === 3) {
            const dueDt = new Date(
              Number(dueParts[2]),
              Number(dueParts[1]) - 1,
              Number(dueParts[0])
            );
            dueDt.setHours(0, 0, 0, 0);
            if (dueDt <= taxYearEnd)
              return setWorkError(
                `Due Date must be after 31-03-${endYear} (end of Tax Year ${client.taxYear}).`
              );
          }
        }
      }
    }
    if (workForm.filingDate) {
      if (!validateDate(workForm.filingDate))
        return setWorkError("Filing Date must be DD-MM-YYYY format.");
      const tyParts = (_a2 = client.taxYear) == null ? void 0 : _a2.split("-");
      if (tyParts && tyParts.length === 2) {
        const endYear = Number(tyParts[1]);
        const taxYearEndDate = new Date(endYear, 2, 31);
        taxYearEndDate.setHours(0, 0, 0, 0);
        const fdParts = workForm.filingDate.split("-");
        if (fdParts.length === 3) {
          const filingDt = new Date(
            Number(fdParts[2]),
            Number(fdParts[1]) - 1,
            Number(fdParts[0])
          );
          filingDt.setHours(0, 0, 0, 0);
          if (filingDt <= taxYearEndDate) {
            return setWorkError(
              `Filing Date must be after 31-03-${endYear} (end of Tax Year ${client.taxYear}).`
            );
          }
        }
      }
    }
    const allWork = storage.getWork();
    const filingStatus = workForm.filingStatus || "Pending";
    const eVerified = filingStatus === "E-Verified";
    if (work) {
      const updated = {
        ...work,
        status: workForm.status || work.status,
        itrForm: workForm.itrForm || "",
        returnType: workForm.returnType || "Original",
        remark: workForm.remark || "",
        ackNumber: workForm.ackNumber || "",
        filingDate: workForm.filingDate || "",
        filingStatus,
        eVerified,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      storage.saveWork(allWork.map((w) => w.id === work.id ? updated : w));
    } else {
      const wp = {
        id: storage.uid(),
        clientId: client.id,
        taxYear: client.taxYear,
        status: workForm.status || "Pending",
        itrForm: workForm.itrForm || "",
        returnType: workForm.returnType || "Original",
        remark: workForm.remark || "",
        ackNumber: workForm.ackNumber || "",
        filingDate: workForm.filingDate || "",
        filingStatus,
        eVerified,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      storage.saveWork([...allWork, wp]);
    }
    if (dueDate !== client.dueDate) {
      const allClients = storage.getClients();
      const updatedClient = { ...client, dueDate };
      storage.saveClients(
        allClients.map((c) => c.id === client.id ? updatedClient : c)
      );
      if (onUpdateClient) onUpdateClient(updatedClient);
    }
    if (currentUser) {
      const oldWork = work;
      const newStatus = workForm.status || ((oldWork == null ? void 0 : oldWork.status) ?? "Pending");
      const newFilingStatus = workForm.filingStatus || "Pending";
      const newAck = workForm.ackNumber || "";
      const newItrForm = workForm.itrForm || "";
      const newReturnType = workForm.returnType || "Original";
      const newRemark = workForm.remark || "";
      const newFilingDate = workForm.filingDate || "";
      const ts = (/* @__PURE__ */ new Date()).toISOString();
      const logEntry = (field, oldVal, newVal) => {
        if (oldVal === newVal) return;
        storage.addAuditLog({
          id: storage.uid(),
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: `Updated ${field}`,
          clientId: client.id,
          clientName: client.name,
          fieldChanged: field,
          oldValue: oldVal,
          newValue: newVal,
          timestamp: ts
        });
      };
      if (oldWork) {
        const oldStatus = oldWork.status === "Filed" ? "Completed" : oldWork.status ?? "Pending";
        logEntry("Work Status", oldStatus, newStatus);
        logEntry(
          "Filing Status",
          oldWork.filingStatus ?? "Pending",
          newFilingStatus
        );
        logEntry("Ack Number", oldWork.ackNumber || "-", newAck || "-");
        logEntry(
          "Filing Date",
          oldWork.filingDate || "-",
          newFilingDate || "-"
        );
        logEntry("ITR Form", oldWork.itrForm || "-", newItrForm || "-");
        logEntry(
          "Return Type",
          oldWork.returnType || "Original",
          newReturnType
        );
        if ((oldWork.remark || "") !== newRemark)
          logEntry("Remark", oldWork.remark || "-", newRemark || "-");
        if (dueDate !== (client.dueDate || ""))
          logEntry("Due Date", client.dueDate || "-", dueDate || "-");
      } else {
        storage.addAuditLog({
          id: storage.uid(),
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: "Work Processing Created",
          clientId: client.id,
          clientName: client.name,
          fieldChanged: "Work Processing",
          oldValue: "-",
          newValue: `Status: ${newStatus}, Filing: ${newFilingStatus}`,
          timestamp: ts
        });
      }
    }
    setWorkSaved(true);
    setTimeout(() => setWorkSaved(false), 2e3);
    setRefreshKey((k) => k + 1);
  };
  const currentWork = work ? { ...work, ...workForm } : workForm;
  const headOfIncome = getHeadOfIncome(client);
  const ackComplete = !!currentWork.ackNumber && /^\d{15}$/.test(currentWork.ackNumber);
  const filingStatusColor = (status) => {
    if (status === "E-Verified") return "text-green-700";
    if (status === "Pending for E-verification") return "text-blue-700";
    return "text-orange-700";
  };
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          type: "button",
          onClick: onBack,
          className: "flex items-center gap-1 text-sm hover:underline",
          style: { color: "var(--theme-primary, #6B1A2B)" },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowLeft, { className: "w-4 h-4" }),
            " Back"
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-5 w-px bg-gray-300" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-semibold text-gray-800", children: client.name }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs bg-gray-100 px-2 py-0.5 rounded font-mono", children: client.pan }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded", children: client.taxYear }),
      client.pan && client.pan.length >= 4 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "span",
        {
          className: "text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1",
          style: {
            background: "var(--theme-primary-light, rgba(107,26,43,0.1))",
            color: "var(--theme-primary, #6B1A2B)",
            border: "1px solid var(--theme-primary-light, rgba(107,26,43,0.2))"
          },
          title: `Client Type derived from PAN 4th character "${client.pan[3].toUpperCase()}"`,
          children: [
            getPanCategory(client.pan) === "Individual" ? /* @__PURE__ */ jsxRuntimeExports.jsx(User, { className: "w-3 h-3" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Building2, { className: "w-3 h-3" }),
            getPanCategory(client.pan)
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bg-white rounded-lg border p-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-gray-500 text-xs", children: "Mobile" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-medium truncate", children: client.mobile })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-gray-500 text-xs", children: "Email" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-medium text-xs break-all leading-tight mt-0.5", children: client.email || "-" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-gray-500 text-xs", children: "Category" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-medium truncate", children: client.clientCategory })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-gray-500 text-xs", children: "Head of Income" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-medium truncate", children: headOfIncome })
      ] }),
      headOfIncome === "Business" && client.businessName && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-gray-500 text-xs", children: "Business Name" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-medium truncate", children: client.businessName })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-gray-500 text-xs", children: "Tax Year" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-medium", children: client.taxYear })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-gray-500 text-xs", children: "Due Date" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-medium", children: dueDate || client.dueDate })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(Tabs, { defaultValue: "documents", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        TabsList,
        {
          style: {
            background: "var(--theme-primary-light, rgba(107,26,43,0.1))"
          },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(TabsTrigger, { value: "documents", style: { fontWeight: 600 }, children: "Document Inward" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(TabsTrigger, { value: "work", style: { fontWeight: 600 }, children: "Work Processing" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(TabsTrigger, { value: "clienttype", style: { fontWeight: 600 }, children: "Client Type" })
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(TabsContent, { value: "documents", className: "mt-4 space-y-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bg-white rounded-lg border p-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "h3",
            {
              className: "font-semibold mb-3",
              style: { color: "var(--theme-primary, #6B1A2B)" },
              children: "Add Document Entry"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { className: "text-xs", children: "Date (no future) *" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                DatePickerInput,
                {
                  value: docForm.date,
                  onChange: (v) => setDocForm((f) => ({ ...f, date: v })),
                  placeholder: "DD-MM-YYYY",
                  maxDate: today,
                  className: "mt-1"
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { className: "text-xs", children: "Mode" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                Select,
                {
                  value: docForm.mode,
                  onValueChange: (v) => setDocForm((f) => ({
                    ...f,
                    mode: v
                  })),
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: "mt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {}) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "Email", children: "Email" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "WhatsApp", children: "WhatsApp" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "Hardcopy", children: "Hardcopy" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "Mix", children: "Mix" })
                    ] })
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { className: "text-xs", children: "Status" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                Select,
                {
                  value: docForm.status,
                  onValueChange: (v) => setDocForm((f) => ({
                    ...f,
                    status: v
                  })),
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: "mt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {}) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "Complete", children: "Complete" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "Partial", children: "Partial" })
                    ] })
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { className: "text-xs", children: "Remarks" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Input,
                {
                  value: docForm.remarks,
                  onChange: (e) => setDocForm((f) => ({ ...f, remarks: e.target.value })),
                  placeholder: "Optional notes",
                  className: "mt-1"
                }
              )
            ] })
          ] }),
          docError && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-red-600 text-xs mt-2", children: docError }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Button,
            {
              onClick: handleAddDoc,
              size: "sm",
              className: "mt-3 text-white",
              style: { background: "var(--theme-primary, #6B1A2B)" },
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Plus, { className: "w-3.5 h-3.5 mr-1" }),
                " Add Entry"
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bg-white rounded-lg border overflow-x-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full text-sm", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { style: { background: "var(--theme-primary, #6B1A2B)" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: ["Date", "Mode", "Status", "Remarks", "Action"].map((h) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "th",
            {
              className: "text-left py-2.5 px-4 text-white font-medium",
              children: h
            },
            h
          )) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
            docs.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("td", { colSpan: 5, className: "py-6 text-center text-gray-400", children: "No documents yet. Add the first entry above." }) }),
            docs.map((d) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "tr",
              {
                className: "border-b last:border-0 hover:bg-gray-50",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2.5 px-4 font-mono text-xs", children: d.date }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2.5 px-4", children: d.mode }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2.5 px-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "span",
                    {
                      className: `px-2 py-0.5 rounded-full text-xs font-medium ${d.status === "Complete" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`,
                      children: d.status
                    }
                  ) }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2.5 px-4 text-gray-500", children: d.remarks || "-" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2.5 px-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => handleDeleteDoc(d.id),
                      className: "p-1 rounded hover:bg-red-100 text-red-400",
                      children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "w-3.5 h-3.5" })
                    }
                  ) })
                ]
              },
              d.id
            ))
          ] })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(TabsContent, { value: "work", className: "mt-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bg-white rounded-lg border p-5 max-w-2xl space-y-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "h3",
          {
            className: "font-semibold",
            style: { color: "var(--theme-primary, #6B1A2B)" },
            children: "Work Processing"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Work Status" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Select,
            {
              value: currentWork.status || "Pending",
              onValueChange: (v) => setWorkForm((f) => ({
                ...f,
                status: v
              })),
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: "mt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {}) }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "Pending", children: "Pending" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "In Progress", children: "In Progress" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "Completed", children: "Completed" })
                ] })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "ITR Form" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Select,
              {
                value: currentWork.itrForm || "",
                onValueChange: (v) => setWorkForm((f) => ({ ...f, itrForm: v })),
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: "mt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "Select ITR Form" }) }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "ITR-1", children: "ITR-1" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "ITR-2", children: "ITR-2" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "ITR-3", children: "ITR-3" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "ITR-4", children: "ITR-4" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "ITR-5", children: "ITR-5" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "ITR-6", children: "ITR-6" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "ITR-7", children: "ITR-7" })
                  ] })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Return Type" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Select,
              {
                value: currentWork.returnType || "Original",
                onValueChange: (v) => setWorkForm((f) => ({
                  ...f,
                  returnType: v
                })),
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: "mt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {}) }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "Original", children: "Original" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "Revised", children: "Revised" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "Belated", children: "Belated" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "Updated", children: "Updated" })
                  ] })
                ]
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Label, { children: [
            "Remark ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-gray-400 text-xs", children: "(optional)" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Input,
            {
              value: currentWork.remark || "",
              onChange: (e) => setWorkForm((f) => ({ ...f, remark: e.target.value })),
              placeholder: "e.g. Revision reason, notes for future reference...",
              className: "mt-1"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Acknowledgement Number (15 digits)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: "mt-1",
              style: {
                border: "2px solid var(--theme-primary, #6B1A2B)",
                borderRadius: "8px",
                overflow: "hidden"
              },
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                Input,
                {
                  value: currentWork.ackNumber || "",
                  onChange: (e) => handleAckNumberChange(e.target.value),
                  placeholder: "15-digit acknowledgement number",
                  maxLength: 15,
                  inputMode: "numeric",
                  className: "font-mono border-0 focus-visible:ring-0 focus-visible:ring-offset-0",
                  style: { border: "none", outline: "none", boxShadow: "none" }
                }
              )
            }
          ),
          (((_a = currentWork.ackNumber) == null ? void 0 : _a.length) || 0) > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs mt-1 text-gray-400", children: [
            ((_b = currentWork.ackNumber) == null ? void 0 : _b.length) || 0,
            "/15 digits",
            (((_c = currentWork.ackNumber) == null ? void 0 : _c.length) || 0) === 15 && filingDateLocked && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-2 text-green-600", children: "✓ Filing date auto-filled" })
          ] }),
          ackError && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-red-600 text-xs mt-1 bg-red-50 rounded p-1.5", children: [
            "⚠ ",
            ackError
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Filing Date" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "mt-1 flex items-center gap-2 px-3 bg-gray-50 text-sm text-gray-700",
              style: {
                height: "36px",
                border: "1px solid #d1d5db",
                borderRadius: "6px"
              },
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Lock, { className: "w-3.5 h-3.5 text-gray-400 shrink-0" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono", children: currentWork.filingDate || "—" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Due Date * (DD-MM-YYYY)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            DatePickerInput,
            {
              value: dueDate,
              onChange: (v) => setDueDate(v),
              placeholder: "DD-MM-YYYY"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-gray-400 mt-0.5", children: "Editable here and in Client Master — both stay in sync." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Filing Status" }),
          ackComplete ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-blue-600 mt-0.5 mb-1", children: "Acknowledgement number entered — only post-filing statuses available." }) : /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-orange-600 mt-0.5 mb-1", children: "Enter a valid 15-digit Acknowledgement Number to change Filing Status." }),
          !ackComplete ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "mt-1 flex items-center gap-2 px-3 bg-gray-50 text-sm text-orange-700",
              style: {
                height: "36px",
                border: "1px solid #d1d5db",
                borderRadius: "6px"
              },
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Lock, { className: "w-3.5 h-3.5 text-gray-400 shrink-0" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Pending" })
              ]
            }
          ) : /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Select,
            {
              value: currentWork.filingStatus || "Pending for E-verification",
              onValueChange: (v) => {
                if (v === "Pending") return;
                setWorkForm((f) => ({
                  ...f,
                  filingStatus: v
                }));
              },
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: "mt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {}) }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "Pending for E-verification", children: "Pending for E-verification" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "E-Verified", children: "E-Verified" })
                ] })
              ]
            }
          ),
          currentWork.filingStatus && /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "p",
            {
              className: `text-xs mt-1 ${filingStatusColor(ackComplete ? currentWork.filingStatus ?? "Pending" : "Pending")}`,
              children: [
                ackComplete && currentWork.filingStatus === "E-Verified" && "✅ Client excluded from deadline alerts",
                ackComplete && currentWork.filingStatus === "Pending for E-verification" && "⚠️ E-verification must be done within 30 days of filing",
                !ackComplete && "Work is in progress"
              ]
            }
          )
        ] }),
        workError && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-red-600 text-sm bg-red-50 rounded p-2", children: workError }),
        workSaved && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-green-600 text-sm bg-green-50 rounded p-2", children: "✅ Saved successfully!" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Button,
          {
            onClick: handleSaveWork,
            style: { background: "var(--theme-primary, #6B1A2B)" },
            className: "text-white w-full",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Save, { className: "w-4 h-4 mr-2" }),
              " Save Work Processing"
            ]
          }
        )
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(TabsContent, { value: "clienttype", className: "mt-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ClientTypePanel, { pan: client.pan }) })
    ] })
  ] });
}
export {
  ClientDetailPage as default
};
