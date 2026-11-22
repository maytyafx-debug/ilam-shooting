"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type TenantOption = { id: string; name: string; slug: string; role: string };
type TenantPayload = { tenants?: TenantOption[]; tenant?: TenantOption | null; error?: string };
type ModuleItem = {
  id: string;
  title: string;
  icon: string;
  status: "connected" | "partial" | "planned";
  summary: string;
  features: string[];
  note: string;
};

const modules: ModuleItem[] = [
  { id: "organization", title: "مدیریت فدراسیون و هیئت", icon: "▦", status: "partial", summary: "ساختار سازمانی و واحدهای تابعه", features: ["ساختار فدراسیون، هیئت استان و شهرستان", "کمیته‌ها و واحدهای سازمانی", "مدیریت سمت‌ها و دوره مسئولیت", "وضعیت فعالیت و تاریخچه تغییرات", "نمای کلی ارتباط واحدها"], note: "انتخاب سازمان و کنترل عضویت پایه در نسخه فعلی متصل است؛ مدیریت کامل ساختار هنوز تکمیل نشده است." },
  { id: "clubs", title: "باشگاه‌ها و مراکز", icon: "⌂", status: "planned", summary: "پرونده باشگاه، مرکز و امکانات عمومی", features: ["ثبت و ویرایش مشخصات باشگاه", "اطلاعات تماس مجاز و نشانی", "وضعیت فعالیت و مجوزهای اداری", "ثبت مراکز و فضاهای عمومی", "تاریخچه تغییرات و مدارک"], note: "هنوز به جداول عملیاتی این بخش متصل نیست." },
  { id: "members", title: "پرونده اعضا و ورزشکاران", icon: "◎", status: "partial", summary: "فهرست پایه اعضا و پرونده‌های فردی", features: ["فهرست اعضای ثبت‌شده", "جست‌وجو و فیلتر پرونده‌ها", "تفکیک جنسیت و رده سنی پس از تکمیل فیلدهای مجاز", "وضعیت عضویت و وابستگی سازمانی", "مدارک تأییدشده و درخواست اصلاح اطلاعات", "حفاظت ویژه از اطلاعات افراد زیر سن قانونی"], note: "فهرست پایه اعضا از پایگاه داده فعلی خوانده می‌شود؛ پرونده کامل، رده‌بندی‌ها و رضایت سرپرست هنوز پیاده‌سازی نشده‌اند." },
  { id: "professionals", title: "مربیان، داوران و کارشناسان", icon: "♙", status: "planned", summary: "دفتر ثبت افراد حرفه‌ای و اعتبار مدارک", features: ["ثبت پروفایل حرفه‌ای", "نوع تخصص و مرجع صادرکننده", "شماره مرجع مدرک و تاریخ اعتبار", "وضعیت راستی‌آزمایی و انقضا", "سوابق تمدید و تغییر وضعیت"], note: "این بخش برای ثبت اداری مدارک و صلاحیت‌هاست؛ هنوز به پایگاه داده متصل نیست." },
  { id: "calendar", title: "تقویم و برنامه‌های سازمانی", icon: "▣", status: "planned", summary: "تقویم جلسات، مناسبت‌ها و برنامه‌های اداری", features: ["تقویم سالانه و ماهانه", "جلسات و برنامه‌های داخلی", "مکان و مسئول هماهنگی اداری", "اطلاع‌رسانی و یادآوری", "آرشیو برنامه‌های برگزارشده"], note: "نسخه فعلی فقط ساختار نمایشی این ماژول را نشان می‌دهد؛ داده‌ای ثبت نمی‌شود." },
  { id: "honours", title: "آرشیو افتخارات و مدال‌آوران", icon: "✧", status: "planned", summary: "آرشیو تاریخی بر پایه اسناد رسمی تأییدشده", features: ["ثبت عنوان افتخار و مرجع رسمی", "فیلتر جنسیت و رده سنی", "فیلتر سال، سطح و نوع مدال", "اتصال گواهی یا سند تأییدشده", "سیاست انتشار نام و تصویر با مجوز", "گزارش آرشیوی بدون ساخت نتیجه یا رتبه"], note: "این آرشیو فقط برای نگهداری سوابق و اسناد رسمی تأییدشده طراحی شده است؛ هنوز داده عملیاتی ندارد." },
  { id: "talent", title: "استعدادیابی و مسیر توسعه", icon: "✦", status: "planned", summary: "پرونده‌های توسعه با رضایت و نظارت انسانی", features: ["ثبت درخواست با رضایت معتبر", "معیارهای ارزیابی نسخه‌بندی‌شده", "بازبینی توسط کارشناس مجاز", "برنامه توسعه و موعد بازبینی", "ثبت اعتراض و درخواست اصلاح"], note: "هیچ تصمیم خودکاری درباره افراد گرفته نمی‌شود؛ این بخش هنوز پیاده‌سازی نشده است." },
  { id: "education", title: "آموزش و دوره‌ها", icon: "▤", status: "planned", summary: "مدیریت دوره‌های عمومی، حضور و گواهی", features: ["تعریف دوره و برگزارکننده", "ثبت‌نام و فهرست شرکت‌کنندگان", "ثبت حضور و غیاب", "صدور و تمدید گواهی", "سوابق آموزشی و گزارش دوره"], note: "مدیریت اداری دوره‌هاست؛ هنوز به پایگاه داده متصل نیست." },
  { id: "finance", title: "امور مالی و حسابداری", icon: "◫", status: "planned", summary: "صورتحساب‌ها و گردش مالی با دسترسی محدود", features: ["تعریف ردیف‌های درآمد و هزینه", "صورتحساب و رسید", "بدهی، استرداد و تطبیق", "گزارش دوره‌ای و خروجی حسابداری", "ثبت شناسه مرجع پرداخت بدون ذخیره اطلاعات کارت"], note: "هیچ اطلاعات پرداخت یا حساب بانکی در این نسخه دریافت یا ذخیره نمی‌شود." },
  { id: "insurance", title: "عضویت و بیمه", icon: "♡", status: "planned", summary: "دوره عضویت و وضعیت پوشش بیمه‌ای", features: ["دوره و وضعیت عضویت", "مرجع بیمه و شناسه پیگیری", "تاریخ شروع و پایان پوشش", "هشدار انقضا و تمدید", "دسترسی محدود به اطلاعات بیمه"], note: "اطلاعات بیمه حساس است و تا تکمیل کنترل دسترسی و اتصال امن ثبت نمی‌شود." },
  { id: "assets", title: "اموال، مراکز و نگهداری", icon: "⚙", status: "planned", summary: "اموال اداری و نگهداری عمومی تأسیسات", features: ["دفتر اموال و شناسه موجودی", "محل استقرار و تحویل‌گیرنده", "وضعیت نگهداری و سرویس", "سوابق بازرسی اداری", "مدارک و تاریخچه تغییرات"], note: "دامنه این بخش به مدیریت عمومی دارایی‌ها و تأسیسات محدود است؛ هنوز عملیاتی نیست." },
  { id: "analytics", title: "گزارش‌ها و هوش سازمانی", icon: "▥", status: "planned", summary: "گزارش‌های تجمیعی، مجاز و قابل ردیابی", features: ["گزارش اعضا بر اساس فیلترهای مجاز", "آمار تجمیعی جنسیت و رده سنی", "گزارش عضویت و اعتبار مدارک", "شاخص کیفیت و کامل‌بودن داده", "ثبت منبع و زمان تهیه گزارش", "حذف یا تجمیع داده‌های قابل شناسایی در گزارش عمومی"], note: "تا زمان اتصال منابع واقعی، هیچ عدد نمونه‌ای به‌عنوان آمار سامانه نمایش داده نمی‌شود." },
  { id: "communications", title: "ارتباطات و اطلاع‌رسانی", icon: "◉", status: "planned", summary: "اطلاعیه‌ها و اعلان‌های سازمانی", features: ["قالب اطلاعیه رسمی", "انتخاب مخاطب بر اساس سطح مجاز", "ارسال و وضعیت تحویل", "تاریخچه اعلان‌ها", "مدیریت رضایت دریافت پیام"], note: "اتصال پیامکی، ایمیلی یا پیام‌رسان هنوز انجام نشده است." },
  { id: "documents", title: "دبیرخانه، اسناد و گردش‌کار", icon: "▧", status: "planned", summary: "مکاتبات، بایگانی و نسخه‌بندی کنترل‌شده", features: ["ثبت نامه وارده و صادره", "شماره و تاریخ دبیرخانه", "ارجاع و پیگیری اداری", "سطح محرمانگی و سطح دسترسی", "نسخه‌بندی، نگهداری و امحای مجاز", "ردپای منبع و تغییرات"], note: "ذخیره‌سازی امن فایل و گردش‌کار هنوز راه‌اندازی نشده است." },
  { id: "security", title: "امنیت، کاربران و حاکمیت", icon: "⬡", status: "partial", summary: "هویت، نقش، حریم خصوصی و ممیزی", features: ["ورود امن و نشست کاربر", "عضویت سازمانی و انتخاب سازمان مجاز", "نقش‌ها و محدوده دسترسی", "ثبت رویدادهای ممیزی", "بازبینی دسترسی و لغو مجوز", "MFA و بازیابی امن", "مالکیت داده و مجوز استفاده"], note: "ورود و کنترل پایه عضویت در نسخه فعلی فعال است؛ ماتریس کامل نقش‌ها، MFA و گزارش ممیزی هنوز نیازمند تکمیل و آزمون است." },
];

