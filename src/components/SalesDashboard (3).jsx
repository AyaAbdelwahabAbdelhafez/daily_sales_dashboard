import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import {
  Search, Sun, Moon, X, TrendingUp, Users, FileText, Wallet,
  Banknote, CreditCard, Layers, RefreshCw, ChevronDown, ChevronUp,
  ArrowUpDown, Printer, Download, MapPin, Award, SlidersHorizontal,
  Radio, Crown, Medal, BarChart3, Clock, ShieldCheck, AlertTriangle,
  Settings, Link2, Loader2, Inbox, Tag,
} from "lucide-react";

/* ---------------------------------------------------------------------
   Design tokens — signature palette: deep "control room" navy with an
   indigo primary and a muted gold used only for rank / distinction.
--------------------------------------------------------------------- */
const PALETTE = {
  primary: "#3654F4",
  primarySoft: "#6C86FF",
  gold: "#C9971C",
  success: "#12B76A",
  warning: "#F79009",
  danger: "#F04438",
  purple: "#7A5AF8",
  bgLight: "#F4F6FB",
  bgDark: "#080C16",
};
const PAY_COLORS = { cash: PALETTE.success, wallet: PALETTE.primary, bank: PALETTE.warning, other: PALETTE.purple };
const RANK_COLORS = ["#C9971C", "#94A3B8", "#B08D57"]; // gold / silver / bronze

/* ---------------------------------------------------------------------
   Live Google Sheets connection — via a Google Apps Script Web App.
   The Sheet itself stays fully private; only a small script (running
   under the owner's own permissions) exposes the rows as JSON at an
   unguessable Web App URL. See the setup steps shared with the user.

   The script returns an array of raw row arrays (no header row), in
   this exact column order (matching the linked Google Form):
   0 الطابع الزمني  1 البريد الإلكتروني  2 اسم الموظف  3 النظام
   4 الفرع  5 العهدة  6 مبيعات الكاش  7 مبيعات المحفظة
   8 مبيعات التحويلات البنكية  9 مبيعات وسائل أخرى  10 ملاحظات إضافية
--------------------------------------------------------------------- */

