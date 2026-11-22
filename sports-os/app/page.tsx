"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./dashboard-preview/dashboard-preview.module.css";

type TenantOption = { id: string; name: string; slug: string; role: string };
type TenantPayload = { tenant?: TenantOption | null; tenants?: TenantOption[]; error?: string };
type ModuleItem = { id: string; icon: string; title: string; description: string };

const TENANT_KEY = "metatya-sports-os-active-tenant";
const modules: ModuleItem[] = [
  { id: "organization", icon: "▣", title: "ساختار سازمانی", description: "واحدها، حوزه‌ها و مسئولیت‌های سازمانی" },
  { id: "directory", icon: "▤", title: "اطلاعات پایه", description: "اطلاعات مرجع و پرونده‌های سازمانی" },
  { id: "people", icon: "♙", title: "منابع انسانی", description: "پرونده پرسنلی و سوابق همکاری" },
  { id: "documents", icon: "▧", title: "اسناد و مکاتبات", description: "دبیرخانه و بایگانی دیجیتال" },
  { id: "finance", icon: "◈", title: "امور مالی", description: "بودجه و گزارش‌های مالی سازمان" },
  { id: "assets", icon: "▦", title: "اموال و دارایی‌ها", description: "دارایی‌ها و موجودی سازمان" },
  { id: "communications", icon: "✉", title: "ارتباطات سازمانی", description: "اطلاعیه‌ها و درخواست‌های داخلی" },
  { id: "reports", icon: "▥", title: "گزارش‌های مدیریتی", description: "گزارش‌ها و تحلیل شاخص‌های سازمانی" },
  { id: "security", icon: "⬡", title: "کاربران و امنیت", description: "حساب‌ها، نقش‌ها و سطح دسترسی" },
  { id: "settings", icon: "⚙", title: "تنظیمات سامانه", description: "پیکربندی و سرویس‌های سامانه" },
];