const statusText = {
  connected: "متصل",
  partial: "اتصال محدود",
  planned: "در صف پیاده‌سازی",
};

const statusClass = {
  connected: "workspace-status connected",
  partial: "workspace-status partial",
  planned: "workspace-status planned",
};

export default function WorkspacePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [role, setRole] = useState("");
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState("organization");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  async function loadTenant(id: string, name: string, activeRole: string) {
    setTenantId(id);
    setTenantName(name);
    setRole(activeRole);
    setMemberCount(null);
    if (activeRole === "owner" || activeRole === "admin") {
      try {
        const response = await fetch("/api/core-sports/members", {
          cache: "no-store",
          headers: { "x-tenant-id": id },
        });
        if (response.ok) {
          const payload = await response.json() as { members?: unknown[] };
          setMemberCount(Array.isArray(payload.members) ? payload.members.length : null);
        }
      } catch {
        setMemberCount(null);
      }
    }
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          router.replace("/login");
          return;
        }
        const response = await fetch("/api/core-sports/tenant", { cache: "no-store" });
        const payload = await response.json() as TenantPayload;
        if (!response.ok) throw new Error(payload.error || "دریافت سازمان‌های مجاز ناموفق بود.");
        const options = payload.tenants ?? (payload.tenant ? [payload.tenant] : []);
        if (!options.length) throw new Error("برای این حساب عضویت سازمانی فعال پیدا نشد.");
        if (!active) return;
        setTenantOptions(options);
        const storedId = window.sessionStorage.getItem("metatya-sports-os-active-tenant") ?? "";
        const selected = options.find((item) => item.id === storedId) ?? options[0];
        window.sessionStorage.setItem("metatya-sports-os-active-tenant", selected.id);
        await loadTenant(selected.id, selected.name, selected.role);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "خطای ارتباط با سامانه");
      } finally {
        if (active) setLoading(false);
      }
    }
    void initialize();
    return () => { active = false; };
  }, [router]);

  const filteredModules = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fa");
    if (!normalized) return modules;
    return modules.filter((item) =>
      [item.title, item.summary, ...item.features].join(" ").toLocaleLowerCase("fa").includes(normalized),
    );
  }, [query]);

  const selected = modules.find((item) => item.id === selectedId) ?? modules[0];

  async function changeTenant(id: string) {
    const selectedTenant = tenantOptions.find((item) => item.id === id);
    if (!selectedTenant) return;
    window.sessionStorage.setItem("metatya-sports-os-active-tenant", id);
    await loadTenant(id, selectedTenant.name, selectedTenant.role);
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-topbar">
        <div className="workspace-brand"><span className="workspace-logo">M</span><div><strong>METATYA</strong><small>SPORTS OS · ILAM</small></div></div>
        <div className="workspace-user">
          <label htmlFor="workspace-tenant">سازمان فعال</label>
          <select id="workspace-tenant" value={tenantId} onChange={(event) => void changeTenant(event.target.value)} disabled={tenantOptions.length < 2}>
            {tenantOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <span className="workspace-role">{role || "..."}</span>
          <button className="workspace-logout" onClick={() => void signOut()}>خروج</button>
        </div>
      </header>

      <section className="workspace-welcome">
        <div><span className="workspace-eyebrow">پنل یکپارچه مدیریت</span><h1>مرکز مدیریت هیئت</h1><p>{tenantName || "در حال دریافت سازمان فعال..."}</p></div>
        <div className="workspace-live"><span className="live-dot" /> اتصال حساب و سازمان</div>
      </section>

      {error && <div className="workspace-alert" role="alert">{error}</div>}
      {loading ? <div className="workspace-loading">در حال آماده‌سازی محیط امن سازمان...</div> : !error && (
        <>
          <section className="workspace-metrics">
            <article><span>اعضای قابل مشاهده</span><strong>{memberCount === null ? "—" : memberCount.toLocaleString("fa-IR")}</strong><small>{memberCount === null ? "برای این نقش یا این اتصال، عددی در دسترس نیست" : "خوانده‌شده از پایگاه داده فعلی"}</small></article>
            <article><span>ماژول‌های سامانه</span><strong>{modules.length.toLocaleString("fa-IR")}</strong><small>فهرست قابلیت‌های مرجع</small></article>
            <article><span>سازمان‌های مجاز</span><strong>{tenantOptions.length.toLocaleString("fa-IR")}</strong><small>بر اساس عضویت تأییدشده حساب</small></article>
          </section>

          <div className="workspace-layout">
            <aside className="workspace-sidebar">
              <h2>بخش‌های سامانه</h2>
              <label className="workspace-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی ماژول..." /></label>
              <nav aria-label="ماژول‌های سامانه">
                {filteredModules.map((item) => (
                  <button key={item.id} className={selectedId === item.id ? "workspace-nav-item active" : "workspace-nav-item"} onClick={() => setSelectedId(item.id)}>
                    <span>{item.icon}</span><span>{item.title}</span>
                  </button>
                ))}
              </nav>
              <div className="workspace-sidebar-foot">نسخه اولیه · وضعیت‌ها بر پایه شواهد مخزن</div>
            </aside>

            <section className="workspace-main">
              <div className="workspace-section-head"><div><span className="workspace-eyebrow">MODULE DIRECTORY</span><h2>همه ماژول‌ها</h2></div><span>{filteredModules.length.toLocaleString("fa-IR")} بخش</span></div>
              <div className="workspace-module-grid">
                {filteredModules.map((item) => (
                  <button key={item.id} className={selectedId === item.id ? "workspace-module-card selected" : "workspace-module-card"} onClick={() => setSelectedId(item.id)}>
                    <span className="workspace-module-icon">{item.icon}</span><span className="workspace-module-title">{item.title}</span><span className={statusClass[item.status]}>{statusText[item.status]}</span><small>{item.summary}</small>
                  </button>
                ))}
              </div>

              <section className="workspace-detail">
                <div className="workspace-detail-head"><div><span className="workspace-eyebrow">MODULE DETAILS</span><h3>{selected.title}</h3><p>{selected.summary}</p></div><span className={statusClass[selected.status]}>{statusText[selected.status]}</span></div>
                <div className="workspace-feature-grid">
                  {selected.features.map((feature, index) => <div className="workspace-feature" key={feature}><span>{String(index + 1).padStart(2, "0")}</span>{feature}</div>)}
                </div>
                <div className="workspace-module-note"><strong>وضعیت واقعی پیاده‌سازی</strong><p>{selected.note}</p></div>
              </section>
            </section>
          </div>
          <footer className="workspace-footer">METATYA SPORTS OS · ILAM PILOT <span>اطلاعات فقط در محدوده دسترسی حساب نمایش داده می‌شوند.</span></footer>
        </>
      )}
    </main>
  );
}
