"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type TenantOption = { id: string; name: string; slug: string; role: string };
type Member = {
  id: string; tenant_id: string; full_name: string; phone: string | null;
  sport_type: string | null; status: "active" | "inactive" | "suspended";
  membership_number: string | null; birth_date: string | null;
  athlete_category: string | null; joined_on: string; created_at: string; updated_at: string;
};
type HistoryItem = {
  id: string; actor_id: string | null; action: "created" | "updated" | "archived";
  changed_fields: Record<string, boolean>; created_at: string;
};
type FormState = {
  full_name: string; phone: string; sport_type: string; membership_number: string;
  birth_date: string; athlete_category: string; status: "active" | "inactive" | "suspended";
};
type ApiPayload = {
  error?: string; members?: Member[]; member?: Member; history?: HistoryItem[];
  success?: boolean;
};

const ACTIVE_TENANT_STORAGE_KEY = "metatya-sports-os-active-tenant";
const EMPTY_FORM: FormState = {
  full_name: "", phone: "", sport_type: "تیراندازی ورزشی", membership_number: "",
  birth_date: "", athlete_category: "", status: "active",
};

function readStoredTenantId() {
  try { return window.sessionStorage.getItem(ACTIVE_TENANT_STORAGE_KEY) ?? ""; }
  catch { return ""; }
}
function persistTenantId(id: string) {
  try { window.sessionStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, id); }
  catch { /* Session storage is a convenience, never an authorization source. */ }
}
function statusLabel(status: Member["status"]) {
  return status === "active" ? "فعال" : status === "suspended" ? "تعلیق‌شده" : "غیرفعال";
}
function actionLabel(action: HistoryItem["action"]) {
  return action === "created" ? "ایجاد پرونده" : action === "archived" ? "غیرفعال‌سازی" : "ویرایش پرونده";
}
function displayDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("fa-IR");
}

