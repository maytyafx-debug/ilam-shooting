"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import "./platform.css";

type Tenant = { id: string; name: string; slug: string; role: string };
type Member = { id: string; full_name: string; phone: string | null; sport_type: string | null; status: string; created_at: string };
type Section = { id: string; title: string; description: string; icon: string; state: "connected" | "planned"; detail: string };

const sections: Section[] = [
  { id: "organization", title: "ساختار سازمانی", description: "هیئت، واحدها، کمیته‌ها و شهرستان‌ها", icon: "▦", state: "planned", detail: "مدل سازمانی در سند مرجع تعریف شده است؛ فرم‌ها و APIهای این بخش هنوز به پایگاه داده عملیاتی متصل نشده‌اند." },
  { id: "clubs", title: "باشگاه‌ها و مراکز", description: "پرونده باشگاه، مرکز، مجوز اداری و امکانات عمومی", icon: "⌂", state: "planned", detail: "ثبت و مدیریت باشگاه‌ها و مراکز در معماری تعریف شده؛ هنوز به پایگاه داده عملیاتی متصل نشده است." },
  { id: "members", title: "اعضا و ورزشکاران", description: "پرونده پایه، وضعیت عضویت و جست‌وجوی اعضا", icon: "♙", state: "connected", detail: "فهرست پایه اعضا از API احراز هویت‌شده و با محدوده سازمان فعال خوانده می‌شود." },
  { id: "professionals", title: "کارشناسان و عوامل", description: "پروفایل حرفه‌ای، مدارک، اعتبارنامه و تاریخ انقضا", icon: "♧", state: "planned", detail: "دفتر اطلاعات حرفه‌ای و اعتبارنامه‌ها در این نسخه هنوز API و جداول عملیاتی ندارند." },
  { id: "calendar", title: "تقویم و برنامه‌های اداری", description: "جلسات، مناسبت‌ها، برنامه‌های داخلی و یادآوری", icon: "▣", state: "planned", detail: "تقویم اداری و یادآوری‌ها در دامنه سامانه قرار دارند؛ هنوز سرویس ذخیره‌سازی و اعلان فعال نیست." },
  { id: "honours", title: "آرشیو افتخارات", description: "سوابق افتخار و مدال بر اساس جنسیت، رده سنی و سال", icon: "✧", state: "planned", detail: "این آرشیو برای نگهداری گواهی‌ها و اسناد رسمیِ تأییدشده طراحی می‌شود؛ آمار تا زمان ورود داده معتبر خالی می‌ماند." },
  { id: "membership", title: "عضویت و تمدید", description: "دوره عضویت، درخواست‌ها، وضعیت و سوابق تمدید", icon: "▤", state: "planned", detail: "چرخه عضویت و درخواست‌های اصلاح اطلاعات هنوز به سرویس عملیاتی متصل نشده است." },
  { id: "insurance", title: "بیمه و پوشش‌ها", description: "مرجع بیمه، اعتبار پوشش و یادآوری انقضا", icon: "◇", state: "planned", detail: "اطلاعات بیمه در دسته داده‌های حساس قرار می‌گیرد و پس از طراحی دسترسی محدود و ذخیره‌سازی امن فعال خواهد شد." },
  { id: "finance", title: "امور مالی", description: "دریافت‌ها، پرداخت‌ها، اسناد مالی و گزارش حساب", icon: "＄", state: "planned", detail: "هیچ تراکنش یا مانده مالی ساختگی نمایش داده نمی‌شود؛ اتصال مالی هنوز انجام نشده است." },
  { id: "training", title: "آموزش و توسعه", description: "دوره‌ها، حضور و سوابق آموزشی", icon: "⌂", state: "planned", detail: "ثبت دوره و سوابق آموزشی در نقشه راه است؛ ارزیابی‌های اثرگذار نیازمند بررسی انسانی متخصص هستند." },
  { id: "documents", title: "دبیرخانه و اسناد", description: "نامه‌ها، مکاتبات، پرونده‌ها، نسخه‌ها و بایگانی", icon: "▧", state: "planned", detail: "مدیریت نسخه، طبقه‌بندی محرمانگی و گردش تأیید هنوز به فضای ذخیره‌سازی امن متصل نشده است." },
  { id: "facilities", title: "اماکن و دارایی‌ها", description: "مراکز، امکانات عمومی، اموال اداری و نگهداری", icon: "⌂", state: "planned", detail: "این بخش برای ثبت اداری امکانات و دارایی‌های عمومی است؛ هنوز داده عملیاتی ندارد." },
  { id: "communications", title: "اطلاع‌رسانی", description: "اطلاعیه‌ها، مخاطبان مجاز و گزارش ارسال", icon: "◉", state: "planned", detail: "ارسال پیام و ثبت رسید تحویل هنوز به ارائه‌دهنده ارتباطی متصل نشده است." },
  { id: "analytics", title: "گزارش‌ها و تحلیل", description: "شاخص‌های تجمیعی، فیلترها و خروجی‌های مدیریتی", icon: "▥", state: "planned", detail: "گزارش‌ها فقط پس از اتصال منابع معتبر و اعمال حداقل‌سازی داده و کنترل حریم خصوصی فعال می‌شوند." },
  { id: "access", title: "کاربران و دسترسی‌ها", description: "نقش، محدوده سازمانی، مجوز، رضایت و بازبینی دسترسی", icon: "♧", state: "planned", detail: "در حال حاضر فقط عضویت سازمانی تأییدشده از سرویس موجود خوانده می‌شود؛ مدیریت کامل مجوزها هنوز پیاده‌سازی نشده است." },
  { id: "security", title: "امنیت و ممیزی", description: "رخدادهای امنیتی، گزارش تغییرات و کنترل نشست", icon: "⛨", state: "planned", detail: "ثبت ممیزی و امنیت در معماری تعریف شده؛ صفحه و API عملیاتی این بخش هنوز کامل نیست." },
];

