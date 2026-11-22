"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./dashboard.module.css";

type TenantOption = { id: string; name: string; slug: string; role: string };
type TenantPayload = { tenant?: TenantOption | null; tenants?: TenantOption[]; error?: string };
type ModuleId = "overview" | "organization" | "directory" | "people" | "documents" | "finance" | "assets" | "communications" | "requests" | "reports" | "security" | "settings" | "support";
type ModuleItem = { id: ModuleId; icon: string; title: string; description: string };

const TENANT_KEY = "metatya-sports-os-active-tenant";
const groups: { title: string; items: ModuleItem[] }[] = [
  { title: "نمای کلی", items: [{ id: "overview", icon: "⌂", title: "داشبورد اصلی", description: "نمای یکپارچه فضای کاری" }] },
  { title: "مدیریت سازمان", items: [
    { id: "organization", icon: "▦", title: "ساختار سازمانی", description: "واحدها، مسئولیت‌ها و ساختار سازمان" },
    { id: "directory", icon: "▤", title: "اطلاعات پایه", description: "اطلاعات مرجع و مشخصات سازمان" },
    { id: "people", icon: "♙", title: "منابع انسانی", description: "اطلاعات عمومی و پرونده‌های پرسنلی" },
  ]},
  { title: "امور اداری", items: [
    { id: "documents", icon: "▧", title: "اسناد و مکاتبات", description: "دبیرخانه و بایگانی اسناد" },
    { id: "communications", icon: "✉", title: "اطلاعیه‌ها", description: "اطلاع‌رسانی و ارتباطات سازمانی" },
    { id: "requests", icon: "◷", title: "درخواست‌ها", description: "پیگیری درخواست‌های اداری عمومی" },
  ]},
  { title: "منابع و گزارش‌ها", items: [
    { id: "finance", icon: "◈", title: "امور مالی", description: "اسناد و گزارش‌های مالی سازمان" },
    { id: "assets", icon: "▣", title: "اموال و دارایی‌ها", description: "فهرست دارایی‌ها و اموال سازمان" },
    { id: "reports", icon: "▥", title: "گزارش‌های مدیریتی", description: "گزارش‌ها و شاخص‌های سازمانی" },
  ]},
  { title: "مدیریت سامانه", items: [
    { id: "security", icon: "⬡", title: "کاربران و دسترسی‌ها", description: "حساب‌ها، نقش‌ها و مجوزها" },
    { id: "settings", icon: "⚙", title: "تنظیمات", description: "تنظیمات فضای کاری و سامانه" },
    { id: "support", icon: "?", title: "پشتیبانی", description: "راهنما و پیگیری مشکلات سامانه" },
  ]},
];
const allModules = groups.flatMap((group) => group.items);

