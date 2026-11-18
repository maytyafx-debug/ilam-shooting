"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type TenantOption = { id: string; name: string; slug: string; role: string };
type MemberOption = { id: string; full_name: string; membership_number?: string | null };
type EventOption = { id: string; title: string };
type Row = Record<string, unknown>;
type ClubData = {
  memberships: Row[]; insurance: Row[]; entries: Row[]; plans: Row[];
  finances: Row[]; consents: Row[]; profiles: Row[];
};
type Tab = keyof ClubData;
type ModuleName = "membership" | "insurance" | "entry" | "plan" | "finance" | "consent" | "profile";

const STORAGE_KEY = "metatya-sports-os-active-tenant";
const EMPTY_DATA: ClubData = { memberships: [], insurance: [], entries: [], plans: [], finances: [], consents: [], profiles: [] };
const TABS: { id: Tab; module: ModuleName; label: string; description: string }[] = [
  { id: "memberships", module: "membership", label: "عضویت و حق عضویت", description: "دوره‌ها، وضعیت و مبالغ عضویت" },
  { id: "insurance", module: "insurance", label: "بیمه ورزشی", description: "ثبت پوشش بیمه‌ای و تاریخ اعتبار" },
  { id: "entries", module: "entry", label: "ثبت‌نام رویدادها", description: "ثبت حضور و مدیریت وضعیت شرکت‌کنندگان" },
  { id: "plans", module: "plan", label: "مسیر رشد ورزشکار", description: "برنامه رشد، اهداف و بازبینی" },
  { id: "finances", module: "finance", label: "امور مالی", description: "دفتر مالی ثبت‌محور و اصلاح از طریق سند برگشتی" },
  { id: "consents", module: "consent", label: "رضایت سرپرست", description: "ثبت رضایت مستقل برای هر هدف و امکان لغو" },
  { id: "profiles", module: "profile", label: "پرونده تخصصی ورزشکار", description: "اطلاعات خصوصی و تماس اضطراری؛ فقط مدیر مجاز" },
];