function roleName(role: string) {
  if (role === "owner") return "مالک پلتفرم";
  if (role === "admin") return "مدیر سازمان";
  if (role === "referee") return "داور";
  if (role === "coach") return "مربی";
  if (role === "staff") return "کارمند";
  return "عضو";
}

export default function PlatformPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [role, setRole] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [membersAvailable, setMembersAvailable] = useState(false);
  const [active, setActive] = useState("overview");
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const tenantLoadSequence = useRef(0);

  const canCreateMembers = role === "owner" || role === "admin";
  const filteredMembers = useMemo(() => members.filter((member) => member.full_name.toLowerCase().includes(search.trim().toLowerCase())), [members, search]);
  const currentSection = sections.find((item) => item.id === active);

  useEffect(() => {
    let mounted = true;
    async function initialize() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError || !data.user) { router.replace("/login"); return; }
        const response = await fetch("/api/core-sports/tenant", { cache: "no-store" });
        const payload = await response.json();
        if (response.status === 401) { router.replace("/login"); return; }
        if (!response.ok) throw new Error(payload.error || "سازمان فعالی برای این حساب پیدا نشد.");
        const options: Tenant[] = payload.tenants ?? (payload.tenant ? [payload.tenant] : []);
        if (!options.length) throw new Error("برای این حساب عضویت سازمانی فعالی ثبت نشده است.");
        const saved = window.sessionStorage.getItem("metatya-sports-os-active-tenant");
        const selected = options.length === 1 ? options[0] : options.find((item) => item.id === saved) ?? options[0];
        if (["owner", "admin"].includes(selected.role)) {
          const { data: assurance, error: assuranceError } =
            await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (assuranceError) throw assuranceError;
          if (assurance.currentLevel !== "aal2") {
            router.replace("/security/mfa");
            return;
          }
        }
        if (!mounted) return;
        setTenants(options); setTenantId(selected.id); setTenantName(selected.name); setRole(selected.role);
        window.sessionStorage.setItem("metatya-sports-os-active-tenant", selected.id);
        await loadMembersFor(selected.id, selected.role);
      } catch (caught) {
        if (mounted) setError(caught instanceof Error ? caught.message : "خطا در بارگذاری پلتفرم");
      } finally { if (mounted) setLoading(false); }
    }
    async function loadMembersFor(id: string, selectedRole: string) {
      if (!["owner", "admin", "referee"].includes(selectedRole)) return;
      const requestId = ++tenantLoadSequence.current;
      const response = await fetch("/api/core-sports/members", { cache: "no-store", headers: { "x-tenant-id": id } });
      const payload = await response.json();
      if (!mounted || requestId !== tenantLoadSequence.current) return;
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) throw new Error(payload.error || "دریافت اعضا ناموفق بود.");
      setMembers(payload.members ?? []); setMembersAvailable(true);
    }
    void initialize();
    return () => { mounted = false; };
  }, [router]);

  async function loadMembersForTenant(id: string, selectedRole: string) {
    if (!["owner", "admin", "referee"].includes(selectedRole)) return;
    const requestId = ++tenantLoadSequence.current;
    const response = await fetch("/api/core-sports/members", { cache: "no-store", headers: { "x-tenant-id": id } });
    const payload = await response.json();
    if (requestId !== tenantLoadSequence.current) return;
    if (response.status === 401) { router.replace("/login"); return; }
    if (!response.ok) throw new Error(payload.error || "دریافت اعضا ناموفق بود.");
    setMembers(payload.members ?? []); setMembersAvailable(true);
  }

  async function switchTenant(id: string) {
    const selected = tenants.find((item) => item.id === id);
    if (!selected) return;
    setBusy(true); setError(""); setNotice(""); setMembers([]); setMembersAvailable(false);
    setTenantId(id); setTenantName(selected.name); setRole(selected.role);
    window.sessionStorage.setItem("metatya-sports-os-active-tenant", id);
    try { await loadMembersForTenant(id, selected.role); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "تغییر سازمان ناموفق بود."); }
    finally { setBusy(false); }
  }

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/core-sports/members", { method: "POST", headers: { "Content-Type": "application/json", "x-tenant-id": tenantId }, body: JSON.stringify({ full_name: name.trim(), sport_type: "عضویت عمومی" }) });
      const payload = await response.json();
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) throw new Error(payload.error || "ثبت عضو انجام نشد.");
      setMembers((previous) => [payload.member, ...previous]); setName(""); setNotice("عضو با موفقیت در سازمان فعال ثبت شد.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ثبت عضو ناموفق بود."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) return <main className="platform-loading">در حال آماده‌سازی فضای مدیریت…</main>;
  if (!tenantId) return <main className="platform-loading"><section className="platform-panel"><h1>دسترسی به پلتفرم</h1><p>{error || "سازمان فعالی یافت نشد."}</p><button onClick={() => router.replace("/login")}>بازگشت به ورود</button></section></main>;

  return (
    <div className="platform-root" dir="rtl">
      <aside className="platform-sidebar">
        <div className="platform-brand"><span className="platform-mark">م</span><div><b>METATYA</b><small>SPORTS OS</small></div></div>
        <div className="sidebar-caption">فضای مدیریت</div>
        <button className={active === "overview" ? "nav-item active" : "nav-item"} onClick={() => setActive("overview")}><span>⌂</span> نمای کلی</button>
        <div className="sidebar-caption">مدیریت سازمان</div>
        {sections.slice(0, 6).map((item) => <button key={item.id} className={active === item.id ? "nav-item active" : "nav-item"} onClick={() => setActive(item.id)}><span>{item.icon}</span>{item.title}</button>)}
        <div className="sidebar-caption">عملیات پشتیبانی</div>
        {sections.slice(6).map((item) => <button key={item.id} className={active === item.id ? "nav-item active" : "nav-item"} onClick={() => setActive(item.id)}><span>{item.icon}</span>{item.title}</button>)}
        <div className="sidebar-bottom"><small>نسخه آزمایشی متصل به داده‌های موجود</small><button onClick={signOut}>خروج امن از حساب ↗</button></div>
      </aside>
      <main className="platform-main">
        <header className="platform-header">
          <div><span className="eyebrow">METATYA / SPORTS OS</span><h1>{active === "overview" ? "داشبورد مدیریت" : currentSection?.title}</h1><p>{tenantName} · {roleName(role)}</p></div>
          <div className="header-tools">
            {tenants.length > 1 && <label>سازمان فعال<select value={tenantId} disabled={busy} onChange={(event) => void switchTenant(event.target.value)}>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></label>}
            <span className="secure-chip">● نشست تأییدشده</span>
          </div>
        </header>
        {error && <div className="platform-alert error" role="alert">{error}</div>}
        {notice && <div className="platform-alert success" role="status">{notice}</div>}
        {active === "overview" ? <>
          <section className="welcome-panel"><div><span className="eyebrow">ILAM · ORGANIZATION WORKSPACE</span><h2>به فضای مدیریت یکپارچه خوش آمدید</h2><p>ماژول‌ها در یک ساختار واحد گردآوری شده‌اند. وضعیت هر بخش بر اساس اتصال واقعی و شواهد موجود نمایش داده می‌شود.</p></div><div className="welcome-emblem">م</div></section>
          <section className="platform-stats">
            <article><span>اعضای قابل مشاهده</span><b>{membersAvailable ? members.length.toLocaleString("fa-IR") : "—"}</b><small>{membersAvailable ? "داده واقعی از پایگاه داده" : "برای این نقش قابل مشاهده نیست"}</small></article>
            <article><span>ماژول‌های تعریف‌شده</span><b>{(sections.length + 1).toLocaleString("fa-IR")}</b><small>بر اساس دامنه سند مرجع</small></article>
            <article><span>ماژول‌های متصل به داده</span><b>{membersAvailable ? "۱" : "۰"}</b><small>فهرست پایه اعضا؛ سایر بخش‌ها در انتظار اتصال</small></article>
            <article><span>سازمان فعال</span><b className="stat-name">{tenantName}</b><small>عضویت توسط سرور تأیید شده است</small></article>
          </section>
          <div className="section-heading"><div><span className="eyebrow">MODULE DIRECTORY</span><h2>همه بخش‌های سامانه</h2></div><p>برای بررسی هر بخش، آن را از فهرست انتخاب کنید.</p></div>
          <section className="module-cards">{sections.map((item) => <button key={item.id} className="module-card" onClick={() => setActive(item.id)}><span className="module-icon">{item.icon}</span><span className="module-state">{item.state === "connected" ? "متصل" : "در صف پیاده‌سازی"}</span><b>{item.title}</b><small>{item.description}</small><i>مشاهده بخش ←</i></button>)}</section>
          <section className="platform-note"><b>شفافیت داده:</b> اعداد فقط از سرویس متصل خوانده می‌شوند. برای بخش‌های فاقد اتصال، داده نمونه یا آمار تخمینی نمایش داده نمی‌شود.</section>
        </> : active === "members" ? <>
          <section className="content-panel"><div className="section-heading"><div><span className="eyebrow">PEOPLE DIRECTORY</span><h2>اعضا و ورزشکاران</h2></div><span className="connected-pill">● اتصال واقعی فعال</span></div>
            {canCreateMembers && <form className="member-create" onSubmit={createMember}><label>نام و نام خانوادگی<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={150} required placeholder="نام کامل عضو" /></label><button disabled={busy || !name.trim()}>ثبت عضو</button></form>}
            <div className="list-toolbar"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجو در نام اعضا…" /><span>{membersAvailable ? filteredMembers.length.toLocaleString("fa-IR") + " رکورد" : "داده قابل نمایش نیست"}</span></div>
            {membersAvailable ? <div className="platform-table-wrap"><table className="platform-table"><thead><tr><th>نام</th><th>دسته</th><th>وضعیت</th><th>تاریخ ثبت</th></tr></thead><tbody>{filteredMembers.map((member) => <tr key={member.id}><td>{member.full_name}</td><td>{member.sport_type || "—"}</td><td>{member.status === "active" ? "فعال" : member.status === "inactive" ? "غیرفعال" : "معلق"}</td><td>{new Date(member.created_at).toLocaleDateString("fa-IR")}</td></tr>)}{filteredMembers.length === 0 && <tr><td colSpan={4}>رکوردی برای نمایش وجود ندارد.</td></tr>}</tbody></table></div> : <p className="empty-copy">دسترسی مشاهده فهرست اعضا برای نقش فعلی فعال نیست.</p>}
            <p className="privacy-hint">اطلاعات تماس، مدارک هویتی و داده‌های حساس در این فهرست عمومی نمایش داده نمی‌شوند.</p>
          </section>
        </> : currentSection ? <section className="content-panel module-detail">
          <div className="section-heading"><div><span className="eyebrow">MODULE WORKSPACE</span><h2>{currentSection.title}</h2></div><span className={currentSection.state === "connected" ? "connected-pill" : "planned-pill"}>{currentSection.state === "connected" ? "متصل به سرویس" : "تعریف‌شده؛ اتصال در حال تکمیل"}</span></div>
          <p className="module-description">{currentSection.description}</p>
          <div className="module-detail-box"><span className="module-icon large">{currentSection.icon}</span><div><b>وضعیت اجرایی این بخش</b><p>{currentSection.detail}</p></div></div>
          <div className="module-checklist"><b>موارد پیش‌بینی‌شده در این فضای کاری</b><ul><li>رابط کاربری فارسی و سازگار با موبایل</li><li>دسترسی مبتنی بر نقش و محدوده سازمانی</li><li>ثبت منبع داده و تاریخچه تغییرات</li><li>گزارش‌گیری فقط از داده‌های معتبر و مجاز</li><li>حالت خالی شفاف تا زمان اتصال داده واقعی</li></ul></div>
          <p className="privacy-hint">این صفحه وضعیت فعلی را صادقانه نشان می‌دهد؛ هنوز عملیات ذخیره‌سازی این ماژول فعال نشده است.</p>
        </section> : null}
        <footer className="platform-footer"><span>METATYA Sports OS · Ilam Pilot</span><span>دسترسی‌ها در سمت سرور بررسی می‌شوند</span></footer>
      </main>
    </div>
  );
}
