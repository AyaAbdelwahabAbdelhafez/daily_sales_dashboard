import React, { useState, useMemo, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import {
  Search, Sun, Moon, X, TrendingUp, Users, FileText, Wallet,
  Banknote, CreditCard, Layers, RefreshCw, ChevronDown, ChevronUp,
  ArrowUpDown, Printer, Download, MapPin, Award, SlidersHorizontal,
  Radio, Crown, Medal, BarChart3, Clock, ShieldCheck,
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
   Mock data generator — stands in for the Google Sheets feed.
   In production this is replaced by a fetch() to a Google Apps Script
   Web App URL that reads the linked Sheet (see note at bottom of page).
--------------------------------------------------------------------- */
const BRANCHES = ["فرع الدمام", "فرع المنيزلة", "فرع النزهة"];
const EMPLOYEES = ["محمد عبده", "رامز قصي", "طاهر علي", "مهند محمد"];
const EMP_BRANCH = { "محمد عبده": "فرع الدمام", "رامز قصي": "فرع الدمام", "طاهر علي": "فرع المنيزلة", "مهند محمد": "فرع النزهة" };

function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generateData() {
  const rand = seededRand(42);
  const rows = [];
  const today = new Date();
  let id = 1;
  for (let h = 8; h <= 20; h++) {
    EMPLOYEES.forEach((emp) => {
      if (rand() > 0.35) return;
      const cash = Math.round(rand() * 2500 + 200);
      const wallet = Math.round(rand() * 1800 + 100);
      const bank = Math.round(rand() * 1400 + 50);
      const other = Math.round(rand() * 400);
      const ts = new Date(today);
      ts.setHours(h, Math.round(rand() * 59), 0, 0);
      rows.push({
        id: id++,
        timestamp: ts,
        employee: emp,
        branch: EMP_BRANCH[emp],
        custody: Math.round(rand() * 5000 + 1000),
        cash, wallet, bank, other,
        total: cash + wallet + bank + other,
        notes: rand() > 0.85 ? "تحويل عهدة إضافية" : "",
      });
    });
  }
  return rows.sort((a, b) => a.timestamp - b.timestamp);
}

const RAW_DATA = generateData();

const fmt = (n) => new Intl.NumberFormat("ar-EG").format(Math.round(n));
const fmtTime = (d) => d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (d) => d.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

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

function ChartTooltip({ active, payload, label, dark, unit = "ر.س" }) {
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

function KpiCard({ icon: Icon, label, value, accent, suffix, dark, percent, spark, big }) {
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
      <span className="absolute top-0 bottom-0" style={{ insetInlineStart: 0, width: 3, background: accent }} />
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 38, height: 38, background: `${accent}18`, color: accent }}>
          <Icon size={18} strokeWidth={2.3} />
        </div>
        {typeof percent === "number" && (
          <span className="text-[10px] font-extrabold px-2 py-1 rounded-full" style={{ background: `${accent}16`, color: accent }}>
            {percent}٪ من الإجمالي
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
        className="appearance-none text-sm font-semibold rounded-xl pl-8 pr-3.5 py-2.5 outline-none cursor-pointer transition-colors"
        style={{
          background: dark ? "#131C30" : "#F1F4FA",
          color: dark ? "#E2E8F0" : "#1E293B",
          border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
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
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [branchFilter, setBranchFilter] = useState("");
  const [empFilter, setEmpFilter] = useState("");
  const [payFilter, setPayFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("timestamp");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const pageSize = 8;

  const lastUpdate = useMemo(() => new Date(Math.max(...RAW_DATA.map((r) => r.timestamp))), []);

  const filtered = useMemo(() => {
    let rows = RAW_DATA;
    if (branchFilter) rows = rows.filter((r) => r.branch === branchFilter);
    if (empFilter) rows = rows.filter((r) => r.employee === empFilter);
    if (payFilter) rows = rows.filter((r) => r[payFilter] > 0);
    if (search.trim()) {
      const q = search.trim();
      rows = rows.filter((r) => r.employee.includes(q) || r.branch.includes(q) || r.notes.includes(q));
    }
    return rows;
  }, [branchFilter, empFilter, payFilter, search]);

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
    const reports = filtered.length;
    const activeEmployees = new Set(filtered.map((r) => r.employee)).size;
    const avgPerEmp = activeEmployees ? totalSales / activeEmployees : 0;
    return { totalSales, totalCash, totalWallet, totalBank, totalOther, reports, activeEmployees, avgPerEmp };
  }, [filtered]);

  const byBranch = useMemo(() => BRANCHES.map((b) => ({
    name: b, total: filtered.filter((r) => r.branch === b).reduce((s, r) => s + r.total, 0),
  })), [filtered]);

  const byEmployee = useMemo(() => EMPLOYEES.map((e) => ({
    name: e, total: filtered.filter((r) => r.employee === e).reduce((s, r) => s + r.total, 0),
  })).sort((a, b) => b.total - a.total), [filtered]);

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
  const bestBranch = [...byBranch].sort((a, b) => b.total - a.total)[0];

  const resetFilters = () => { setBranchFilter(""); setEmpFilter(""); setPayFilter(""); setSearch(""); setPage(1); };

  const toggleSort = useCallback((key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }, [sortKey]);

  const exportCsv = () => {
    const headers = ["التاريخ", "الموظف", "الفرع", "العهدة", "الكاش", "المحفظة", "التحويل", "أخرى", "الإجمالي", "الملاحظات"];
    const lines = sorted.map((r) => [fmtTime(r.timestamp), r.employee, r.branch, r.custody, r.cash, r.wallet, r.bank, r.other, r.total, r.notes].join(","));
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "daily_sales_report.csv"; a.click();
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
      `}</style>

      {/* Header */}
      <header
        className="sticky top-0 z-20 backdrop-blur-md px-4 md:px-8 pt-4 pb-3.5"
        style={{ background: dark ? "rgba(8,12,22,0.88)" : "rgba(244,246,251,0.88)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}` }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${PALETTE.primary}, ${PALETTE.purple})`, boxShadow: "0 6px 18px rgba(54,84,244,0.35)" }}
            >
              <BarChart3 size={22} color="#fff" strokeWidth={2.4} />
            </div>
            <div>
              <h1 className="display text-lg md:text-xl font-extrabold" style={{ color: dark ? "#F3F6FB" : "#0F172A" }}>لوحة المبيعات اليومية</h1>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: sub }}>
                <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: PALETTE.success }} />
                مباشر · {fmtDate(lastUpdate)} · آخر تحديث {fmtTime(lastUpdate)}
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
      <div className="sm:hidden flex gap-1.5 px-4 pt-3">
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setTab(n.id)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold px-2 py-2.5 rounded-xl"
            style={{ background: tab === n.id ? PALETTE.primary : (dark ? "rgba(19,27,46,0.7)" : "#EDF0F8"), color: tab === n.id ? "#fff" : sub }}>
            <n.icon size={14} /> {n.label}
          </button>
        ))}
      </div>

      <main className="px-4 md:px-8 py-6 max-w-[1400px] mx-auto">
        {tab === "dashboard" && (
          <>
            {/* Filters */}
            <div className="fade-up flex flex-wrap items-center gap-2 mb-6">
              <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: dark ? "rgba(19,27,46,0.7)" : "#EDF0F8", color: sub }}>
                <SlidersHorizontal size={15} />
              </div>
              <Select value={branchFilter} onChange={(v) => { setBranchFilter(v); setPage(1); }} options={BRANCHES} placeholder="كل الفروع" dark={dark} />
              <Select value={empFilter} onChange={(v) => { setEmpFilter(v); setPage(1); }} options={EMPLOYEES} placeholder="كل الموظفين" dark={dark} />
              <Select value={payFilter} onChange={(v) => { setPayFilter(v); setPage(1); }} options={["cash", "wallet", "bank", "other"]} placeholder="طريقة الدفع" dark={dark} />
              <button onClick={resetFilters} className="flex items-center gap-1.5 text-sm font-bold px-3.5 py-2.5 rounded-xl transition-colors" style={{ color: PALETTE.danger, background: `${PALETTE.danger}12` }}>
                <RefreshCw size={13} /> إعادة تعيين
              </button>
            </div>

            {/* KPIs */}
            <div className="fade-up grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <KpiCard dark={dark} big icon={TrendingUp} label="إجمالي المبيعات" value={fmt(kpis.totalSales)} suffix="ر.س" accent={PALETTE.primary} spark={trend.map((t) => t.total)} />
              <KpiCard dark={dark} icon={FileText} label="عدد التقارير" value={fmt(kpis.reports)} accent={PALETTE.primarySoft} />
              <KpiCard dark={dark} icon={Users} label="موظفون أرسلوا اليوم" value={`${kpis.activeEmployees}/${EMPLOYEES.length}`} accent={PALETTE.success} />
              <KpiCard dark={dark} icon={Award} label="متوسط المبيعات للموظف" value={fmt(kpis.avgPerEmp)} suffix="ر.س" accent={PALETTE.gold} />
              <KpiCard dark={dark} icon={Banknote} label="إجمالي الكاش" value={fmt(kpis.totalCash)} suffix="ر.س" accent={PAY_COLORS.cash} percent={pct(kpis.totalCash)} />
              <KpiCard dark={dark} icon={Wallet} label="إجمالي المحافظ" value={fmt(kpis.totalWallet)} suffix="ر.س" accent={PAY_COLORS.wallet} percent={pct(kpis.totalWallet)} />
              <KpiCard dark={dark} icon={CreditCard} label="التحويلات البنكية" value={fmt(kpis.totalBank)} suffix="ر.س" accent={PAY_COLORS.bank} percent={pct(kpis.totalBank)} />
              <KpiCard dark={dark} icon={Layers} label="وسائل أخرى" value={fmt(kpis.totalOther)} suffix="ر.س" accent={PAY_COLORS.other} percent={pct(kpis.totalOther)} />
            </div>

            {/* Charts row 1 */}
            <div className="fade-up grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <Panel dark={dark} title="إجمالي المبيعات حسب الفرع" subtitle="مقارنة الأداء بين الفروع الثلاثة">
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
              </Panel>

              <Panel dark={dark} title="توزيع طرق الدفع" subtitle="نسبة كل وسيلة من إجمالي المبيعات">
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0" style={{ width: 190, height: 190 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={payMethods} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3} strokeWidth={0}>
                          {payMethods.map((p, i) => <Cell key={i} fill={p.color} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip dark={dark} />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-bold" style={{ color: sub }}>الإجمالي</span>
                      <span className="text-base font-extrabold" style={{ color: text, fontFamily: "'Cairo',sans-serif" }}>{fmt(kpis.totalSales)}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2.5">
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
            <div className="fade-up grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Employee Comparison - Made clearer with larger bars and bolder colors */}
              <Panel dark={dark} title="مقارنة الموظفين" subtitle="ترتيب حسب إجمالي المبيعات" className="lg:col-span-1">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byEmployee} layout="vertical" margin={{ left: 4, right: 28 }} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 6" stroke={dark ? "#1B2436" : "#E9ECF3"} horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fill: text, fontSize: 13, fontWeight: 700 }} axisLine={false} tickLine={false} width={82} />
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
                      <LabelList dataKey="total" position="right" formatter={fmt} style={{ fill: sub, fontSize: 12, fontWeight: 800 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Panel>

              {/* Sales Trend - Made clearer with larger area and more prominent grid */}
              <Panel
                dark={dark} title="تطور المبيعات خلال اليوم"
                subtitle={peakHour ? `الذروة الساعة ${peakHour.hour} بقيمة ${fmt(peakHour.total)} ر.س` : ""}
                className="lg:col-span-2"
              >
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
              </Panel>
            </div>

            {/* Table */}
            <Panel dark={dark} title={null} className="fade-up">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-[13px] font-extrabold flex items-center gap-2" style={{ color: dark ? "#E7ECF5" : "#0F172A", fontFamily: "'Cairo',sans-serif" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: PALETTE.primary, display: "inline-block" }} />
                  سجل التقارير
                </h3>
                <div className="flex items-center gap-2">
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

              <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${dark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.05)"}` }}>
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr style={{ background: dark ? "rgba(255,255,255,0.03)" : "#F7F9FC", borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}` }}>
                      {[
                        ["timestamp", "الوقت"], ["employee", "الموظف"], ["branch", "الفرع"], ["custody", "العهدة"],
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
                      <tr><td colSpan={10} className="text-center py-8" style={{ color: sub }}>لا توجد بيانات مطابقة للفلاتر الحالية</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-4 text-xs font-semibold" style={{ color: sub }}>
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
                      <div className="flex justify-between text-sm"><span style={{ color: sub }}>إجمالي المبيعات</span><span className="font-extrabold" style={{ color: text }}>{fmt(total)} ر.س</span></div>
                      <div className="flex justify-between text-sm"><span style={{ color: sub }}>عدد الموظفين</span><span className="font-extrabold" style={{ color: text }}>{emps.size}</span></div>
                      <div className="flex justify-between text-sm"><span style={{ color: sub }}>متوسط المبيعات</span><span className="font-extrabold" style={{ color: text }}>{fmt(avg)} ر.س</span></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm rounded-xl px-3.5 py-2.5" style={{ background: dark ? "rgba(255,255,255,0.03)" : "#F7F9FC" }}>
                    <span className="flex items-center gap-1.5 font-bold" style={{ color: sub }}><ShieldCheck size={14} /> أفضل موظف</span>
                    <span className="font-extrabold" style={{ color: text }}>{empTotals[0]?.e || "—"}</span>
                  </div>
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
                  { icon: Crown, label: "أفضل موظف اليوم", value: `${bestEmployee?.name || "—"} — ${fmt(bestEmployee?.total || 0)} ر.س`, color: PALETTE.gold },
                  { icon: MapPin, label: "أفضل فرع", value: `${bestBranch?.name || "—"} — ${fmt(bestBranch?.total || 0)} ر.س`, color: PALETTE.primary },
                  { icon: Banknote, label: "أعلى طريقة دفع", value: [...payMethods].sort((a, b) => b.value - a.value)[0]?.name, color: PALETTE.success },
                  { icon: CreditCard, label: "أقل طريقة دفع", value: [...payMethods].sort((a, b) => a.value - b.value)[0]?.name, color: PALETTE.warning },
                  { icon: Clock, label: "ساعة الذروة", value: peakHour ? `${peakHour.hour} — ${fmt(peakHour.total)} ر.س` : "—", color: PALETTE.purple },
                  { icon: Award, label: "متوسط المبيعات للموظف", value: `${fmt(kpis.avgPerEmp)} ر.س`, color: PALETTE.primarySoft },
                ].map((row, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: i < 5 ? `1px solid ${dark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.05)"}` : "none" }}>
                    <span className="flex items-center gap-2.5 text-sm font-bold" style={{ color: sub }}>
                      <span className="flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, background: `${row.color}18`, color: row.color }}>
                        <row.icon size={14} />
                      </span>
                      {row.label}
                    </span>
                    <span className="text-sm font-extrabold text-left" style={{ color: text }}>{row.value}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel dark={dark} title="نسبة مساهمة كل فرع" subtitle="من إجمالي مبيعات اليوم">
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={byBranch} dataKey="total" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} strokeWidth={0}>
                    {byBranch.map((_, i) => <Cell key={i} fill={[PALETTE.primary, PALETTE.success, PALETTE.gold][i % 3]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip dark={dark} />} />
                </PieChart>
              </ResponsiveContainer>
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
                  { label: "إجمالي المبيعات", value: `${fmt(total)} ر.س`, accent: PALETTE.primary },
                  { label: "عدد التقارير", value: fmt(rows.length), accent: PALETTE.success },
                  { label: "متوسط المبيعات", value: `${fmt(avg)} ر.س`, accent: PALETTE.gold },
                  { label: "آخر تقرير", value: last ? fmtTime(last.timestamp) : "—", accent: PALETTE.purple },
                ].map((s, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: dark ? "rgba(255,255,255,0.03)" : "#F7F9FC", borderTop: `2px solid ${s.accent}` }}>
                    <div className="text-[10px] font-bold mb-1" style={{ color: sub }}>{s.label}</div>
                    <div className="text-sm font-extrabold" style={{ color: text }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <h4 className="text-xs font-extrabold mb-2" style={{ color: sub }}>الرسم البياني الخاص به</h4>
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
        );
      })()}
    </div>
  );
}