function readTenantId() {
  try { return window.sessionStorage.getItem(TENANT_KEY) ?? ""; } catch { return ""; }
}
function saveTenantId(id: string | null) {
  try {
    if (id) window.sessionStorage.setItem(TENANT_KEY, id);
    else window.sessionStorage.removeItem(TENANT_KEY);
  } catch { /* session storage is only a convenience; API authorization remains server-side */ }
}
function roleTitle(role: string) {
  if (role === "owner" || role === "admin") return "مدیر سازمان";
  if (role === "referee") return "کاربر سازمانی";
  return "عضو سازمان";
}

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState("overview");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const visibleModules = useMemo(() => modules.filter((item) =>
    item.title.includes(query.trim()) || item.description.includes(query.trim())
  ), [query]);
  const activeModule = modules.find((item) => item.id === active);

  useEffect(() => {
    let mounted = true;
    async function initialize() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          router.replace("/login");
          return;
        }
        const response = await fetch("/api/core-sports/tenant", { cache: "no-store" });
        const payload = (await response.json()) as TenantPayload;
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) throw new Error(payload.error || "دریافت اطلاعات سازمان ناموفق بود.");
        const options = payload.tenants ?? (payload.tenant ? [payload.tenant] : []);
        if (!mounted) return;
        setTenantOptions(options);
        if (!options.length) {
          saveTenantId(null);
          setMessage("برای این حساب، عضویت سازمانی فعالی پیدا نشد.");
          return;
        }
        const stored = readTenantId();
        const selected = options.length === 1 ? options[0] : options.find((item) => item.id === stored);
        if (!selected) {
          setMessage("برای ادامه، سازمان فعال را انتخاب کنید.");
          return;
        }
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
    setMessage("سازمان فعال تغییر کرد. درخواست‌های بعدی با شناسه سازمان انتخاب‌شده ارسال می‌شوند.");
    setBusy(false);
  }

  async function signOut() {
    setBusy(true);
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

  if (!ready) return <main className="shell"><p>در حال بررسی نشست کاربری و دسترسی سازمانی...</p></main>;

  return (
    <div className={styles.app} dir="rtl">
      <aside className={styles.sidebar}>
        <div className={styles.brand}><div className={styles.brandMark}>M</div><div><strong>METATYA</strong><span>SPORTS OS</span></div></div>
        <div className={styles.orgLabel}>فضای کاری فعال</div>
        <div className={styles.orgCard}><span className={styles.orgIcon}>OS</span><span><b>{tenantName || "سازمان انتخاب نشده"}</b><small>پنل مدیریت سازمانی</small></span><span className={styles.chevron}>⌄</span></div>
        <div className={styles.menuCaption}>مدیریت سازمان</div>
        <nav className={styles.nav} aria-label="منوی اصلی">
          <button className={active === "overview" ? styles.navActive : undefined} onClick={() => setActive("overview")}><span className={styles.navIcon}>▦</span><span>نمای مدیریتی</span>{active === "overview" && <i />}</button>
          {visibleModules.map((item) => <button key={item.id} className={active === item.id ? styles.navActive : undefined} onClick={() => setActive(item.id)}><span className={styles.navIcon}>{item.icon}</span><span>{item.title}</span>{active === item.id && <i />}</button>)}
          {visibleModules.length === 0 && <p className={styles.noResults}>موردی پیدا نشد.</p>}
        </nav>
        <div className={styles.sidebarFoot}><span className={styles.onlineDot} /> نشست احراز هویت‌شده<small>دسترسی سازمانی از سرویس سمت سرور بررسی می‌شود</small></div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>METATYA <span>/</span> SPORTS OS <span>/</span> <b>{active === "overview" ? "نمای مدیریتی" : activeModule?.title}</b></div>
          <div className={styles.topActions}>
            {tenantOptions.length > 1 && <select aria-label="انتخاب سازمان فعال" value={tenantId} disabled={busy} onChange={(event) => changeTenant(event.target.value)}>{tenantOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
            <span className={styles.previewPill}>{roleTitle(role)}</span>
            <button className={styles.backButton} disabled={busy} onClick={() => void signOut()}>خروج امن</button>
          </div>
        </header>

        <section className={styles.content}>
          <div className={styles.welcome}>
            <div><div className={styles.eyebrow}>ILAM PROVINCIAL ORGANIZATION</div><h1>{active === "overview" ? "داشبورد مدیریتی" : activeModule?.title}</h1><p>{active === "overview" ? "نمای یکپارچه مدیریت، نظارت و راهبری سازمان" : activeModule?.description}</p></div>
            <div className={styles.dateChip}><span>◈</span> {tenantName || "فضای سازمانی"} · محیط اصلی</div>
          </div>

          {message && <p className="status" role="status" aria-live="polite">{message}</p>}
          {!tenantId && tenantOptions.length > 1 && <section className={styles.panel}><div className={styles.panelHead}><div><h2>انتخاب سازمان</h2><p>برای مشاهده فضای کاری، سازمان فعال را مشخص کنید.</p></div></div><select aria-label="انتخاب سازمان" value={tenantId} onChange={(event) => changeTenant(event.target.value)}><option value="">انتخاب سازمان</option>{tenantOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></section>}

          {active === "overview" ? (
            <>
              <div className={styles.metrics}>
                {[
                  ["پرونده‌های سازمانی", "▤", "پس از اتصال منبع داده"],
                  ["واحدهای سازمانی", "▣", "پس از تکمیل ساختار"],
                  ["اسناد ثبت‌شده", "▧", "پس از اتصال بایگانی"],
                  ["درخواست‌های باز", "◷", "پس از فعال‌سازی گردش کار"],
                ].map(([label, icon, note]) => <article className={styles.metric} key={label}><div className={styles.metricTop}><span>{label}</span><i>{icon}</i></div><strong>—</strong><small>{note}</small></article>)}
              </div>
              <div className={styles.mainGrid}>
                <section className={styles.panel}>
                  <div className={styles.panelHead}><div><h2>ماژول‌های یکپارچه مدیریت</h2><p>فضاهای کاری سازمان در یک داشبورد واحد</p></div><span className={styles.softTag}>۱۰ ماژول</span></div>
                  <div className={styles.moduleGrid}>{modules.map((item) => <button className={styles.moduleCard} key={item.id} onClick={() => setActive(item.id)}><span className={styles.moduleIcon}>{item.icon}</span><span><b>{item.title}</b><small>{item.description}</small></span><span className={styles.arrow}>←</span></button>)}</div>
                </section>
                <aside className={styles.rightStack}>
                  <section className={styles.panel}>
                    <div className={styles.panelHead}><div><h2>وضعیت زیرساخت</h2><p>نمای وضعیت اتصال در این نسخه</p></div></div>
                    <div className={styles.connection}><span className={styles.connectionIcon}>◈</span><div><b>احراز هویت</b><small>نشست کاربر از سرویس احراز هویت بررسی می‌شود</small></div><span className={styles.neutralStatus}>متصل</span></div>
                    <div className={styles.connection}><span className={styles.connectionIcon}>▣</span><div><b>سازمان فعال</b><small>انتخاب سازمان از فهرست مجاز حساب</small></div><span className={styles.neutralStatus}>{tenantId ? "انتخاب‌شده" : "نیازمند انتخاب"}</span></div>
                    <div className={styles.connection}><span className={styles.connectionIcon}>⬡</span><div><b>کنترل دسترسی</b><small>اعتبارسنجی درخواست‌ها در سمت سرور</small></div><span className={styles.neutralStatus}>فعال</span></div>
                  </section>
                  <section className={styles.callout}><span>✦</span><div><b>حاکمیت داده و دسترسی</b><p>هیچ شاخص یا فعالیت نمونه‌ای نمایش داده نمی‌شود. هر ماژول پس از تعریف مجوزها و اتصال امن منبع معتبر، داده واقعی خود را نمایش خواهد داد.</p></div></section>
                </aside>
              </div>
              <section className={styles.panel}><div className={styles.panelHead}><div><h2>فعالیت‌های اخیر</h2><p>گزارش سیستمی سازمان</p></div><span className={styles.softTag}>در انتظار اتصال</span></div><div className={styles.empty}><span>◷</span><b>داده‌ای برای نمایش در دسترس نیست</b><small>پس از اتصال منبع گزارش معتبر، فعالیت‌های واقعی در این قسمت نمایش داده می‌شوند.</small></div></section>
            </>
          ) : (
            <section className={styles.panel}>
              <div className={styles.panelHead}><div><h2>{activeModule?.title}</h2><p>{activeModule?.description}</p></div><span className={styles.softTag}>فضای ماژول</span></div>
              <div className={styles.moduleIntro}><span className={styles.moduleIntroIcon}>{activeModule?.icon}</span><div><b>فضای اختصاصی {activeModule?.title}</b><p>پوسته این بخش در داشبورد اصلی آماده است. اتصال داده و فعال‌سازی عملیات، منوط به تعریف مدل داده، مجوزهای صریح و آزمون‌های امنیتی است.</p></div></div>
              <div className={styles.placeholderRows}><div><span>وضعیت ماژول</span><b>در انتظار تکمیل و اعتبارسنجی</b></div><div><span>منبع داده</span><b>پس از بررسی و تأیید تعیین می‌شود</b></div><div><span>سطح دسترسی</span><b>محدود به مجوزهای حساب و سازمان</b></div></div>
              <button className={styles.backButton} onClick={() => setActive("overview")}>بازگشت به نمای مدیریتی</button>
            </section>
          )}
          <footer className={styles.footer}>METATYA SPORTS OS <span>•</span> پنل اصلی مدیریت سازمان <span>•</span> طراحی امن و ماژولار</footer>
        </section>
      </main>
    </div>
  );
}