// Accepts either an ISO datetime string (recommended, produced by the
// Apps Script) or the Arabic Google-Forms display format as a fallback.
function parseSheetTimestamp(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim();
  const arabic = s.match(/(\d{1,2}):(\d{2}):(\d{2})\s*(ص|م|am|pm|AM|PM)?\s*(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (arabic) {
    let [, hh, mm, ss, ampm, yyyy, mo, dd] = arabic;
    hh = parseInt(hh, 10);
    if (ampm) {
      const isPM = /م|pm/i.test(ampm);
      if (isPM && hh !== 12) hh += 12;
      if (!isPM && hh === 12) hh = 0;
    }
    return new Date(parseInt(yyyy, 10), parseInt(mo, 10) - 1, parseInt(dd, 10), hh, parseInt(mm, 10), parseInt(ss, 10));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

async function fetchSheetRows(webAppUrl, sheetName) {
  if (!webAppUrl) throw new Error("no-url");
  let url = webAppUrl.trim();
  if (sheetName && sheetName.trim()) {
    const sep = url.includes("?") ? "&" : "?";
    url += `${sep}sheet=${encodeURIComponent(sheetName.trim())}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`http-${res.status}`);
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  const tableRows = Array.isArray(data) ? data : [];
  const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
  const rows = tableRows
    .map((c, idx) => {
      const get = (i) => (c && c[i] !== undefined && c[i] !== null ? c[i] : "");
      const employee = String(get(2) || "").trim();
      if (!employee) return null;
      const cash = num(get(6)), wallet = num(get(7)), bank = num(get(8)), other = num(get(9));
      return {
        id: idx + 1,
        timestamp: parseSheetTimestamp(get(0)) || new Date(0),
        email: String(get(1) || "").trim(),
        employee,
        category: String(get(3) || "").trim(),
        branch: String(get(4) || "").trim() || "بدون فرع",
        custody: num(get(5)),
        cash, wallet, bank, other,
        total: cash + wallet + bank + other,
        notes: String(get(10) || "").trim(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);
  return rows;
}

// Tracks viewport width so a handful of pixel-precise chart/layout props
// (fixed axis widths, side-by-side vs stacked blocks) can adapt on the fly
// across phones, tablets and desktops instead of only using CSS breakpoints.
function useViewportWidth() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = null;
    const onResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWidth(window.innerWidth));
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return width;
}

const fmt = (n) => new Intl.NumberFormat("en-US").format(Math.round(n));
const fmtTime = (d) => d.toLocaleTimeString("ar-EG-u-nu-latn", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (d) => d.toLocaleDateString("ar-EG-u-nu-latn", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ---------------------------------------------------------------------
   Small building blocks
--------------------------------------------------------------------- */
function Sparkline({ data, color, width = 108, height = 30 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={`0,${height} ${pts} ${width},${height}`} fill={`${color}20`} stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RadialGauge({ value, size = 92, stroke = 9, color, dark }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={dark ? "#1B2436" : "#E9ECF3"} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.7s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-extrabold" style={{ color: dark ? "#F1F5F9" : "#0F172A", fontFamily: "'Cairo',sans-serif" }}>{pct}%</span>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label, dark, unit = "SAR" }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="rounded-xl px-3.5 py-2.5 text-xs"
      style={{
        background: dark ? "#141D31" : "#FFFFFF",
        border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
        boxShadow: "0 12px 28px rgba(8,12,22,0.22)",
        minWidth: 140,
      }}
    >
      {label && <div className="font-extrabold mb-1.5" style={{ color: dark ? "#E7ECF5" : "#0F172A" }}>{label}</div>}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5" style={{ color: dark ? "#94A3B8" : "#64748B" }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: p.color || p.fill, display: "inline-block" }} />
              {p.name}
            </span>
            <span className="font-extrabold" style={{ color: dark ? "#F1F5F9" : "#0F172A" }}>{fmt(p.value)} {unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent, suffix, dark, percent, percentLabel = "٪ من الإجمالي", spark, big }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:-translate-y-[3px]"
      style={{
        background: dark ? "rgba(19,27,46,0.72)" : "#FFFFFF",
        border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.07)"}`,
        boxShadow: dark ? "0 4px 22px rgba(0,0,0,0.30)" : "0 2px 16px rgba(15,23,42,0.05)",
        minHeight: 108,
      }}
    >
      <span className="absolute top-0 bottom-0 keep-accent" style={{ insetInlineStart: 0, width: 3, background: accent }} />
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center justify-center rounded-xl shrink-0 keep-accent" style={{ width: 38, height: 38, background: `${accent}18`, color: accent }}>
          <Icon size={18} strokeWidth={2.3} />
        </div>
        {typeof percent === "number" && (
          <span className="text-[10px] font-extrabold px-2 py-1 rounded-full keep-accent" style={{ background: `${accent}16`, color: accent }}>
            {percent}{percentLabel}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-bold mb-1 truncate" style={{ color: dark ? "#8B96AC" : "#64748B" }}>{label}</div>
          <div className={`${big ? "text-[26px]" : "text-xl"} font-extrabold leading-none truncate`} style={{ color: dark ? "#F3F6FB" : "#0F172A", fontFamily: "'Cairo',sans-serif", fontVariantNumeric: "tabular-nums" }}>
            {value}{suffix ? <span className="text-[11px] font-bold mr-1" style={{ color: dark ? "#8B96AC" : "#94A3B8" }}>{suffix}</span> : null}
          </div>
        </div>
        {spark && <div className="shrink-0 mb-0.5"><Sparkline data={spark} color={accent} /></div>}
      </div>
    </div>
  );
}

function Panel({ title, subtitle, action, children, dark, className = "" }) {
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{
        background: dark ? "rgba(19,27,46,0.72)" : "#FFFFFF",
        border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.07)"}`,
        boxShadow: dark ? "0 4px 22px rgba(0,0,0,0.30)" : "0 2px 16px rgba(15,23,42,0.05)",
      }}
    >
      {(title || action) && (
        <div className="flex items-start justify-between mb-4 gap-3">
          {title && (
            <div>
              <h3 className="text-[13px] font-extrabold flex items-center gap-2" style={{ color: dark ? "#E7ECF5" : "#0F172A", fontFamily: "'Cairo',sans-serif" }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: PALETTE.primary, display: "inline-block" }} />
                {title}
              </h3>
              {subtitle && <p className="text-[11px] mt-1" style={{ color: dark ? "#7C8AA3" : "#94A3B8" }}>{subtitle}</p>}
            </div>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function Select({ value, onChange, options, placeholder, dark }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none max-w-[46vw] sm:max-w-[220px] truncate text-sm font-semibold rounded-xl pl-8 pr-3.5 py-2.5 outline-none cursor-pointer transition-colors"
        style={{
          background: dark ? "#131C30" : "#F1F4FA",
          color: dark ? "#E2E8F0" : "#1E293B",
          border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
          textOverflow: "ellipsis",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: dark ? "#94A3B8" : "#64748B" }} />
    </div>
  );
}

function RankTag({ rank }) {
  if (rank > 2) return <span className="text-[11px] font-bold w-5 text-center" style={{ color: "#94A3B8" }}>{rank + 1}</span>;
  const Icon = rank === 0 ? Crown : Medal;
  return <Icon size={15} style={{ color: RANK_COLORS[rank] }} />;
}

/* ---------------------------------------------------------------------
   Main Dashboard
--------------------------------------------------------------------- */
export default function SalesDashboard() {
  const viewportWidth = useViewportWidth();
  const isMobile = viewportWidth < 640; // Tailwind `sm`
  const isNarrow = viewportWidth < 400; // very small phones
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [branchFilter, setBranchFilter] = useState("");
  const [empFilter, setEmpFilter] = useState("");
  const [payFilter, setPayFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("timestamp");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const pageSize = 8;

  // --- Google Sheet connection state -----------------------------------
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [RAW_DATA, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [configLoaded, setConfigLoaded] = useState(false);
  const [companyName, setCompanyName] = useState("");

  // Load saved connection settings once on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("sheet-config", false);
        if (res && res.value) {
          const cfg = JSON.parse(res.value);
          setSheetUrl(cfg.url || "");
          setSheetName(cfg.sheetName || "");
          setUrlDraft(cfg.url || "");
          setNameDraft(cfg.sheetName || "");
          setCompanyName(cfg.companyName || "");
        }
      } catch (e) { /* no saved config yet */ }
      setConfigLoaded(true);
    })();
  }, []);

  const saveCompanyName = useCallback(async (name) => {
    setCompanyName(name);
    try {
      const res = await window.storage.get("sheet-config", false);
      const cfg = res && res.value ? JSON.parse(res.value) : {};
      cfg.companyName = name;
      await window.storage.set("sheet-config", JSON.stringify(cfg), false);
    } catch (e) { /* best effort */ }
  }, []);

  const fetchData = useCallback(async (url, name) => {
    if (!url) return;
    setLoading(true);
    setError("");
    try {
      const rows = await fetchSheetRows(url, name);
      setRawData(rows);
    } catch (e) {
      const msg = String(e?.message || e || "");
      let hint = "تأكد إن رابط الـ Web App صحيح وإن الـ deployment شغال.";
      if (/no-url/.test(msg)) hint = "لازم تحط رابط الـ Web App الأول.";
      else if (/http-/.test(msg)) hint = "السكريبت رجّع خطأ من جوجل نفسها. تأكد إن الـ deployment لسه شغال (Anyone can access).";
      else if (/Failed to fetch|NetworkError|TypeError/i.test(msg)) hint = "المتصفح رفض الاتصال. تأكد إن نوع الوصول (Who has access) متظبط على Anyone.";
      else if (msg && msg !== "undefined") hint = `السكريبت رجّع: ${msg}`;
      setError(`تعذر تحميل البيانات: ${hint} (تفاصيل تقنية: ${msg || "غير معروف"})`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch whenever the saved connection changes, then auto-refresh every 60s
  useEffect(() => {
    if (!configLoaded || !sheetUrl) return;
    fetchData(sheetUrl, sheetName);
    const t = setInterval(() => fetchData(sheetUrl, sheetName), 60000);
    return () => clearInterval(t);
  }, [configLoaded, sheetUrl, sheetName, fetchData]);

  const saveSettings = async () => {
    const cfg = { url: urlDraft.trim(), sheetName: nameDraft.trim(), companyName };
    setSheetUrl(cfg.url);
    setSheetName(cfg.sheetName);
    try { await window.storage.set("sheet-config", JSON.stringify(cfg), false); } catch (e) { /* ignore */ }
    setShowSettings(false);
  };

  const BRANCHES = useMemo(() => [...new Set(RAW_DATA.map((r) => r.branch).filter(Boolean))], [RAW_DATA]);
  const EMPLOYEES = useMemo(() => [...new Set(RAW_DATA.map((r) => r.employee).filter(Boolean))], [RAW_DATA]);
  const CATEGORIES = useMemo(() => [...new Set(RAW_DATA.map((r) => r.category).filter(Boolean))], [RAW_DATA]);
  const availableDays = useMemo(() => [...new Set(RAW_DATA.map((r) => ymd(r.timestamp)))].sort().reverse(), [RAW_DATA]);

  useEffect(() => {
    if (availableDays.length && !availableDays.includes(dayFilter)) setDayFilter(availableDays[0]);
  }, [availableDays]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastUpdate = useMemo(() => {
    if (!RAW_DATA.length) return null;
    return new Date(Math.max(...RAW_DATA.map((r) => r.timestamp.getTime())));
  }, [RAW_DATA]);

  const missingEmployees = useMemo(() => {
    if (!dayFilter) return [];
    const reportedToday = new Set(RAW_DATA.filter((r) => ymd(r.timestamp) === dayFilter).map((r) => r.employee));
    return EMPLOYEES.filter((e) => !reportedToday.has(e));
  }, [RAW_DATA, dayFilter, EMPLOYEES]);

  const filtered = useMemo(() => {
    let rows = RAW_DATA;
    if (dayFilter) rows = rows.filter((r) => ymd(r.timestamp) === dayFilter);
    if (branchFilter) rows = rows.filter((r) => r.branch === branchFilter);
    if (empFilter) rows = rows.filter((r) => r.employee === empFilter);
    if (categoryFilter) rows = rows.filter((r) => r.category === categoryFilter);
    if (payFilter) rows = rows.filter((r) => r[payFilter] > 0);
    if (search.trim()) {
      const q = search.trim();
      rows = rows.filter((r) => r.employee.includes(q) || r.branch.includes(q) || (r.notes || "").includes(q));
    }
    return rows;
  }, [RAW_DATA, dayFilter, branchFilter, empFilter, categoryFilter, payFilter, search]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === "timestamp") { av = av.getTime(); bv = bv.getTime(); }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv, "ar") : bv.localeCompare(av, "ar");
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [filtered, sortKey, sortDir]);

  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  const kpis = useMemo(() => {
    const totalSales = filtered.reduce((s, r) => s + r.total, 0);
    const totalCash = filtered.reduce((s, r) => s + r.cash, 0);
    const totalWallet = filtered.reduce((s, r) => s + r.wallet, 0);
    const totalBank = filtered.reduce((s, r) => s + r.bank, 0);
    const totalOther = filtered.reduce((s, r) => s + r.other, 0);
    const totalCustody = filtered.reduce((s, r) => s + r.custody, 0);
    const reports = filtered.length;
    const activeEmployees = new Set(filtered.map((r) => r.employee)).size;
    const avgPerEmp = activeEmployees ? totalSales / activeEmployees : 0;
    return { totalSales, totalCash, totalWallet, totalBank, totalOther, totalCustody, reports, activeEmployees, avgPerEmp };
  }, [filtered]);

  const byBranch = useMemo(() => BRANCHES.map((b) => ({
    name: b, total: filtered.filter((r) => r.branch === b).reduce((s, r) => s + r.total, 0),
  })), [filtered, BRANCHES]);

  const byEmployee = useMemo(() => EMPLOYEES.map((e) => ({
    name: e, total: filtered.filter((r) => r.employee === e).reduce((s, r) => s + r.total, 0),
  })).sort((a, b) => b.total - a.total), [filtered, EMPLOYEES]);

  const payMethods = useMemo(() => ([
    { name: "كاش", key: "cash", value: kpis.totalCash, color: PAY_COLORS.cash },
    { name: "محفظة", key: "wallet", value: kpis.totalWallet, color: PAY_COLORS.wallet },
    { name: "تحويل بنكي", key: "bank", value: kpis.totalBank, color: PAY_COLORS.bank },
    { name: "أخرى", key: "other", value: kpis.totalOther, color: PAY_COLORS.other },
  ]), [kpis]);

  const trend = useMemo(() => {
    const byHour = {};
    filtered.forEach((r) => {
      const h = r.timestamp.getHours();
      byHour[h] = (byHour[h] || 0) + r.total;
    });
    return Object.keys(byHour).sort((a, b) => a - b).map((h) => ({ hour: `${h}:00`, total: byHour[h] }));
  }, [filtered]);

  const peakHour = useMemo(() => trend.reduce((best, t) => (t.total > (best?.total || 0) ? t : best), null), [trend]);

  const bestEmployee = byEmployee[0];
  const worstEmployee = byEmployee.length > 1 ? byEmployee[byEmployee.length - 1] : null;
  const bestBranch = [...byBranch].sort((a, b) => b.total - a.total)[0];

  // Month-over-month comparison — always based on the full unfiltered
  // dataset (day/branch/employee filters don't apply to "this month vs last month").
  const monthlyComparison = useMemo(() => {
    const byMonth = {};
    RAW_DATA.forEach((r) => {
      const key = `${r.timestamp.getFullYear()}-${String(r.timestamp.getMonth() + 1).padStart(2, "0")}`;
      byMonth[key] = (byMonth[key] || 0) + r.total;
    });
    const months = Object.keys(byMonth).sort();
    if (months.length === 0) return null;
    const currentKey = months[months.length - 1];
    const prevKey = months.length > 1 ? months[months.length - 2] : null;
    const current = byMonth[currentKey] || 0;
    const prev = prevKey ? byMonth[prevKey] || 0 : null;
    const change = prev ? Math.round(((current - prev) / prev) * 100) : null;
    const label = (key) => {
      const [y, m] = key.split("-").map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString("ar-EG-u-nu-latn", { month: "long", year: "numeric" });
    };
    return { current, prev, change, currentLabel: label(currentKey), prevLabel: prevKey ? label(prevKey) : null };
  }, [RAW_DATA]);

  const resetFilters = () => { setBranchFilter(""); setEmpFilter(""); setPayFilter(""); setCategoryFilter(""); setSearch(""); setPage(1); };

  const toggleSort = useCallback((key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }, [sortKey]);

  const exportCsv = () => {
    const headers = ["التاريخ", "الوقت", "الموظف", "النظام", "الفرع", "العهدة", "الكاش", "المحفظة", "التحويل", "أخرى", "الإجمالي", "الملاحظات"];
    const lines = sorted.map((r) => [ymd(r.timestamp), fmtTime(r.timestamp), r.employee, r.category, r.branch, r.custody, r.cash, r.wallet, r.bank, r.other, r.total, r.notes].join(","));
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "daily_sales_report.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // --- Reconciliation ("جرد") report: branch -> employee subtotals -------
  const reconciliation = useMemo(() => {
    const branches = BRANCHES.map((b) => {
      const branchRows = filtered.filter((r) => r.branch === b);
      const employees = [...new Set(branchRows.map((r) => r.employee))];
      const empRows = employees
        .map((e) => {
          const rows = branchRows.filter((r) => r.employee === e);
          return {
            employee: e,
            reports: rows.length,
            cash: rows.reduce((s, r) => s + r.cash, 0),
            wallet: rows.reduce((s, r) => s + r.wallet, 0),
            bank: rows.reduce((s, r) => s + r.bank, 0),
            other: rows.reduce((s, r) => s + r.other, 0),
            custody: rows.reduce((s, r) => s + r.custody, 0),
            total: rows.reduce((s, r) => s + r.total, 0),
          };
        })
        .sort((a, b) => b.total - a.total);
      const totals = ["cash", "wallet", "bank", "other", "custody", "total"].reduce((acc, k) => {
        acc[k] = empRows.reduce((s, r) => s + r[k], 0);
        return acc;
      }, {});
      return { branch: b, employees: empRows, totals };
    }).filter((b) => b.employees.length > 0);

    const grand = ["cash", "wallet", "bank", "other", "custody", "total"].reduce((acc, k) => {
      acc[k] = branches.reduce((s, b) => s + b.totals[k], 0);
      return acc;
    }, {});
    return { branches, grand };
  }, [filtered, BRANCHES]);

  const exportReconciliationCsv = () => {
    const headers = ["الفرع", "الموظف", "عدد التقارير", "الكاش", "المحفظة", "التحويل", "أخرى", "العهدة", "الإجمالي"];
    const lines = [];
    reconciliation.branches.forEach((b) => {
      b.employees.forEach((e) => {
        lines.push([b.branch, e.employee, e.reports, e.cash, e.wallet, e.bank, e.other, e.custody, e.total].join(","));
      });
      lines.push([`إجمالي ${b.branch}`, "", "", b.totals.cash, b.totals.wallet, b.totals.bank, b.totals.other, b.totals.custody, b.totals.total].join(","));
    });
    lines.push(["الإجمالي العام", "", "", reconciliation.grand.cash, reconciliation.grand.wallet, reconciliation.grand.bank, reconciliation.grand.other, reconciliation.grand.custody, reconciliation.grand.total].join(","));
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `تقرير_جرد_${dayFilter || "كل_الفترات"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const bg = dark ? PALETTE.bgDark : PALETTE.bgLight;
  const text = dark ? "#E7ECF5" : "#0F172A";
  const sub = dark ? "#8B96AC" : "#64748B";
  const pct = (v) => (kpis.totalSales ? Math.round((v / kpis.totalSales) * 100) : 0);

  const NAV = [
    { id: "dashboard", label: "الرئيسية", icon: Layers },
    { id: "branches", label: "الفروع", icon: MapPin },
    { id: "analytics", label: "التحليلات", icon: TrendingUp },
    { id: "reconciliation", label: "تقرير الجرد", icon: ShieldCheck },
  ];

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full transition-colors duration-300"
      style={{ background: bg, color: text, fontFamily: "'Tajawal','Cairo',sans-serif", backgroundImage: dark ? "radial-gradient(circle at 100% 0%, rgba(54,84,244,0.10), transparent 45%)" : "radial-gradient(circle at 100% 0%, rgba(54,84,244,0.05), transparent 45%)" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800;900&family=Tajawal:wght@400;500;700&display=swap');
        * { font-family: 'Tajawal', 'Cairo', sans-serif; box-sizing: border-box; }
        h1,h2,h3,.display { font-family: 'Cairo', 'Tajawal', sans-serif; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${dark ? "#233149" : "#CBD5E1"}; border-radius: 8px; }
        @keyframes fadeUp { from { opacity:0; transform: translateY(10px);} to {opacity:1; transform:translateY(0);} }
        .fade-up { animation: fadeUp .45s ease both; }
        @keyframes pulseDot { 0%,100%{opacity:1; transform:scale(1);} 50%{opacity:.4; transform:scale(1.3);} }
        .pulse-dot { animation: pulseDot 1.6s ease-in-out infinite; }
        @keyframes shimmer { 0%{background-position:0% 0%;} 100%{background-position:200% 0%;} }
        .ticker { background: linear-gradient(90deg, ${PALETTE.primary}, ${PALETTE.purple}, ${PALETTE.gold}, ${PALETTE.primary}); background-size: 200% 100%; animation: shimmer 6s linear infinite; }
        .print-only { display: none; }
        @media print {
          @page { margin: 12mm; }
          html, body { background: #ffffff !important; }
          * { box-shadow: none !important; text-shadow: none !important; backdrop-filter: none !important; animation: none !important; transition: none !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          /* Force a clean, legible light theme in print no matter which
             screen/theme produced the page, so text never disappears
             (e.g. light text on a dark background that browsers usually
             strip out when "background graphics" printing is off). */
          body, body *:not(.keep-accent):not(.keep-accent *) {
            color: #0F172A !important;
            background-color: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          table { width: 100% !important; min-width: 0 !important; }
          th, td { border-color: #cbd5e1 !important; }
          tr, .avoid-break { page-break-inside: avoid; break-inside: avoid; }
          .printable-report { border: 1px solid #cbd5e1 !important; }
        }
      `}</style>

      {/* Header */}
      <header
        className="no-print sticky top-0 z-20 backdrop-blur-md px-4 md:px-8 pt-4 pb-3.5"
        style={{ background: dark ? "rgba(8,12,22,0.88)" : "rgba(244,246,251,0.88)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}` }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${PALETTE.primary}, ${PALETTE.purple})`, boxShadow: "0 6px 18px rgba(54,84,244,0.35)" }}
            >
              <BarChart3 size={22} color="#fff" strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <h1 className="display text-base sm:text-lg md:text-xl font-extrabold truncate" style={{ color: dark ? "#F3F6FB" : "#0F172A" }}>لوحة المبيعات اليومية</h1>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold truncate" style={{ color: sub }}>
                <span className="w-1.5 h-1.5 rounded-full pulse-dot shrink-0" style={{ background: sheetUrl ? PALETTE.success : PALETTE.danger }} />
                <span className="truncate">
                  {sheetUrl
                    ? (lastUpdate ? (isNarrow ? <>مباشر · {fmtTime(lastUpdate)}</> : <>مباشر · {fmtDate(lastUpdate)} · آخر تحديث {fmtTime(lastUpdate)}</>) : (loading ? "جاري التحميل..." : "لا توجد بيانات في الشيت"))
                    : "غير متصل بجوجل شيت"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <nav className="hidden sm:flex items-center gap-1 p-1 rounded-2xl" style={{ background: dark ? "rgba(19,27,46,0.7)" : "#EDF0F8" }}>
              {NAV.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setTab(n.id)}
                  className="flex items-center gap-1.5 text-[13px] font-bold px-3.5 py-2 rounded-xl transition-all"
                  style={{
                    background: tab === n.id ? PALETTE.primary : "transparent",
                    color: tab === n.id ? "#fff" : sub,
                    boxShadow: tab === n.id ? "0 4px 14px rgba(54,84,244,0.35)" : "none",
                  }}
                >
                  <n.icon size={15} /> {n.label}
                </button>
              ))}
            </nav>
            <button
              onClick={() => fetchData(sheetUrl, sheetName)}
              disabled={!sheetUrl || loading}
              className="p-2.5 rounded-xl transition-colors disabled:opacity-40"
              style={{ background: dark ? "rgba(19,27,46,0.7)" : "#EDF0F8", color: text }}
              aria-label="تحديث البيانات"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => { setUrlDraft(sheetUrl); setNameDraft(sheetName); setShowSettings(true); }}
              className="p-2.5 rounded-xl transition-colors"
              style={{ background: dark ? "rgba(19,27,46,0.7)" : "#EDF0F8", color: text }}
              aria-label="إعدادات الاتصال بجوجل شيت"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={() => setDark((d) => !d)}
              className="p-2.5 rounded-xl transition-colors"
              style={{ background: dark ? "rgba(19,27,46,0.7)" : "#EDF0F8", color: text }}
              aria-label="تبديل الوضع الليلي"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
        <div className="ticker h-[3px] w-full rounded-full mt-3.5 opacity-80" />
      </header>

      {/* Mobile nav */}
      <div className="no-print sm:hidden flex gap-1.5 px-4 pt-3">
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setTab(n.id)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold px-2 py-2.5 rounded-xl"
            style={{ background: tab === n.id ? PALETTE.primary : (dark ? "rgba(19,27,46,0.7)" : "#EDF0F8"), color: tab === n.id ? "#fff" : sub }}>
            <n.icon size={14} /> {n.label}
          </button>
        ))}
      </div>

      <main className="px-4 md:px-8 py-6 max-w-[1400px] mx-auto">
        {!sheetUrl && (
          <div className="fade-up flex flex-col items-center text-center gap-3 rounded-2xl px-6 py-16 mb-6" style={{ background: dark ? "rgba(19,27,46,0.72)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.07)"}` }}>
            <span className="flex items-center justify-center rounded-2xl" style={{ width: 56, height: 56, background: `${PALETTE.primary}18`, color: PALETTE.primary }}>
              <Link2 size={26} />
            </span>
            <h2 className="text-lg font-extrabold" style={{ color: text }}>لسه مش متربط بجوجل شيت</h2>
            <p className="text-sm max-w-md" style={{ color: sub }}>
              اضغط على أيقونة الإعدادات <Settings size={13} className="inline mx-1" /> فوق، وحُط رابط الـ Google Apps Script Web App بتاعك، وهيتم سحب البيانات تلقائيًا.
            </p>
            <button onClick={() => { setUrlDraft(sheetUrl); setNameDraft(sheetName); setShowSettings(true); }} className="mt-2 flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl text-white" style={{ background: PALETTE.primary }}>
              <Settings size={14} /> ربط الشيت الآن
            </button>
          </div>
        )}

        {sheetUrl && error && (
          <div className="fade-up flex items-center gap-3 rounded-2xl px-4 py-3.5 mb-6" style={{ background: dark ? "rgba(240,68,56,0.10)" : "rgba(240,68,56,0.07)", border: `1px solid ${PALETTE.danger}33` }}>
            <span className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 34, height: 34, background: `${PALETTE.danger}18`, color: PALETTE.danger }}>
              <AlertTriangle size={17} />
            </span>
            <p className="text-sm font-bold" style={{ color: dark ? "#FCA5A5" : PALETTE.danger }}>{error}</p>
          </div>
        )}

        {sheetUrl && !error && loading && RAW_DATA.length === 0 && (
          <div className="fade-up flex flex-col items-center gap-3 py-16 text-sm font-bold" style={{ color: sub }}>
            <Loader2 size={26} className="animate-spin" style={{ color: PALETTE.primary }} />
            جاري تحميل البيانات من الشيت...
          </div>
        )}

        {sheetUrl && !error && !loading && RAW_DATA.length === 0 && (
          <div className="fade-up flex flex-col items-center text-center gap-2 rounded-2xl px-6 py-16 mb-6" style={{ background: dark ? "rgba(19,27,46,0.72)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.07)"}` }}>
            <Inbox size={28} style={{ color: sub }} />
            <p className="text-sm font-bold" style={{ color: sub }}>الشيت متصل، بس لسه مفيش ردود فيه.</p>
          </div>
        )}

        {sheetUrl && !error && RAW_DATA.length > 0 && (<>
        {tab === "dashboard" && (
          <>
            {/* Missing daily reports alert */}
            {missingEmployees.length > 0 && (
              <div
                className="no-print fade-up flex items-center gap-3 rounded-2xl px-4 py-3.5 mb-5"
                style={{
                  background: dark ? "rgba(240,68,56,0.10)" : "rgba(240,68,56,0.07)",
                  border: `1px solid ${PALETTE.danger}33`,
                }}
              >
                <span className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 34, height: 34, background: `${PALETTE.danger}18`, color: PALETTE.danger }}>
                  <AlertTriangle size={17} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold" style={{ color: dark ? "#FCA5A5" : PALETTE.danger }}>
                    {missingEmployees.length} من الموظفين لسه ما بعتوش تقرير مبيعات اليوم
                  </p>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: sub }}>
                    {missingEmployees.join("، ")}
                  </p>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="no-print fade-up flex flex-wrap items-center gap-2 mb-6">
              <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: dark ? "rgba(19,27,46,0.7)" : "#EDF0F8", color: sub }}>
                <SlidersHorizontal size={15} />
              </div>
              {availableDays.length > 1 && (
                <Select value={dayFilter} onChange={(v) => { setDayFilter(v); setPage(1); }} options={availableDays} placeholder="أحدث يوم" dark={dark} />
              )}
              <Select value={branchFilter} onChange={(v) => { setBranchFilter(v); setPage(1); }} options={BRANCHES} placeholder="كل الفروع" dark={dark} />
              <Select value={empFilter} onChange={(v) => { setEmpFilter(v); setPage(1); }} options={EMPLOYEES} placeholder="كل الموظفين" dark={dark} />
              {CATEGORIES.length > 0 && (
                <Select value={categoryFilter} onChange={(v) => { setCategoryFilter(v); setPage(1); }} options={CATEGORIES} placeholder="كل الأنظمة" dark={dark} />
              )}
              <Select value={payFilter} onChange={(v) => { setPayFilter(v); setPage(1); }} options={["cash", "wallet", "bank", "other"]} placeholder="طريقة الدفع" dark={dark} />
              <button onClick={resetFilters} className="flex items-center gap-1.5 text-sm font-bold px-3.5 py-2.5 rounded-xl transition-colors" style={{ color: PALETTE.danger, background: `${PALETTE.danger}12` }}>
                <RefreshCw size={13} /> إعادة تعيين
              </button>
            </div>

            {/* KPIs */}
            <div className={`fade-up grid ${isNarrow ? "grid-cols-1" : "grid-cols-2"} sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6`}>
              <KpiCard dark={dark} big icon={TrendingUp} label="إجمالي المبيعات" value={fmt(kpis.totalSales)} suffix="SAR" accent={PALETTE.primary} spark={trend.map((t) => t.total)} />
              <KpiCard dark={dark} icon={FileText} label="عدد التقارير" value={fmt(kpis.reports)} accent={PALETTE.primarySoft} />
              <KpiCard dark={dark} icon={Users} label="موظفون أرسلوا اليوم" value={`${kpis.activeEmployees}/${EMPLOYEES.length}`} accent={PALETTE.success} />
              <KpiCard dark={dark} icon={Award} label="متوسط المبيعات للموظف" value={fmt(kpis.avgPerEmp)} suffix="SAR" accent={PALETTE.gold} />
              <KpiCard dark={dark} icon={Banknote} label="إجمالي الكاش" value={fmt(kpis.totalCash)} suffix="SAR" accent={PAY_COLORS.cash} percent={pct(kpis.totalCash)} />
              <KpiCard dark={dark} icon={Wallet} label="إجمالي المحافظ" value={fmt(kpis.totalWallet)} suffix="SAR" accent={PAY_COLORS.wallet} percent={pct(kpis.totalWallet)} />
              <KpiCard dark={dark} icon={CreditCard} label="التحويلات البنكية" value={fmt(kpis.totalBank)} suffix="SAR" accent={PAY_COLORS.bank} percent={pct(kpis.totalBank)} />
              <KpiCard dark={dark} icon={Layers} label="وسائل أخرى" value={fmt(kpis.totalOther)} suffix="SAR" accent={PAY_COLORS.other} percent={pct(kpis.totalOther)} />
              <KpiCard dark={dark} icon={ShieldCheck} label="إجمالي العهدة" value={fmt(kpis.totalCustody)} suffix="SAR" accent={PALETTE.gold} />
              {monthlyComparison && (
                <KpiCard
                  dark={dark}
                  icon={TrendingUp}
                  label={`مبيعات ${monthlyComparison.currentLabel}`}
                  value={fmt(monthlyComparison.current)}
                  suffix="SAR"
                  accent={monthlyComparison.change == null ? PALETTE.primarySoft : monthlyComparison.change >= 0 ? PALETTE.success : PALETTE.danger}
                  percent={monthlyComparison.change == null ? undefined : Math.abs(monthlyComparison.change)}
                  percentLabel={monthlyComparison.change == null ? "" : monthlyComparison.change >= 0 ? "٪ ▲ عن الشهر السابق" : "٪ ▼ عن الشهر السابق"}
                />
              )}
            </div>

            {/* Charts row 1 */}
            <div className="no-print fade-up grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <Panel dark={dark} title="إجمالي المبيعات حسب الفرع" subtitle="مقارنة الأداء بين الفروع الثلاثة">
                <div style={{ direction: "ltr" }}>
<ResponsiveContainer width="100%" height={270}>
                  <BarChart data={byBranch} margin={{ top: 22, left: 0, right: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 6" stroke={dark ? "#1B2436" : "#E9ECF3"} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: sub, fontSize: 12.5, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: sub, fontSize: 11 }} axisLine={false} tickLine={false} width={44} tickFormatter={fmt} />
                    <Tooltip cursor={{ fill: dark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.03)" }} content={<ChartTooltip dark={dark} />} />
                    <Bar dataKey="total" name="المبيعات" radius={[10, 10, 0, 0]} maxBarSize={64}>
                      {byBranch.map((_, i) => <Cell key={i} fill={i === 0 ? PALETTE.primary : i === 1 ? PALETTE.primarySoft : "#A7B4FF"} />)}
                      <LabelList dataKey="total" position="top" formatter={fmt} style={{ fill: sub, fontSize: 11.5, fontWeight: 800 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
</div>
              </Panel>

              <Panel dark={dark} title="توزيع طرق الدفع" subtitle="نسبة كل وسيلة من إجمالي المبيعات">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative shrink-0" style={{ width: 190, height: 190, maxWidth: "100%" }}>
                    <div style={{ direction: "ltr", width: "100%", height: "100%" }}>
<ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={payMethods} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3} strokeWidth={0}>
                          {payMethods.map((p, i) => <Cell key={i} fill={p.color} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip dark={dark} />} />
                      </PieChart>
                    </ResponsiveContainer>
</div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-bold" style={{ color: sub }}>الإجمالي</span>
                      <span className="text-base font-extrabold" style={{ color: text, fontFamily: "'Cairo',sans-serif" }}>{fmt(kpis.totalSales)}</span>
                    </div>
                  </div>
                  <div className="w-full flex-1 min-w-0 space-y-2.5">
                    {payMethods.map((p) => (
                      <div key={p.key} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 font-bold truncate" style={{ color: text }}>
                          <span style={{ width: 9, height: 9, borderRadius: 99, background: p.color, display: "inline-block" }} />
                          {p.name}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="font-extrabold" style={{ color: text }}>{fmt(p.value)}</span>
                          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${p.color}18`, color: p.color }}>{pct(p.value)}٪</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
            </div>

            {/* Charts row 2 - ENHANCED for clarity */}
            <div className="no-print fade-up grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Employee Comparison - Made clearer with larger bars and bolder colors */}
              <Panel dark={dark} title="مقارنة الموظفين" subtitle="ترتيب حسب إجمالي المبيعات" className="lg:col-span-1">
                <div style={{ direction: "ltr" }}>
<ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byEmployee} layout="vertical" margin={{ top: 4, left: 8, right: isNarrow ? 34 : 56, bottom: 4 }} barCategoryGap="24%">
                    <CartesianGrid strokeDasharray="3 6" stroke={dark ? "#1B2436" : "#E9ECF3"} horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fill: text, fontSize: isNarrow ? 11 : 13, fontWeight: 700 }} axisLine={false} tickLine={false} width={isNarrow ? 76 : 112} interval={0} />
                    <Tooltip cursor={{ fill: dark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.03)" }} content={<ChartTooltip dark={dark} />} />
                    <Bar dataKey="total" name="المبيعات" radius={[0, 12, 12, 0]} maxBarSize={28}>
                      {byEmployee.map((item, i) => {
                        // Bolder colors: gold for #1, silver for #2, bronze for #3, distinct teal for others
                        let fillColor;
                        if (i === 0) fillColor = "#C9971C"; // Gold
                        else if (i === 1) fillColor = "#94A3B8"; // Silver
                        else if (i === 2) fillColor = "#B08D57"; // Bronze
                        else fillColor = dark ? "#4A5A7A" : "#7C8AA3";
                        return <Cell key={i} fill={fillColor} />;
                      })}
                      <LabelList dataKey="total" position="right" formatter={(v) => (isNarrow ? fmt(v) : `${fmt(v)} SAR`)} style={{ fill: text, fontSize: isNarrow ? 11 : 13, fontWeight: 800 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
</div>
              </Panel>


              {/* Sales Trend - Made clearer with larger area and more prominent grid */}
              <Panel
                dark={dark} title="تطور المبيعات خلال اليوم"
                subtitle={peakHour ? `الذروة الساعة ${peakHour.hour} بقيمة ${fmt(peakHour.total)} SAR` : ""}
                className="lg:col-span-2"
              >
                <div style={{ direction: "ltr" }}>
<ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={trend} margin={{ top: 10, left: 0, right: 8 }}>
                    <defs>
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PALETTE.primary} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={PALETTE.primary} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 6" stroke={dark ? "#1B2436" : "#E9ECF3"} vertical={false} strokeOpacity={0.6} />
                    <XAxis dataKey="hour" tick={{ fill: sub, fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: sub, fontSize: 12 }} axisLine={false} tickLine={false} width={48} tickFormatter={fmt} />
                    <Tooltip content={<ChartTooltip dark={dark} />} />
                    <Area type="monotone" dataKey="total" name="المبيعات" stroke={PALETTE.primary} strokeWidth={3.5} fill="url(#trendFill)" dot={{ r: 4.5, fill: PALETTE.primary, strokeWidth: 0 }} activeDot={{ r: 7 }} />
                  </AreaChart>
                </ResponsiveContainer>
</div>
              </Panel>
            </div>

            {/* Table */}
            <Panel dark={dark} title={null} className="fade-up">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-[13px] font-extrabold flex items-center gap-2" style={{ color: dark ? "#E7ECF5" : "#0F172A", fontFamily: "'Cairo',sans-serif" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: PALETTE.primary, display: "inline-block" }} />
                  سجل التقارير
                </h3>
                <div className="no-print flex items-center gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: sub }} />
                    <input
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      placeholder="بحث..."
                      className="text-sm rounded-xl py-2.5 pr-8 pl-3 outline-none font-semibold"
                      style={{ background: dark ? "#131C30" : "#F1F4FA", color: text, border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}` }}
                    />
                  </div>
                  <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl" style={{ background: `${PALETTE.success}15`, color: PALETTE.success }}>
                    <Download size={13} /> تصدير Excel
                  </button>
                  <button onClick={() => window.print()} className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl" style={{ background: `${PALETTE.primary}15`, color: PALETTE.primary }}>
                    <Printer size={13} /> طباعة / PDF
                  </button>
                </div>
              </div>

              {/* Print-only header: shown only when this page is printed, gives
                  the PDF a proper report title instead of dashboard chrome. */}
              <div className="print-only mb-4">
                <h2 className="text-lg font-extrabold" style={{ color: "#0F172A" }}>{companyName || "سجل التقارير"}</h2>
                <p className="text-xs font-bold mt-1" style={{ color: "#64748B" }}>
                  {dayFilter || "كل الفترات"}{branchFilter ? ` · ${branchFilter}` : ""}{empFilter ? ` · ${empFilter}` : ""} · {fmt(sorted.length)} سجل · إجمالي {fmt(kpis.totalSales)} SAR
                </p>
              </div>

              <div className="no-print">
              {isMobile ? (
                <div className="space-y-2.5">
                  {paged.map((r, idx) => (
                    <div
                      key={r.id}
                      className="rounded-xl p-3.5"
                      style={{
                        background: idx % 2 ? (dark ? "rgba(255,255,255,0.02)" : "#FBFCFE") : (dark ? "rgba(255,255,255,0.035)" : "#F7F9FC"),
                        border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="min-w-0">
                          <button className="text-sm font-extrabold truncate block" style={{ color: PALETTE.primary }} onClick={() => setSelectedEmp(r.employee)}>{r.employee}</button>
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[11px] font-semibold" style={{ color: sub }}>
                            <span>{fmtTime(r.timestamp)}</span>
                            <span>·</span>
                            <span className="truncate">{r.branch}</span>
                            {r.category && (<><span>·</span><span className="truncate">{r.category}</span></>)}
                          </div>
                        </div>
                        <div className="text-left shrink-0">
                          <div className="text-[10px] font-bold" style={{ color: sub }}>الإجمالي</div>
                          <div className="text-sm font-extrabold" style={{ color: text }}>{fmt(r.total)}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px] font-bold">
                        {[
                          { label: "كاش", value: r.cash, color: PAY_COLORS.cash },
                          { label: "محفظة", value: r.wallet, color: PAY_COLORS.wallet },
                          { label: "تحويل", value: r.bank, color: PAY_COLORS.bank },
                          { label: "أخرى", value: r.other, color: PAY_COLORS.other },
                          { label: "العهدة", value: r.custody, color: PALETTE.gold },
                        ].filter((c) => c.value > 0 || c.label === "كاش" || c.label === "العهدة").map((c) => (
                          <div key={c.label} className="rounded-lg px-2 py-1.5" style={{ background: dark ? "rgba(255,255,255,0.03)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.05)"}` }}>
                            <div style={{ color: c.color }}>{c.label}</div>
                            <div style={{ color: text }}>{fmt(c.value)}</div>
                          </div>
                        ))}
                      </div>
                      {r.notes && <p className="text-[11px] font-semibold mt-2.5 leading-relaxed" style={{ color: sub }}>{r.notes}</p>}
                    </div>
                  ))}
                  {paged.length === 0 && (
                    <p className="text-center py-8 text-sm font-semibold" style={{ color: sub }}>لا توجد بيانات مطابقة للفلاتر الحالية</p>
                  )}
                </div>
              ) : (
              <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${dark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.05)"}` }}>
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr style={{ background: dark ? "rgba(255,255,255,0.03)" : "#F7F9FC", borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}` }}>
                      {[
                        ["timestamp", "الوقت"], ["employee", "الموظف"], ["category", "النظام"], ["branch", "الفرع"], ["custody", "العهدة"],
                        ["cash", "الكاش"], ["wallet", "المحفظة"], ["bank", "التحويل"], ["other", "أخرى"], ["total", "الإجمالي"], ["notes", "ملاحظات"],
                      ].map(([key, label]) => (
                        <th key={key} onClick={() => toggleSort(key)} className="text-right py-3 px-3 font-extrabold cursor-pointer select-none whitespace-nowrap" style={{ color: sub }}>
                          <span className="inline-flex items-center gap-1">
                            {label}
                            {sortKey === key ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={11} opacity={0.4} />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((r, idx) => (
                      <tr key={r.id} style={{ background: idx % 2 ? (dark ? "rgba(255,255,255,0.015)" : "#FBFCFE") : "transparent", borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)"}` }}>
                        <td className="py-2.5 px-3 whitespace-nowrap" style={{ color: sub }}>{fmtTime(r.timestamp)}</td>
                        <td className="py-2.5 px-3 font-bold cursor-pointer" style={{ color: PALETTE.primary }} onClick={() => setSelectedEmp(r.employee)}>{r.employee}</td>
                        <td className="py-2.5 px-3">{r.category || "—"}</td>
                        <td className="py-2.5 px-3">{r.branch}</td>
                        <td className="py-2.5 px-3">{fmt(r.custody)}</td>
                        <td className="py-2.5 px-3">{fmt(r.cash)}</td>
                        <td className="py-2.5 px-3">{fmt(r.wallet)}</td>
                        <td className="py-2.5 px-3">{fmt(r.bank)}</td>
                        <td className="py-2.5 px-3">{fmt(r.other)}</td>
                        <td className="py-2.5 px-3 font-extrabold" style={{ color: text }}>{fmt(r.total)}</td>
                        <td className="py-2.5 px-3 text-xs" style={{ color: sub }}>{r.notes || "—"}</td>
                      </tr>
                    ))}
                    {paged.length === 0 && (
                      <tr><td colSpan={11} className="text-center py-8" style={{ color: sub }}>لا توجد بيانات مطابقة للفلاتر الحالية</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              )}
              </div>

              {/* Print-only table: the full filtered result set, not just the
                  current page, laid out as a plain table regardless of the
                  screen size that triggered printing. */}
              <div className="print-only overflow-visible rounded-xl" style={{ border: "1px solid #cbd5e1" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#F7F9FC", borderBottom: "1px solid #cbd5e1" }}>
                      {["الوقت", "الموظف", "النظام", "الفرع", "العهدة", "الكاش", "المحفظة", "التحويل", "أخرى", "الإجمالي", "ملاحظات"].map((label) => (
                        <th key={label} className="avoid-break text-right py-2 px-2.5 font-extrabold whitespace-nowrap" style={{ color: "#64748B" }}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r) => (
                      <tr key={r.id} className="avoid-break" style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td className="py-1.5 px-2.5 whitespace-nowrap">{fmtTime(r.timestamp)}</td>
                        <td className="py-1.5 px-2.5 font-bold">{r.employee}</td>
                        <td className="py-1.5 px-2.5">{r.category || "—"}</td>
                        <td className="py-1.5 px-2.5">{r.branch}</td>
                        <td className="py-1.5 px-2.5">{fmt(r.custody)}</td>
                        <td className="py-1.5 px-2.5">{fmt(r.cash)}</td>
                        <td className="py-1.5 px-2.5">{fmt(r.wallet)}</td>
                        <td className="py-1.5 px-2.5">{fmt(r.bank)}</td>
                        <td className="py-1.5 px-2.5">{fmt(r.other)}</td>
                        <td className="py-1.5 px-2.5 font-extrabold">{fmt(r.total)}</td>
                        <td className="py-1.5 px-2.5">{r.notes || "—"}</td>
                      </tr>
                    ))}
                    {sorted.length === 0 && (
                      <tr><td colSpan={11} className="text-center py-6">لا توجد بيانات مطابقة للفلاتر الحالية</td></tr>
                    )}
                  </tbody>
                  {sorted.length > 0 && (
                    <tfoot>
                      <tr style={{ background: "#F7F9FC", borderTop: "2px solid #0F172A" }}>
                        <td colSpan={4} className="py-2 px-2.5 font-extrabold">الإجمالي</td>
                        <td className="py-2 px-2.5 font-extrabold">{fmt(kpis.totalCustody)}</td>
                        <td className="py-2 px-2.5 font-extrabold">{fmt(kpis.totalCash)}</td>
                        <td className="py-2 px-2.5 font-extrabold">{fmt(kpis.totalWallet)}</td>
                        <td className="py-2 px-2.5 font-extrabold">{fmt(kpis.totalBank)}</td>
                        <td className="py-2 px-2.5 font-extrabold">{fmt(kpis.totalOther)}</td>
                        <td className="py-2 px-2.5 font-extrabold">{fmt(kpis.totalSales)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <div className="no-print flex items-center justify-between mt-4 text-xs font-semibold" style={{ color: sub }}>
                <span>عرض {paged.length} من أصل {sorted.length} سجل</span>
                <div className="flex items-center gap-1">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg disabled:opacity-30 font-bold" style={{ background: dark ? "#131C30" : "#F1F4FA" }}>السابق</button>
                  <span className="px-2">{page} / {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg disabled:opacity-30 font-bold" style={{ background: dark ? "#131C30" : "#F1F4FA" }}>التالي</button>
                </div>
              </div>
            </Panel>
          </>
        )}

        {tab === "branches" && (
          <div className="fade-up grid grid-cols-1 md:grid-cols-3 gap-4">
            {BRANCHES.map((b) => {
              const rows = RAW_DATA.filter((r) => r.branch === b);
              const total = rows.reduce((s, r) => s + r.total, 0);
              const emps = new Set(rows.map((r) => r.employee));
              const avg = emps.size ? total / emps.size : 0;
              const overallTotal = RAW_DATA.reduce((s, r) => s + r.total, 0);
              const branchPct = overallTotal ? Math.round((total / overallTotal) * 100) : 0;
              const empTotals = [...emps].map((e) => ({ e, t: rows.filter((r) => r.employee === e).reduce((s, r) => s + r.total, 0) })).sort((a, b) => b.t - a.t);
              const isTop = b === bestBranch?.name;
              return (
                <Panel key={b} dark={dark} title={b} action={isTop ? (
                  <span className="flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full" style={{ background: `${PALETTE.gold}18`, color: PALETTE.gold }}>
                    <Crown size={11} /> الأعلى مبيعًا
                  </span>
                ) : null}>
                  <div className="flex items-center gap-5 mb-4">
                    <RadialGauge value={branchPct} color={isTop ? PALETTE.gold : PALETTE.primary} dark={dark} />
                    <div className="space-y-2.5 flex-1 min-w-0">
                      <div className="flex justify-between text-sm"><span style={{ color: sub }}>إجمالي المبيعات</span><span className="font-extrabold" style={{ color: text }}>{fmt(total)} SAR</span></div>
                      <div className="flex justify-between text-sm"><span style={{ color: sub }}>عدد الموظفين</span><span className="font-extrabold" style={{ color: text }}>{emps.size}</span></div>
                      <div className="flex justify-between text-sm"><span style={{ color: sub }}>متوسط المبيعات</span><span className="font-extrabold" style={{ color: text }}>{fmt(avg)} SAR</span></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm rounded-xl px-3.5 py-2.5 mb-2" style={{ background: dark ? "rgba(255,255,255,0.03)" : "#F7F9FC" }}>
                    <span className="flex items-center gap-1.5 font-bold" style={{ color: sub }}><ShieldCheck size={14} /> أفضل موظف</span>
                    <span className="font-extrabold" style={{ color: text }}>{empTotals[0]?.e || "—"}</span>
                  </div>
                  {empTotals.length > 1 && (
                    <div className="flex items-center justify-between text-sm rounded-xl px-3.5 py-2.5" style={{ background: dark ? "rgba(255,255,255,0.03)" : "#F7F9FC" }}>
                      <span className="flex items-center gap-1.5 font-bold" style={{ color: sub }}><AlertTriangle size={14} /> أقل موظف</span>
                      <span className="font-extrabold" style={{ color: text }}>{empTotals[empTotals.length - 1]?.e || "—"}</span>
                    </div>
                  )}
                </Panel>
              );
            })}
          </div>
        )}

        {tab === "analytics" && (
          <div className="fade-up grid grid-cols-1 md:grid-cols-2 gap-4">
            <Panel dark={dark} title="ملخص الأداء" subtitle="أبرز مؤشرات اليوم">
              <ul className="space-y-1">
                {[
                  { icon: Crown, label: "أفضل موظف اليوم", value: `${bestEmployee?.name || "—"} — ${fmt(bestEmployee?.total || 0)} SAR`, color: PALETTE.gold },
                  { icon: AlertTriangle, label: "أقل موظف مبيعًا", value: worstEmployee ? `${worstEmployee.name} — ${fmt(worstEmployee.total)} SAR` : "—", color: PALETTE.danger },
                  { icon: MapPin, label: "أفضل فرع", value: `${bestBranch?.name || "—"} — ${fmt(bestBranch?.total || 0)} SAR`, color: PALETTE.primary },
                  { icon: Banknote, label: "أعلى طريقة دفع", value: [...payMethods].sort((a, b) => b.value - a.value)[0]?.name, color: PALETTE.success },
                  { icon: CreditCard, label: "أقل طريقة دفع", value: [...payMethods].sort((a, b) => a.value - b.value)[0]?.name, color: PALETTE.warning },
                  { icon: Clock, label: "ساعة الذروة", value: peakHour ? `${peakHour.hour} — ${fmt(peakHour.total)} SAR` : "—", color: PALETTE.purple },
                  { icon: Award, label: "متوسط المبيعات للموظف", value: `${fmt(kpis.avgPerEmp)} SAR`, color: PALETTE.primarySoft },
                  { icon: ShieldCheck, label: "إجمالي العهدة", value: `${fmt(kpis.totalCustody)} SAR`, color: PALETTE.gold },
                ].map((row, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5" style={{ borderBottom: i < 5 ? `1px solid ${dark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.05)"}` : "none" }}>
                    <span className="flex items-center gap-2.5 text-sm font-bold" style={{ color: sub }}>
                      <span className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 28, height: 28, background: `${row.color}18`, color: row.color }}>
                        <row.icon size={14} />
                      </span>
                      {row.label}
                    </span>
                    <span className="text-sm font-extrabold text-left mr-[38px] sm:mr-0" style={{ color: text }}>{row.value}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel dark={dark} title="نسبة مساهمة كل فرع" subtitle="من إجمالي مبيعات اليوم">
              <div style={{ direction: "ltr" }}>
<ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={byBranch} dataKey="total" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} strokeWidth={0}>
                    {byBranch.map((_, i) => <Cell key={i} fill={[PALETTE.primary, PALETTE.success, PALETTE.gold][i % 3]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip dark={dark} />} />
                </PieChart>
              </ResponsiveContainer>
</div>
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 mt-1">
                {byBranch.map((b, i) => (
                  <span key={b.name} className="flex items-center gap-1.5 text-xs font-bold" style={{ color: sub }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: [PALETTE.primary, PALETTE.success, PALETTE.gold][i % 3], display: "inline-block" }} />
                    {b.name}
                  </span>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {tab === "reconciliation" && (
          <div className="fade-up printable-report rounded-2xl p-6 md:p-8" style={{ background: "#fff", border: "1px solid rgba(15,23,42,0.08)", boxShadow: "0 2px 16px rgba(15,23,42,0.05)" }}>
            {/* Report header */}
            <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <label className="text-xs font-bold shrink-0" style={{ color: "#64748B" }}>اسم المنشأة على التقرير:</label>
                <input
                  defaultValue={companyName}
                  onBlur={(e) => saveCompanyName(e.target.value)}
                  placeholder="مثال: مؤسسة الإدارة المركزية"
                  className="w-full sm:w-auto min-w-0 text-sm rounded-xl py-2 px-3 outline-none font-semibold"
                  style={{ background: "#F1F4FA", color: "#0F172A", border: "1px solid rgba(15,23,42,0.08)" }}
                />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={exportReconciliationCsv} className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl" style={{ background: `${PALETTE.success}15`, color: PALETTE.success }}>
                  <Download size={13} /> تصدير Excel
                </button>
                <button onClick={() => window.print()} className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl" style={{ background: `${PALETTE.primary}15`, color: PALETTE.primary }}>
                  <Printer size={13} /> طباعة / PDF
                </button>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 mb-2 pb-5" style={{ borderBottom: "2px solid #0F172A" }}>
              <div>
                <h2 className="text-xl font-extrabold" style={{ color: "#0F172A" }}>{companyName || "اسم المنشأة"}</h2>
                <p className="text-sm font-bold mt-1" style={{ color: "#334155" }}>تقرير جرد ومطابقة المبيعات اليومية</p>
              </div>
              <div className="text-left shrink-0">
                <p className="text-xs font-bold" style={{ color: "#64748B" }}>رقم التقرير</p>
                <p className="text-sm font-extrabold mb-2" style={{ color: "#0F172A" }}>RPT-{(dayFilter || "ALL").replace(/-/g, "")}</p>
                <p className="text-xs font-bold" style={{ color: "#64748B" }}>تاريخ الإصدار</p>
                <p className="text-sm font-extrabold" style={{ color: "#0F172A" }}>{fmtDate(new Date())}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-5 text-sm">
              <div><span className="font-bold" style={{ color: "#64748B" }}>الفترة: </span><span className="font-extrabold" style={{ color: "#0F172A" }}>{dayFilter || "كل الفترات"}</span></div>
              <div><span className="font-bold" style={{ color: "#64748B" }}>الفرع: </span><span className="font-extrabold" style={{ color: "#0F172A" }}>{branchFilter || "كل الفروع"}</span></div>
              <div><span className="font-bold" style={{ color: "#64748B" }}>عدد الفروع: </span><span className="font-extrabold" style={{ color: "#0F172A" }}>{reconciliation.branches.length}</span></div>
              <div><span className="font-bold" style={{ color: "#64748B" }}>عدد العمليات: </span><span className="font-extrabold" style={{ color: "#0F172A" }}>{fmt(kpis.reports)}</span></div>
            </div>

            {/* Grand totals strip */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-7">
              {[
                { label: "الكاش", value: reconciliation.grand.cash, color: PAY_COLORS.cash },
                { label: "المحفظة", value: reconciliation.grand.wallet, color: PAY_COLORS.wallet },
                { label: "التحويلات", value: reconciliation.grand.bank, color: PAY_COLORS.bank },
                { label: "وسائل أخرى", value: reconciliation.grand.other, color: PAY_COLORS.other },
                { label: "إجمالي العهدة", value: reconciliation.grand.custody, color: PALETTE.gold },
                { label: "الإجمالي العام", value: reconciliation.grand.total, color: PALETTE.primary },
              ].map((c) => (
                <div key={c.label} className="keep-accent rounded-xl p-3" style={{ background: "#F7F9FC", borderTop: `3px solid ${c.color}` }}>
                  <div className="text-[11px] font-bold mb-1" style={{ color: "#64748B" }}>{c.label}</div>
                  <div className="text-sm font-extrabold" style={{ color: "#0F172A" }}>{fmt(c.value)} SAR</div>
                </div>
              ))}
            </div>

            {/* Per-branch reconciliation tables */}
            {reconciliation.branches.length === 0 && (
              <p className="text-sm font-bold text-center py-10" style={{ color: "#94A3B8" }}>لا توجد بيانات مطابقة للفلاتر الحالية لعمل الجرد.</p>
            )}
            {reconciliation.branches.map((b) => (
              <div key={b.branch} className="mb-7">
                <h4 className="text-sm font-extrabold mb-2.5 flex items-center gap-2" style={{ color: "#0F172A" }}>
                  <MapPin size={14} style={{ color: PALETTE.primary }} /> {b.branch}
                </h4>
                <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #E2E8F0" }}>
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr style={{ background: "#F7F9FC", borderBottom: "1px solid #E2E8F0" }}>
                        {["الموظف", "عدد التقارير", "الكاش", "المحفظة", "التحويل", "أخرى", "العهدة", "الإجمالي"].map((h) => (
                          <th key={h} className="text-right py-2.5 px-3 font-extrabold" style={{ color: "#64748B" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {b.employees.map((e) => (
                        <tr key={e.employee} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td className="py-2.5 px-3 font-bold" style={{ color: "#0F172A" }}>{e.employee}</td>
                          <td className="py-2.5 px-3">{fmt(e.reports)}</td>
                          <td className="py-2.5 px-3">{fmt(e.cash)}</td>
                          <td className="py-2.5 px-3">{fmt(e.wallet)}</td>
                          <td className="py-2.5 px-3">{fmt(e.bank)}</td>
                          <td className="py-2.5 px-3">{fmt(e.other)}</td>
                          <td className="py-2.5 px-3">{fmt(e.custody)}</td>
                          <td className="py-2.5 px-3 font-extrabold" style={{ color: "#0F172A" }}>{fmt(e.total)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: "#F7F9FC" }}>
                        <td className="py-2.5 px-3 font-extrabold" style={{ color: "#0F172A" }}>إجمالي {b.branch}</td>
                        <td className="py-2.5 px-3 font-extrabold">{fmt(b.employees.reduce((s, e) => s + e.reports, 0))}</td>
                        <td className="py-2.5 px-3 font-extrabold">{fmt(b.totals.cash)}</td>
                        <td className="py-2.5 px-3 font-extrabold">{fmt(b.totals.wallet)}</td>
                        <td className="py-2.5 px-3 font-extrabold">{fmt(b.totals.bank)}</td>
                        <td className="py-2.5 px-3 font-extrabold">{fmt(b.totals.other)}</td>
                        <td className="py-2.5 px-3 font-extrabold">{fmt(b.totals.custody)}</td>
                        <td className="py-2.5 px-3 font-extrabold" style={{ color: PALETTE.primary }}>{fmt(b.totals.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* Signatures */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10 pt-6" style={{ borderTop: "1px dashed #CBD5E1" }}>
              <div>
                <p className="text-xs font-bold mb-8" style={{ color: "#64748B" }}>توقيع المدير المسؤول</p>
                <div style={{ borderTop: "1px solid #94A3B8" }} />
                <p className="text-[11px] font-semibold mt-1" style={{ color: "#94A3B8" }}>الاسم والتاريخ</p>
              </div>
              <div>
                <p className="text-xs font-bold mb-8" style={{ color: "#64748B" }}>توقيع أمين الخزينة / المستلم</p>
                <div style={{ borderTop: "1px solid #94A3B8" }} />
                <p className="text-[11px] font-semibold mt-1" style={{ color: "#94A3B8" }}>الاسم والتاريخ</p>
              </div>
            </div>
          </div>
        )}
        </>)}
      </main>

      {/* Employee side panel */}
      {selectedEmp && (() => {
        const rows = RAW_DATA.filter((r) => r.employee === selectedEmp);
        const total = rows.reduce((s, r) => s + r.total, 0);
        const avg = rows.length ? total / rows.length : 0;
        const last = rows[rows.length - 1];
        const empTrend = rows.map((r) => ({ hour: fmtTime(r.timestamp), total: r.total }));
        const initials = selectedEmp.split(" ").map((w) => w[0]).slice(0, 2).join("");
        return (
          <div className="fixed inset-0 z-30 flex justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedEmp(null)} />
            <div className="relative w-full max-w-sm h-full p-5 overflow-y-auto fade-up" style={{ background: dark ? PALETTE.bgDark : "#fff", borderLeft: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}` }}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-sm shrink-0" style={{ background: `linear-gradient(135deg, ${PALETTE.primary}, ${PALETTE.purple})`, color: "#fff" }}>{initials}</div>
                  <div>
                    <h3 className="text-base font-extrabold" style={{ color: text }}>{selectedEmp}</h3>
                    <p className="text-[11px] font-semibold" style={{ color: sub }}>{EMP_BRANCH[selectedEmp]}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedEmp(null)} className="p-1.5 rounded-lg" style={{ background: dark ? "#131C30" : "#F1F4FA" }}><X size={16} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2.5 mb-6">
                {[
                  { label: "إجمالي المبيعات", value: `${fmt(total)} SAR`, accent: PALETTE.primary },
                  { label: "عدد التقارير", value: fmt(rows.length), accent: PALETTE.success },
                  { label: "متوسط المبيعات", value: `${fmt(avg)} SAR`, accent: PALETTE.gold },
                  { label: "آخر تقرير", value: last ? fmtTime(last.timestamp) : "—", accent: PALETTE.purple },
                ].map((s, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: dark ? "rgba(255,255,255,0.03)" : "#F7F9FC", borderTop: `2px solid ${s.accent}` }}>
                    <div className="text-[10px] font-bold mb-1" style={{ color: sub }}>{s.label}</div>
                    <div className="text-sm font-extrabold" style={{ color: text }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <h4 className="text-xs font-extrabold mb-2" style={{ color: sub }}>الرسم البياني الخاص به</h4>
              <div style={{ direction: "ltr" }}>
<ResponsiveContainer width="100%" height={180}>
                <AreaChart data={empTrend}>
                  <defs>
                    <linearGradient id="empFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PALETTE.primary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={PALETTE.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hour" tick={{ fill: sub, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: sub, fontSize: 10 }} axisLine={false} tickLine={false} width={36} tickFormatter={fmt} />
                  <Tooltip content={<ChartTooltip dark={dark} />} />
                  <Area type="monotone" dataKey="total" name="المبيعات" stroke={PALETTE.primary} strokeWidth={2.25} fill="url(#empFill)" dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
</div>
            </div>
          </div>
        );
      })()}

      {/* Google Sheet connection settings */}
      {showSettings && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSettings(false)} />
          <div className="relative w-full max-w-md rounded-2xl p-5 fade-up" style={{ background: dark ? "#0F1728" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}` }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold flex items-center gap-2" style={{ color: text }}>
                <Link2 size={16} style={{ color: PALETTE.primary }} /> ربط Apps Script Web App
              </h3>
              <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg" style={{ background: dark ? "#131C30" : "#F1F4FA" }}><X size={16} /></button>
            </div>

            <label className="block text-xs font-bold mb-1.5" style={{ color: sub }}>رابط الـ Web App</label>
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://script.google.com/macros/s/xxxxx/exec"
              className="w-full text-sm rounded-xl py-2.5 px-3 outline-none font-semibold mb-3"
              style={{ background: dark ? "#131C30" : "#F1F4FA", color: text, border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`, direction: "ltr" }}
            />

            <label className="block text-xs font-bold mb-1.5" style={{ color: sub }}>اسم الصفحة (Sheet tab) — اختياري</label>
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="مثال: Form Responses 1"
              className="w-full text-sm rounded-xl py-2.5 px-3 outline-none font-semibold mb-4"
              style={{ background: dark ? "#131C30" : "#F1F4FA", color: text, border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}` }}
            />

            <label className="block text-xs font-bold mb-1.5" style={{ color: sub }}>اسم المنشأة — يظهر في تقرير الجرد</label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="مثال: مؤسسة الإدارة المركزية"
              className="w-full text-sm rounded-xl py-2.5 px-3 outline-none font-semibold mb-4"
              style={{ background: dark ? "#131C30" : "#F1F4FA", color: text, border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}` }}
            />

            <div className="rounded-xl px-3.5 py-3 mb-4 text-xs leading-relaxed font-semibold" style={{ background: dark ? "rgba(54,84,244,0.10)" : "rgba(54,84,244,0.06)", color: sub }}>
              الشيت نفسه بيفضل خاص، ده رابط سكريبت صغير بيرجّع البيانات بس. لو مش عامل السكريبت لسه، قولّي وأديك خطوات إنشاءه.
            </div>

            {error && <p className="text-xs font-bold mb-3" style={{ color: PALETTE.danger }}>{error}</p>}

            <div className="flex gap-2">
              <button onClick={saveSettings} className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl text-white" style={{ background: PALETTE.primary }}>
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />} حفظ واتصال
              </button>
              <button onClick={() => setShowSettings(false)} className="px-4 py-2.5 rounded-xl text-sm font-bold" style={{ background: dark ? "#131C30" : "#F1F4FA", color: text }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}