function storedTenant() {
  try { return window.sessionStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; }
}
function saveTenant(id: string) {
  try { window.sessionStorage.setItem(STORAGE_KEY, id); } catch { /* convenience only */ }
}
function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join("، ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function dateLabel(value: unknown) {
  if (typeof value !== "string") return display(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("fa-IR");
}
function rowTitle(tab: Tab, row: Row) {
  if (tab === "memberships") return `عضویت ${display(row.membership_type)} · ${display(row.status)}`;
  if (tab === "insurance") return `${display(row.provider_name)} · ${display(row.status)}`;
  if (tab === "entries") return `شرکت‌کننده · ${display(row.status)}`;
  if (tab === "plans") return `${display(row.title)} · ${display(row.status)}`;
  if (tab === "finances") return `${display(row.category)} · ${display(row.amount)} ${display(row.currency)}`;
  if (tab === "consents") return `${display(row.guardian_name)} · ${display(row.consent_scope)}`;
  return `پرونده ورزشکار · ${display(row.membership_number)}`;
}

export default function ClubManagementPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [data, setData] = useState<ClubData>(EMPTY_DATA);
  const [activeTab, setActiveTab] = useState<Tab>("memberships");

  const active = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

  async function load(organizationId: string) {
    const headers = { "x-tenant-id": organizationId };
    const [clubResponse, memberResponse, eventResponse] = await Promise.all([
      fetch("/api/core-sports/club-management", { cache: "no-store", headers }),
      fetch("/api/core-sports/member-management", { cache: "no-store", headers }),
      fetch("/api/core-sports/events", { cache: "no-store", headers }),
    ]);
    if ([clubResponse, memberResponse, eventResponse].some((response) => response.status === 401)) {
      router.replace("/login");
      return;
    }
    const [clubPayload, memberPayload, eventPayload] = await Promise.all([
      clubResponse.json(), memberResponse.json(), eventResponse.json(),
    ]);
    if (!clubResponse.ok) throw new Error(clubPayload.error || "بارگذاری ماژول‌های باشگاه ناموفق بود.");
    if (!memberResponse.ok) throw new Error(memberPayload.error || "دریافت فهرست اعضا ناموفق بود.");
    if (!eventResponse.ok) throw new Error(eventPayload.error || "دریافت رویدادها ناموفق بود.");
    setData({ ...EMPTY_DATA, ...clubPayload });
    setMembers((memberPayload.members ?? []).map((item: MemberOption) => ({
      id: item.id, full_name: item.full_name, membership_number: item.membership_number,
    })));
    setEvents(eventPayload.events ?? []);
  }

  useEffect(() => {
    let mounted = true;
    async function initialize() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: authData, error } = await supabase.auth.getUser();
        if (error || !authData.user) { router.replace("/login"); return; }
        const response = await fetch("/api/core-sports/tenant", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "سازمان فعالی پیدا نشد.");
        const options = (payload.tenants ?? []) as TenantOption[];
        if (!mounted) return;
        setTenantOptions(options);
        const selected = options.length === 1 ? options[0] : options.find((item) => item.id === storedTenant());
        if (!selected) {
          setMessage(options.length ? "برای ادامه، سازمان فعال را انتخاب کنید." : "برای این حساب عضویت فعالی ثبت نشده است.");
          return;
        }
        if (selected.role !== "owner" && selected.role !== "admin") {
          setErrorMessage("این بخش فقط برای مدیر سازمان مجاز است.");
          return;
        }
        saveTenant(selected.id);
        setTenantId(selected.id);
        setTenantName(selected.name);
        await load(selected.id);
      } catch (error) {
        if (mounted) setErrorMessage(error instanceof Error ? error.message : "بارگذاری صفحه ناموفق بود.");
      } finally {
        if (mounted) setReady(true);
      }
    }
    void initialize();
    return () => { mounted = false; };
  }, [router]);

  async function changeTenant(nextId: string) {
    const selected = tenantOptions.find((item) => item.id === nextId);
    if (!selected) return;
    if (selected.role !== "owner" && selected.role !== "admin") {
      setErrorMessage("این بخش فقط برای مدیر سازمان مجاز است.");
      return;
    }
    setBusy(true);
    setTenantId("");
    setData(EMPTY_DATA);
    setMembers([]);
    setEvents([]);
    setErrorMessage("");
    try {
      saveTenant(selected.id);
      setTenantId(selected.id);
      setTenantName(selected.name);
      await load(selected.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "تغییر سازمان ناموفق بود.");
    } finally { setBusy(false); }
  }

  async function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId) return;
    setBusy(true);
    setMessage("");
    setErrorMessage("");
    const formElement = event.currentTarget;
    const raw = Object.fromEntries(new FormData(formElement).entries()) as Record<string, string>;
    const payload: Record<string, unknown> = { ...raw };
    if (activeTab === "memberships") {
      payload.fee_amount = raw.fee_amount ? Number(raw.fee_amount) : null;
    } else if (activeTab === "plans") {
      payload.goals = raw.goals ? raw.goals.split("\n").map((goal) => goal.trim()).filter(Boolean) : [];
    } else if (activeTab === "finances") {
      payload.amount = Number(raw.amount);
    }
    delete payload.goals_text;
    try {
      const response = await fetch("/api/core-sports/club-management", {
        method: "POST", headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ module: active.module, data: payload }),
      });
      const result = await response.json();
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) throw new Error(result.error || "ثبت اطلاعات ناموفق بود.");
      await load(tenantId);
      formElement.reset();
      setMessage("اطلاعات با موفقیت ثبت شد.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ثبت اطلاعات ناموفق بود.");
    } finally { setBusy(false); }
  }

  async function updateRecord(tab: Tab, row: Row, patch: Record<string, unknown>) {
    if (!tenantId || typeof row.id !== "string") return;
    const module = TABS.find((item) => item.id === tab)?.module;
    if (!module) return;
    setBusy(true);
    setMessage("");
    setErrorMessage("");
    try {
      const response = await fetch("/api/core-sports/club-management", {
        method: "PATCH", headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ module, id: row.id, data: patch }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "به‌روزرسانی ناموفق بود.");
      await load(tenantId);
      setMessage("وضعیت رکورد به‌روزرسانی شد.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "به‌روزرسانی ناموفق بود.");
    } finally { setBusy(false); }
  }

  function memberSelect(required = true) {
    return <select name="member_id" required={required} defaultValue="">
      <option value="">انتخاب عضو</option>
      {members.map((member) => <option key={member.id} value={member.id}>{member.full_name}{member.membership_number ? ` · ${member.membership_number}` : ""}</option>)}
    </select>;
  }

  function renderForm() {
    if (activeTab === "memberships") return <>
      <div className="field"><label>عضو</label>{memberSelect()}</div>
      <div className="field"><label>نوع عضویت</label><select name="membership_type" defaultValue="standard"><option value="standard">عادی</option><option value="professional">حرفه‌ای</option><option value="student">دانش‌آموزی / دانشجویی</option><option value="supporter">حامی</option></select></div>
      <div className="field"><label>شروع دوره</label><input name="start_date" type="date" /></div>
      <div className="field"><label>پایان دوره</label><input name="end_date" type="date" /></div>
      <div className="field"><label>مبلغ حق عضویت</label><input name="fee_amount" type="number" min="0" step="0.01" /></div>
      <div className="field"><label>دوره پرداخت</label><select name="billing_period" defaultValue=""><option value="">بدون تعیین</option><option value="monthly">ماهانه</option><option value="quarterly">سه‌ماهه</option><option value="semiannual">شش‌ماهه</option><option value="annual">سالانه</option><option value="one_time">یک‌باره</option></select></div>
      <div className="field"><label>واحد پول</label><select name="currency" defaultValue="IRR"><option value="IRR">ریال (IRR)</option><option value="IRT">تومان (IRT)</option></select></div>
      <div className="field"><label>یادداشت</label><input name="notes" maxLength={1000} /></div>
    </>;
    if (activeTab === "insurance") return <>
      <div className="field"><label>عضو</label>{memberSelect()}</div>
      <div className="field"><label>شرکت / ارائه‌دهنده بیمه</label><input name="provider_name" required minLength={2} maxLength={160} /></div>
      <div className="field"><label>شروع پوشش</label><input name="coverage_start" type="date" /></div>
      <div className="field"><label>پایان پوشش</label><input name="coverage_end" type="date" required /></div>
      <p className="muted full">رکورد جدید با وضعیت «در انتظار بررسی» ثبت می‌شود؛ تأیید بیمه تا زمان افزودن کنترل دیتابیسی مستقل فعال نیست.</p>
    </>;
    if (activeTab === "entries") return <>
      <div className="field"><label>عضو</label>{memberSelect()}</div>
      <div className="field"><label>رویداد</label><select name="event_id" required defaultValue=""><option value="">انتخاب رویداد</option>{events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
      <p className="muted full">ثبت‌نام با وضعیت اولیه «ثبت‌شده» انجام می‌شود.</p>
    </>;
    if (activeTab === "plans") return <>
      <div className="field"><label>ورزشکار</label>{memberSelect()}</div>
      <div className="field"><label>عنوان برنامه</label><input name="title" required minLength={2} maxLength={180} /></div>
      <div className="field"><label>مرحله رشد</label><select name="stage" defaultValue="foundation"><option value="discovery">شناخت استعداد</option><option value="foundation">پایه</option><option value="development">توسعه</option><option value="performance">عملکرد</option><option value="maintenance">نگهداشت</option></select></div>
      <div className="field"><label>تاریخ بازبینی</label><input name="review_date" type="date" /></div>
      <div className="field full"><label>اهداف (هر هدف در یک خط)</label><textarea name="goals" maxLength={3600} /></div>
    </>;
    if (activeTab === "finances") return <>
      <div className="field"><label>نوع سند</label><select name="transaction_type" defaultValue="income"><option value="income">درآمد</option><option value="expense">هزینه</option><option value="refund">بازپرداخت</option><option value="reversal">سند برگشتی</option></select></div>
      <div className="field"><label>دسته‌بندی</label><input name="category" required minLength={2} maxLength={100} /></div>
      <div className="field"><label>مبلغ</label><input name="amount" type="number" required min="0.01" step="0.01" /></div>
      <div className="field"><label>واحد پول</label><select name="currency" defaultValue="IRR"><option value="IRR">ریال (IRR)</option><option value="IRT">تومان (IRT)</option></select></div>
      <div className="field"><label>تاریخ سند</label><input name="transaction_date" type="date" /></div>
      <div className="field"><label>عضو (اختیاری)</label>{memberSelect(false)}</div>
      <div className="field"><label>شناسه سند اصلی برای برگشت</label><input name="reverses_transaction_id" placeholder="فقط برای سند برگشتی" /></div>
      <div className="field"><label>شرح</label><input name="description" maxLength={1000} /></div>
      <p className="muted full">دفتر مالی تغییرناپذیر است؛ اصلاح سند فقط با ثبت سند برگشتی انجام می‌شود.</p>
    </>;
    if (activeTab === "consents") return <>
      <div className="field"><label>ورزشکار</label>{memberSelect()}</div>
      <div className="field"><label>نام سرپرست</label><input name="guardian_name" required minLength={2} maxLength={150} /></div>
      <div className="field"><label>نسبت با ورزشکار</label><input name="relationship" required minLength={2} maxLength={80} /></div>
      <div className="field"><label>راه تماس سرپرست</label><input name="guardian_contact" maxLength={80} /></div>
      <div className="field"><label>موضوع رضایت</label><select name="consent_scope" defaultValue="registration"><option value="registration">ثبت‌نام</option><option value="training">تمرین</option><option value="competition">مسابقه</option><option value="media">تصویر و رسانه</option><option value="data_processing">پردازش داده</option></select></div>
      <div className="field"><label>نسخه متن رضایت</label><input name="consent_version" required maxLength={40} defaultValue="v1" /></div>
      <div className="field"><label>تاریخ انقضا (اختیاری)</label><input name="expires_at" type="date" /></div>
      <p className="muted full">رضایت رسانه‌ای مستقل است و از رضایت ثبت‌نام یا تمرین استنباط نمی‌شود. برای افراد زیر سن قانونی، ثبت رضایت معتبر سرپرست الزامی است.</p>
    </>;
    return <>
      <div className="field"><label>ورزشکار</label>{memberSelect()}</div>
      <div className="field"><label>تاریخ تولد</label><input name="birth_date" type="date" /></div>
      <div className="field"><label>شماره عضویت</label><input name="membership_number" maxLength={40} /></div>
      <div className="field"><label>رده ورزشکار</label><input name="athlete_category" maxLength={80} /></div>
      <div className="field"><label>جنسیت (اختیاری)</label><select name="gender" defaultValue=""><option value="">تعیین نشده</option><option value="female">زن</option><option value="male">مرد</option><option value="unspecified">نامشخص</option></select></div>
      <div className="field"><label>کد ورزشکار</label><input name="athlete_code" maxLength={60} /></div>
      <div className="field"><label>دسته توسعه</label><input name="development_category" maxLength={80} /></div>
      <div className="field"><label>نام تماس اضطراری</label><input name="emergency_contact_name" maxLength={150} /></div>
      <div className="field"><label>تلفن تماس اضطراری</label><input name="emergency_contact_phone" maxLength={30} /></div>
      <p className="muted full">این اطلاعات خصوصی است و فقط مدیر فعال همان سازمان به آن دسترسی دارد.</p>
    </>;
  }

  function renderRows() {
    const rows = data[activeTab];
    if (!rows.length) return <p className="muted">برای این بخش هنوز رکوردی ثبت نشده است.</p>;
    return <div className="club-record-list">{rows.map((row) => (
      <article className="club-record" key={String(row.id)}>
        <div>
          <strong>{rowTitle(activeTab, row)}</strong>
          <p className="muted">{Object.entries(row).filter(([key]) => !["id","tenant_id","created_by","recorded_by"].includes(key)).slice(0, 7).map(([key, value]) => `${key}: ${key.endsWith("_at") || key.endsWith("_date") ? dateLabel(value) : display(value)}`).join(" · ")}</p>
        </div>
        <div className="club-record-actions">
          {activeTab === "memberships" && row.status !== "suspended" && <button className="btn secondary" disabled={busy} onClick={() => void updateRecord(activeTab, row, { status: "suspended", end_date: row.end_date ?? null })}>تعلیق</button>}
          {activeTab === "entries" && row.status === "registered" && <button className="btn secondary" disabled={busy} onClick={() => void updateRecord(activeTab, row, { status: "approved" })}>تأیید حضور</button>}
          {activeTab === "plans" && row.status === "draft" && <button className="btn secondary" disabled={busy} onClick={() => void updateRecord(activeTab, row, { status: "active", review_date: row.review_date ?? null })}>فعال‌سازی</button>}
          {activeTab === "consents" && !row.revoked_at && <button className="btn secondary" disabled={busy} onClick={() => void updateRecord(activeTab, row, { action: "revoke" })}>لغو رضایت</button>}
        </div>
      </article>
    ))}</div>;
  }

  if (!ready) return <main className="shell"><p>در حال بارگذاری مدیریت باشگاه...</p></main>;

  return <>
    <header className="topbar">
      <div className="shell topbar-inner">
        <div><div className="brand">METATYA Sports OS</div><small>مدیریت یکپارچه باشگاه{tenantName ? ` — ${tenantName}` : ""}</small></div>
        <div className="topbar-actions">
          {tenantOptions.length > 1 && <div className="tenant-switcher"><label htmlFor="club-tenant">سازمان فعال</label><select id="club-tenant" value={tenantId} onChange={(event) => void changeTenant(event.target.value)} disabled={busy}><option value="">انتخاب سازمان</option>{tenantOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}
          <Link className="btn secondary" href="/">داشبورد</Link>
          <Link className="btn secondary" href="/members">پرونده اعضا</Link>
        </div>
      </div>
    </header>
    <main className="shell grid gap-4">
      <section className="page-intro"><div><h1 className="page-heading">مدیریت باشگاه</h1><p className="muted">ماژول‌های باشگاه با هویت کاربر، نقش و سازمان فعال در هسته مشترک Sports OS کار می‌کنند.</p></div></section>
      {message && <p className="status" role="status">{message}</p>}
      {errorMessage && <p className="status error" role="alert">{errorMessage}</p>}
      {!tenantId && tenantOptions.length > 1 && <section className="panel"><p>برای ادامه، سازمان را از فهرست بالا انتخاب کنید.</p></section>}
      {tenantId && !errorMessage && <>
        <section className="club-summary">
          {TABS.map((tab) => <button key={tab.id} className="club-summary-card" onClick={() => setActiveTab(tab.id)}><strong>{data[tab.id].length.toLocaleString("fa-IR")}</strong><span>{tab.label}</span></button>)}
        </section>
        <section className="club-tabs" aria-label="ماژول‌های مدیریت باشگاه">
          {TABS.map((tab) => <button key={tab.id} className={activeTab === tab.id ? "club-tab active" : "club-tab"} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
        </section>
        <section className="panel">
          <div className="section-heading-row"><div><h2 className="section-title">{active.label}</h2><p className="muted">{active.description}</p></div><span className="muted">{data[activeTab].length.toLocaleString("fa-IR")} رکورد</span></div>
          <form className="form-grid" onSubmit={submitRecord}>
            {renderForm()}
            <div className="field full"><button className="btn" disabled={busy || members.length === 0}>{busy ? "در حال ثبت..." : "ثبت اطلاعات"}</button></div>
          </form>
        </section>
        <section className="panel"><h2 className="section-title">سوابق {active.label}</h2>{renderRows()}</section>
      </>}
      {busy && <p className="muted" aria-live="polite">در حال پردازش درخواست...</p>}
    </main>
  </>;
}