function readTenantId() {
  try { return window.sessionStorage.getItem(TENANT_KEY) ?? ""; } catch { return ""; }
}
function saveTenantId(id: string | null) {
  try {
    if (id) window.sessionStorage.setItem(TENANT_KEY, id);
    else window.sessionStorage.removeItem(TENANT_KEY);
  } catch { /* Server authorization remains authoritative. */ }
}
function roleTitle(role: string) {
  if (role === "owner" || role === "admin") return "مدیر سازمان";
  if (role === "referee") return "کاربر سازمانی";
  if (role === "coach") return "همکار سازمان";
  if (role === "staff") return "کارمند سازمان";
  return "عضو سازمان";
}

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [active, setActive] = useState<ModuleId>("overview");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const activeModule = allModules.find((item) => item.id === active);
  const filteredGroups = useMemo(() => groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.title.includes(query.trim()) || item.description.includes(query.trim())),
  })).filter((group) => group.items.length > 0), [query]);

  useEffect(() => {
    let mounted = true;
    async function initialize() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) { router.replace("/login"); return; }
        if (mounted) setEmail(data.user.email ?? "");
        const response = await fetch("/api/core-sports/tenant", { cache: "no-store" });
        const payload = (await response.json()) as TenantPayload;
        if (response.status === 401) { router.replace("/login"); return; }
        if (!response.ok) throw new Error(payload.error || "دریافت اطلاعات سازمان ناموفق بود.");
        const options = payload.tenants ?? (payload.tenant ? [payload.tenant] : []);
        if (!mounted) return;
        setTenantOptions(options);
        if (!options.length) { saveTenantId(null); setMessage("برای این حساب، عضویت سازمانی فعالی پیدا نشد."); return; }
        const stored = readTenantId();
        const selected = options.length === 1 ? options[0] : options.find((item) => item.id === stored);
        if (!selected) { setMessage("برای ادامه، فضای سازمانی مجاز را انتخاب کنید."); return; }
        saveTenantId(selected.id);
        setTenantId(selected.id);
        setTenantName(selected.name);
        setRole(selected.role);
      } catch (error) {
        if (mounted) setMessage(error instanceof Error ? error.message : "ارتباط با سرویس برقرار نشد.");
      } finally {
        if (mounted) setReady(true);
      }
    }
    void initialize();
    return () => { mounted = false; };
  }, [router]);

  function changeTenant(id: string) {
    const selected = tenantOptions.find((item) => item.id === id);
    if (!selected) return;
    setBusy(true);
    saveTenantId(id);
    setTenantId(id);
    setTenantName(selected.name);
    setRole(selected.role);
    setActive("overview");
    setMessage("فضای سازمانی فعال تغییر کرد.");
    setBusy(false);
  }
  async function signOut() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("خروج از حساب انجام نشد.");
      saveTenantId(null);
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "خروج از حساب ناموفق بود.");
    } finally { setBusy(false); }
  }
  function selectModule(id: ModuleId) { setActive(id); setQuery(""); setMessage(""); }

  if (!ready) return <main className={styles.loadingPage} dir="rtl"><div className={styles.brandMark}>M</div><p>در حال بررسی هویت و دسترسی سازمانی...</p></main>;

  return (
    <div className={styles.app} dir="rtl">
      <aside className={styles.sidebar}>
        <div className={styles.brand}><div className={styles.brandMark}>M</div><div><strong>METATYA</strong><span>SPORTS OS</span></div></div>
        <div className={styles.workspaceLabel}>فضای کاری فعال</div>
        <div className={styles.workspaceCard}><span className={styles.workspaceIcon}>OS</span><span className={styles.workspaceText}><b>{tenantName || "سازمان انتخاب نشده"}</b><small>محیط مدیریت سازمانی</small></span><span className={styles.workspaceChevron}>⌄</span></div>
        <label className={styles.searchBox}><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی بخش‌ها..." aria-label="جست‌وجوی بخش‌های داشبورد" /><kbd>/</kbd></label>
        <nav className={styles.navigation} aria-label="منوی اصلی">
          {filteredGroups.map((group) => <div className={styles.navGroup} key={group.title}>
            <div className={styles.navGroupTitle}>{group.title}</div>
            {group.items.map((item) => <button key={item.id} type="button" className={[styles.navItem, active === item.id ? styles.navItemActive : ""].join(" ")} onClick={() => selectModule(item.id)}>
              <span className={styles.navIcon}>{item.icon}</span><span>{item.title}</span>{active === item.id && <i className={styles.activeIndicator} />}
            </button>)}
          </div>)}
          {filteredGroups.length === 0 && <p className={styles.noResults}>بخشی با این عنوان پیدا نشد.</p>}
        </nav>
        <div className={styles.sidebarBottom}><div className={styles.secureSession}><span className={styles.onlineDot} /><span>نشست احراز هویت‌شده</span></div><small>دسترسی‌ها در سمت سرور کنترل می‌شوند</small><div className={styles.sidebarVersion}>METATYA · MANAGEMENT CONSOLE</div></div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}><span>METATYA</span><b>/</b><span>SPORTS OS</span><b>/</b><strong>{active === "overview" ? "داشبورد اصلی" : activeModule?.title}</strong></div>
          <div className={styles.topbarActions}>
            {tenantOptions.length > 1 && <label className={styles.tenantSelectWrap}><span>سازمان فعال</span><select aria-label="انتخاب سازمان فعال" value={tenantId} disabled={busy} onChange={(event) => changeTenant(event.target.value)}>{tenantOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
            <div className={styles.userChip}><span className={styles.userAvatar}>{(email || "M").slice(0, 1).toUpperCase()}</span><span className={styles.userDetails}><b>{roleTitle(role)}</b><small>{email || "حساب احراز هویت‌شده"}</small></span></div>
            <button type="button" className={styles.logoutButton} disabled={busy} onClick={() => void signOut()}>خروج امن</button>
          </div>
        </header>

        <section className={styles.content}>
          {message && <div className={styles.notice} role="status" aria-live="polite"><span>ⓘ</span>{message}{tenantOptions.length > 1 && !tenantId && <select aria-label="انتخاب فضای سازمانی" value={tenantId} onChange={(event) => changeTenant(event.target.value)}><option value="">انتخاب سازمان</option>{tenantOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</div>}
          {active === "overview"
            ? <Overview tenantOptions={tenantOptions} tenantId={tenantId} tenantName={tenantName} role={role} onSelect={selectModule} />
            : <ModulePage item={activeModule} tenantOptions={tenantOptions} tenantId={tenantId} tenantName={tenantName} role={role} onSelect={selectModule} />}
          <footer className={styles.footer}><span>METATYA SPORTS OS</span><i /><span>سامانه مدیریت سازمانی</span><i /><span>محیط امن و چندسازمانی</span></footer>
        </section>
      </main>
    </div>
  );
}

function Overview({ tenantOptions, tenantId, tenantName, role, onSelect }: {
  tenantOptions: TenantOption[]; tenantId: string; tenantName: string; role: string; onSelect: (id: ModuleId) => void;
}) {
  const metrics = [
    { label: "سازمان‌های در دسترس", value: String(tenantOptions.length), note: "بر اساس عضویت‌های فعال حساب", icon: "▦" },
    { label: "فضای سازمانی فعال", value: tenantName || "—", note: tenantId ? "از فهرست مجاز حساب انتخاب شده" : "نیازمند انتخاب سازمان", icon: "⌂", compact: true },
    { label: "سطح دسترسی", value: roleTitle(role), note: "بر اساس نقش ثبت‌شده عضویت", icon: "⬡", compact: true },
    { label: "وضعیت نشست", value: "تأییدشده", note: "هویت کاربر توسط سرویس احراز شده", icon: "✓" },
  ];
  const quickLinks = allModules.filter((item) => ["organization", "people", "documents", "communications", "reports", "security"].includes(item.id));
  return <>
    <div className={styles.pageHeading}><div><div className={styles.eyebrow}>MANAGEMENT OVERVIEW</div><h1>داشبورد مدیریتی</h1><p>نمای یکپارچه فضای کاری، دسترسی‌ها و وضعیت سامانه</p></div><div className={styles.headingMeta}><span className={styles.liveDot} /> اتصال هویت فعال</div></div>
    <section className={styles.metricGrid} aria-label="خلاصه وضعیت حساب">
      {metrics.map((metric) => <article className={styles.metricCard} key={metric.label}><div className={styles.metricTop}><span>{metric.label}</span><i>{metric.icon}</i></div><strong className={metric.compact ? styles.metricCompact : ""}>{metric.value}</strong><small>{metric.note}</small></article>)}
    </section>
    <div className={styles.dashboardGrid}>
      <section className={styles.panel}><div className={styles.panelHeading}><div><h2>دسترسی سریع</h2><p>بخش‌های اصلی مدیریت سازمان</p></div><span className={styles.panelTag}>۶ بخش</span></div>
        <div className={styles.quickGrid}>{quickLinks.map((item) => <button type="button" className={styles.quickCard} key={item.id} onClick={() => onSelect(item.id)}><span className={styles.quickIcon}>{item.icon}</span><span className={styles.quickText}><b>{item.title}</b><small>{item.description}</small></span><span className={styles.quickArrow}>←</span></button>)}</div>
      </section>
      <div className={styles.sidePanels}>
        <section className={styles.panel}><div className={styles.panelHeading}><div><h2>وضعیت امنیت و دسترسی</h2><p>اطلاعات نشست جاری</p></div><span className={styles.shieldIcon}>⬡</span></div>
          <StatusRow title="احراز هویت" detail="کاربر توسط سرویس هویت تأیید شده" status="تأییدشده" />
          <StatusRow title="عضویت سازمانی" detail="فهرست عضویت‌ها از سرور دریافت شده" status="بررسی‌شده" />
          <StatusRow title="محدوده داده" detail="انتخاب سازمان محدود به عضویت مجاز است" status="محدودشده" />
        </section>
        <section className={styles.infoCard}><span className={styles.infoSymbol}>✦</span><div><b>اطلاعات واقعی، بدون آمار ساختگی</b><p>شاخص‌های این صفحه فقط از اطلاعات تأییدشده حساب و عضویت خوانده می‌شوند. آمار سایر بخش‌ها پس از اتصال منبع داده و مجوزهای مربوط نمایش داده خواهد شد.</p></div></section>
      </div>
    </div>
    <section className={styles.panel}><div className={styles.panelHeading}><div><h2>فعالیت‌های اخیر</h2><p>رویدادهای مدیریتی ثبت‌شده در فضای سازمانی</p></div><span className={styles.panelTag}>گزارش زنده</span></div><div className={styles.emptyState}><span className={styles.emptyIcon}>◷</span><b>هنوز گزارشی برای نمایش وجود ندارد</b><small>سرویس گزارش فعالیت هنوز به داشبورد متصل نشده است؛ بنابراین هیچ رویداد نمونه‌ای نمایش داده نمی‌شود.</small></div></section>
  </>;
}

function StatusRow({ title, detail, status }: { title: string; detail: string; status: string }) {
  return <div className={styles.statusRow}><span className={styles.statusCheck}>✓</span><span className={styles.statusText}><b>{title}</b><small>{detail}</small></span><span className={styles.statusLabel}>{status}</span></div>;
}

function ModulePage({ item, tenantOptions, tenantId, tenantName, role, onSelect }: {
  item?: ModuleItem; tenantOptions: TenantOption[]; tenantId: string; tenantName: string; role: string; onSelect: (id: ModuleId) => void;
}) {
  if (!item) return null;
  if (item.id === "organization") return <>
    <ModuleHeading item={item} />
    <section className={styles.panel}><div className={styles.panelHeading}><div><h2>سازمان‌های قابل دسترس</h2><p>فهرست از عضویت‌های فعال حساب دریافت شده است.</p></div><span className={styles.panelTag}>{tenantOptions.length} سازمان</span></div>
      {tenantOptions.length ? <div className={styles.organizationList}>{tenantOptions.map((tenant) => <div className={styles.organizationRow} key={tenant.id}><span className={styles.organizationIcon}>OS</span><span className={styles.organizationInfo}><b>{tenant.name}</b><small>{tenant.slug}</small></span><span className={styles.organizationRole}>{roleTitle(tenant.role)}</span>{tenant.id === tenantId ? <span className={styles.activeOrganization}>فعال</span> : <span className={styles.inactiveOrganization}>عضویت مجاز</span>}</div>)}</div> : <div className={styles.emptyState}>سازمان فعالی برای این حساب یافت نشد.</div>}
      <p className={styles.moduleFootnote}>این صفحه فهرست عضویت‌های تأییدشده را نشان می‌دهد. تغییر ساختار یا عضویت سازمانی تا زمان آماده‌شدن گردش‌کار مدیریتی فعال نیست.</p>
    </section>
  </>;
  if (item.id === "security") return <>
    <ModuleHeading item={item} />
    <section className={styles.panel}><div className={styles.panelHeading}><div><h2>وضعیت دسترسی حساب جاری</h2><p>اطلاعات خوانده‌شده از نشست و عضویت تأییدشده</p></div><span className={styles.panelTag}>کنترل دسترسی</span></div>
      <div className={styles.securityGrid}><div><small>نقش فعلی</small><b>{roleTitle(role)}</b></div><div><small>سازمان فعال</small><b>{tenantName || "انتخاب نشده"}</b></div><div><small>عضویت‌های در دسترس</small><b>{tenantOptions.length}</b></div><div><small>محدوده نشست</small><b>{tenantId ? "سازمان انتخاب‌شده" : "بدون سازمان فعال"}</b></div></div>
      <p className={styles.moduleFootnote}>این بخش وضعیت فعلی را نمایش می‌دهد. مدیریت حساب‌ها و تغییر نقش‌ها تا زمان آماده‌شدن مسیر امن مدیریتی در حالت مشاهده باقی می‌ماند.</p>
    </section>
  </>;
  return <>
    <ModuleHeading item={item} />
    <section className={styles.panel}>
      <div className={styles.moduleWelcome}><span className={styles.moduleLargeIcon}>{item.icon}</span><div><h2>فضای {item.title}</h2><p>{item.description}</p></div></div>
      <div className={styles.moduleStatus}><div className={styles.moduleStatusHeader}><span className={styles.statusPulse} /> وضعیت آماده‌سازی</div><h3>قالب مدیریتی این بخش آماده است</h3><p>برای نمایش یا ویرایش اطلاعات واقعی، باید منبع داده، مجوزهای نقش‌محور، اعتبارسنجی سمت سرور و آزمون‌های دسترسی این بخش تکمیل شوند. در حال حاضر داده آزمایشی یا عملیات غیرمتصل نمایش داده نمی‌شود.</p>
        <div className={styles.progressSteps}><div className={styles.stepDone}><span>✓</span><b>طراحی رابط و مسیر دسترسی</b></div><div className={styles.stepPending}><span>۲</span><b>اتصال منبع داده معتبر</b></div><div className={styles.stepPending}><span>۳</span><b>اعمال مجوزها و آزمون امنیتی</b></div></div>
      </div>
      <button type="button" className={styles.backToOverview} onClick={() => onSelect("overview")}>بازگشت به داشبورد اصلی <span>←</span></button>
    </section>
  </>;
}
function ModuleHeading({ item }: { item: ModuleItem }) {
  return <div className={styles.pageHeading}><div><div className={styles.eyebrow}>ORGANIZATION MANAGEMENT</div><h1>{item.title}</h1><p>{item.description}</p></div><span className={styles.headingMeta}>فضای کاری سازمانی</span></div>;
}