export default function MemberManagementPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [allowed, setAllowed] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [historyMember, setHistoryMember] = useState<Member | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadMembers = useCallback(async (activeTenantId: string) => {
    const response = await fetch("/api/core-sports/member-management", {
      cache: "no-store", headers: { "x-tenant-id": activeTenantId },
    });
    const payload = (await response.json()) as ApiPayload;
    if (response.status === 401) { router.replace("/login"); return; }
    if (!response.ok) throw new Error(payload.error || "دریافت اعضا ناموفق بود.");
    setMembers(payload.members ?? []);
  }, [router]);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) { router.replace("/login"); return; }

        const response = await fetch("/api/core-sports/tenant", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "سازمان فعالی پیدا نشد.");
        const options = (payload.tenants ?? []) as TenantOption[];
        if (!active) return;
        setTenantOptions(options);

        const storedId = readStoredTenantId();
        const selected = options.length === 1
          ? options[0]
          : options.find((item) => item.id === storedId) ?? null;

        if (!selected) { setMessage("برای ادامه، سازمان فعال را انتخاب کنید."); return; }
        if (selected.role !== "owner" && selected.role !== "admin") {
          setErrorMessage("دسترسی این بخش فقط برای مدیر سازمان مجاز است.");
          return;
        }

        persistTenantId(selected.id);
        setTenantId(selected.id);
        setTenantName(selected.name);
        setAllowed(true);
        await loadMembers(selected.id);
      } catch (error) {
        if (active) setErrorMessage(error instanceof Error ? error.message : "بارگذاری صفحه ناموفق بود.");
      } finally {
        if (active) setReady(true);
      }
    }
    void initialize();
    return () => { active = false; };
  }, [loadMembers, router]);

  const filteredMembers = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return members.filter((member) => {
      const matchesSearch = !normalized ||
        member.full_name.toLocaleLowerCase().includes(normalized) ||
        (member.phone ?? "").toLocaleLowerCase().includes(normalized) ||
        (member.membership_number ?? "").toLocaleLowerCase().includes(normalized);
      return matchesSearch && (statusFilter === "all" || member.status === statusFilter);
    });
  }, [members, search, statusFilter]);

  async function changeTenant(nextId: string) {
    const selected = tenantOptions.find((item) => item.id === nextId);
    if (!selected) return;
    setTenantId("");
    setAllowed(false);
    setMembers([]);
    setHistory([]);
    setHistoryMember(null);
    setMessage("");
    setErrorMessage("");
    if (selected.role !== "owner" && selected.role !== "admin") {
      setErrorMessage("دسترسی این بخش فقط برای مدیر سازمان مجاز است.");
      return;
    }
    persistTenantId(selected.id);
    setTenantId(selected.id);
    setTenantName(selected.name);
    setBusy(true);
    try {
      await loadMembers(selected.id);
      setAllowed(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "بارگذاری اعضا ناموفق بود.");
    } finally { setBusy(false); }
  }

  function startCreate() {
    setEditingId("");
    setForm(EMPTY_FORM);
    setMessage("");
    setErrorMessage("");
  }

  function startEdit(member: Member) {
    setEditingId(member.id);
    setForm({
      full_name: member.full_name, phone: member.phone ?? "",
      sport_type: member.sport_type ?? "", membership_number: member.membership_number ?? "",
      birth_date: member.birth_date ?? "", athlete_category: member.athlete_category ?? "",
      status: member.status,
    });
    setMessage("");
    setErrorMessage("");
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId || !allowed) return;
    setBusy(true);
    setMessage("");
    setErrorMessage("");
    try {
      const response = await fetch("/api/core-sports/member-management", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}), ...form,
          phone: form.phone || null, sport_type: form.sport_type || null,
          membership_number: form.membership_number || null,
          birth_date: form.birth_date || null, athlete_category: form.athlete_category || null,
        }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) throw new Error(payload.error || "ذخیره پرونده ناموفق بود.");
      await loadMembers(tenantId);
      setMessage(editingId ? "پرونده عضو با موفقیت ویرایش شد." : "پرونده عضو با موفقیت ایجاد شد.");
      startCreate();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ذخیره پرونده ناموفق بود.");
    } finally { setBusy(false); }
  }

  async function archiveMember(member: Member) {
    if (!tenantId || !allowed || !window.confirm("پرونده «" + member.full_name + "» غیرفعال شود؟ سوابق او حفظ خواهد شد.")) return;
    setBusy(true);
    setMessage("");
    setErrorMessage("");
    try {
      const response = await fetch("/api/core-sports/member-management?id=" + encodeURIComponent(member.id), {
        method: "DELETE", headers: { "x-tenant-id": tenantId },
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) throw new Error(payload.error || "غیرفعال‌سازی ناموفق بود.");
      await loadMembers(tenantId);
      setMessage("پرونده غیرفعال شد و سوابق آن حفظ شد.");
      if (editingId === member.id) startCreate();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "غیرفعال‌سازی ناموفق بود.");
    } finally { setBusy(false); }
  }

  async function openHistory(member: Member) {
    if (!tenantId) return;
    setHistoryMember(member);
    setHistory([]);
    setBusy(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/core-sports/member-management/history?memberId=" + encodeURIComponent(member.id), {
        cache: "no-store", headers: { "x-tenant-id": tenantId },
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) throw new Error(payload.error || "دریافت سوابق ناموفق بود.");
      setHistory(payload.history ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "دریافت سوابق ناموفق بود.");
    } finally { setBusy(false); }
  }

  if (!ready) return <main className="shell"><p>در حال بارگذاری مدیریت اعضا...</p></main>;

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div>
            <div className="brand">METATYA Sports OS</div>
            <small>مدیریت اعضا و ورزشکاران{tenantName ? " — " + tenantName : ""}</small>
          </div>
          <div className="topbar-actions">
            {tenantOptions.length > 1 && (
              <div className="tenant-switcher">
                <label htmlFor="member-tenant">سازمان فعال</label>
                <select id="member-tenant" value={tenantId} disabled={busy} onChange={(event) => void changeTenant(event.target.value)}>
                  <option value="">انتخاب سازمان</option>
                  {tenantOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
            )}
            <span className="role-chip">مدیر سازمان</span>
            <Link className="btn secondary" href="/">بازگشت به داشبورد</Link>
          </div>
        </div>
      </header>

      <main className="shell grid">
        <section className="page-intro">
          <div>
            <h1 className="page-heading">پرونده اعضا و ورزشکاران</h1>
            <p className="muted">ثبت، جستجو، ویرایش و مشاهده سوابق در محدوده سازمان فعال</p>
          </div>
          <button className="btn secondary" type="button" disabled={busy || !allowed} onClick={() => tenantId && void loadMembers(tenantId)}>
            به‌روزرسانی فهرست
          </button>
        </section>

        {message && <p className="status" role="status" aria-live="polite">{message}</p>}
        {errorMessage && <p className="status error" role="alert">{errorMessage}</p>}

        {!tenantId && tenantOptions.length > 1 && (
          <section className="panel empty-state">
            <h2 className="section-title">انتخاب سازمان</h2>
            <p className="muted">برای مشاهده پرونده‌ها، ابتدا سازمان فعال را انتخاب کنید.</p>
          </section>
        )}

        {tenantId && !allowed && (
          <section className="panel empty-state">
            <h2 className="section-title">دسترسی محدود است</h2>
            <p className="muted">مدیریت پرونده‌ها فقط برای مدیران مجاز است.</p>
          </section>
        )}

        {allowed && (
          <>
            <section className="panel">
              <div className="section-heading-row">
                <h2 className="section-title">{editingId ? "ویرایش پرونده عضو" : "ثبت عضو جدید"}</h2>
                {editingId && <button type="button" className="btn secondary" onClick={startCreate}>لغو ویرایش</button>}
              </div>
              <form className="form-grid" onSubmit={submitForm}>
                <div className="field">
                  <label htmlFor="member-full-name">نام و نام خانوادگی *</label>
                  <input id="member-full-name" required minLength={2} maxLength={150} value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="member-phone">شماره تماس</label>
                  <input id="member-phone" type="tel" maxLength={30} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="member-sport">رشته ورزشی</label>
                  <input id="member-sport" maxLength={120} value={form.sport_type} onChange={(event) => setForm({ ...form, sport_type: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="member-number">شماره عضویت</label>
                  <input id="member-number" maxLength={40} value={form.membership_number} onChange={(event) => setForm({ ...form, membership_number: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="member-birth-date">تاریخ تولد</label>
                  <input id="member-birth-date" type="date" max={new Date().toISOString().slice(0, 10)} value={form.birth_date} onChange={(event) => setForm({ ...form, birth_date: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="member-category">رده ورزشی / سنی</label>
                  <input id="member-category" maxLength={80} placeholder="مثلاً نوجوانان، جوانان، بزرگسالان" value={form.athlete_category} onChange={(event) => setForm({ ...form, athlete_category: event.target.value })} />
                </div>
                {editingId && (
                  <div className="field">
                    <label htmlFor="member-status">وضعیت پرونده</label>
                    <select id="member-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as FormState["status"] })}>
                      <option value="active">فعال</option>
                      <option value="inactive">غیرفعال</option>
                      <option value="suspended">تعلیق‌شده</option>
                    </select>
                  </div>
                )}
                <div className="field full">
                  <button className="btn" disabled={busy || !tenantId}>{busy ? "در حال ذخیره..." : editingId ? "ذخیره تغییرات" : "ثبت پرونده عضو"}</button>
                </div>
              </form>
            </section>

            <section className="panel">
              <div className="section-heading-row">
                <h2 className="section-title">فهرست اعضا</h2>
                <span className="muted">{filteredMembers.length.toLocaleString("fa-IR")} از {members.length.toLocaleString("fa-IR")} پرونده</span>
              </div>
              <div className="filter-row">
                <input className="filter-input" aria-label="جستجوی اعضا" placeholder="جستجو بر اساس نام، شماره عضویت یا تماس..." value={search} onChange={(event) => setSearch(event.target.value)} />
                <select className="filter-select" aria-label="فیلتر وضعیت" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">همه وضعیت‌ها</option>
                  <option value="active">فعال</option>
                  <option value="inactive">غیرفعال</option>
                  <option value="suspended">تعلیق‌شده</option>
                </select>
              </div>
              {filteredMembers.length === 0 ? (
                <p className="muted">{members.length === 0 ? "هنوز عضوی ثبت نشده است." : "موردی با این جستجو پیدا نشد."}</p>
              ) : (
                <div className="table-wrap">
                  <table className="results-table">
                    <thead><tr>
                      <th>نام عضو</th><th>شماره عضویت</th><th>رشته / رده</th><th>تاریخ تولد</th><th>تماس</th><th>وضعیت</th><th>عملیات</th>
                    </tr></thead>
                    <tbody>
                      {filteredMembers.map((member) => (
                        <tr key={member.id}>
                          <td>{member.full_name}</td>
                          <td>{member.membership_number || "—"}</td>
                          <td>{[member.sport_type, member.athlete_category].filter(Boolean).join(" / ") || "—"}</td>
                          <td>{displayDate(member.birth_date)}</td>
                          <td>{member.phone || "—"}</td>
                          <td>{statusLabel(member.status)}</td>
                          <td>
                            <div className="topbar-actions">
                              <button className="btn secondary" type="button" disabled={busy} onClick={() => startEdit(member)}>ویرایش</button>
                              <button className="btn secondary" type="button" disabled={busy} onClick={() => void openHistory(member)}>سوابق</button>
                              {member.status !== "inactive" && <button className="btn secondary" type="button" disabled={busy} onClick={() => void archiveMember(member)}>غیرفعال‌سازی</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="muted">برای حفظ سوابق مسابقات و تاریخچه، حذف فیزیکی پرونده انجام نمی‌شود؛ پرونده به وضعیت غیرفعال منتقل می‌شود.</p>
            </section>

            {historyMember && (
              <section className="panel">
                <div className="section-heading-row">
                  <div>
                    <h2 className="section-title">سوابق پرونده: {historyMember.full_name}</h2>
                    <p className="muted">آخرین ۱۰۰ رویداد ثبت‌شده</p>
                  </div>
                  <button className="btn secondary" type="button" onClick={() => { setHistoryMember(null); setHistory([]); }}>بستن</button>
                </div>
                {history.length === 0 ? <p className="muted">هنوز سابقه‌ای ثبت نشده است.</p> : (
                  <ul className="list">
                    {history.map((item) => (
                      <li key={item.id}>
                        <strong>{actionLabel(item.action)}</strong>
                        <span className="muted"> — {new Date(item.created_at).toLocaleString("fa-IR")}</span>
                        <pre dir="ltr" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12 }}>{JSON.stringify(item.changed_fields, null, 2)}</pre>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
