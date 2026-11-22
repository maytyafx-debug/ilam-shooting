"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CoreEvent, CoreMember, CoreResult, CoreRole } from "@/lib/core-sports/types";

type ApiError = { error?: string };
type MemberPayload = ApiError & { members?: CoreMember[] };
type EventPayload = ApiError & { events?: CoreEvent[] };
type ResultPayload = ApiError & { results?: CoreResult[] };
type TenantOption = { id: string; name: string; slug: string; role: string };
type TenantPayload = { tenant?: TenantOption | null; tenants?: TenantOption[]; error?: string };

const ACTIVE_TENANT_STORAGE_KEY = "metatya-sports-os-active-tenant";

function readStoredTenantId(): string {
  try {
    return window.sessionStorage.getItem(ACTIVE_TENANT_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function persistActiveTenant(tenantId: string | null) {
  try {
    if (tenantId) window.sessionStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, tenantId);
    else window.sessionStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
  } catch {
    // Storage is a convenience only; the server still verifies every tenant request.
  }
}

function mapRole(role: string): CoreRole {
  if (role === "owner" || role === "admin") return "admin";
  if (role === "referee") return "referee";
  return "member";
}

export default function DashboardPage() {
  const router = useRouter();
  const tenantLoadSequence = useRef(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [activeRole, setActiveRole] = useState<CoreRole | null>(null);
  const [members, setMembers] = useState<CoreMember[]>([]);
  const [events, setEvents] = useState<CoreEvent[]>([]);
  const [results, setResults] = useState<CoreResult[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSportFilter, setMemberSportFilter] = useState("all");
  const [eventSearch, setEventSearch] = useState("");
  const [eventStatusFilter, setEventStatusFilter] = useState("all");
  const [memberId, setMemberId] = useState("");
  const [eventId, setEventId] = useState("");
  const [score, setScore] = useState("");
  const [rank, setRank] = useState("");
  const [notes, setNotes] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [sportType, setSportType] = useState("تیراندازی ورزشی");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [message, setMessage] = useState("");

  const canManage = activeRole === "admin";
  const canRecordResults = activeRole === "admin" || activeRole === "referee";
  const roleLabel = activeRole === "admin"
    ? "مدیر سازمان"
    : activeRole === "referee"
      ? "داور"
      : activeRole === "member"
        ? "عضو"
        : "بدون نقش فعال";

  const normalizedMemberSearch = memberSearch.trim().toLocaleLowerCase();
  const filteredMembers = members.filter((member) => {
    const matchesSearch = !normalizedMemberSearch ||
      member.full_name.toLocaleLowerCase().includes(normalizedMemberSearch) ||
      (member.phone ?? "").toLocaleLowerCase().includes(normalizedMemberSearch);
    const matchesSport = memberSportFilter === "all" || (member.sport_type ?? "") === memberSportFilter;
    return matchesSearch && matchesSport;
  });
  const availableSports = Array.from(new Set(members.map((member) => member.sport_type).filter((sport): sport is string => Boolean(sport))));
  const normalizedEventSearch = eventSearch.trim().toLocaleLowerCase();
  const filteredEvents = events.filter((item) => {
    const matchesSearch = !normalizedEventSearch ||
      item.title.toLocaleLowerCase().includes(normalizedEventSearch) ||
      (item.location ?? "").toLocaleLowerCase().includes(normalizedEventSearch);
    const matchesStatus = eventStatusFilter === "all" || item.status === eventStatusFilter;
    return matchesSearch && matchesStatus;
  });
  const chartEvents = [...events]
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
    .slice(-6)
    .map((item) => ({ ...item, resultCount: results.filter((result) => result.event_id === item.id).length }));
  const chartMax = Math.max(1, ...chartEvents.map((item) => item.resultCount));

  async function loadData(activeTenantId: string, roleOverride?: CoreRole) {
    if (!activeTenantId) throw new Error("سازمان فعال هنوز انتخاب نشده است.");

    const roleForLoad = roleOverride ?? activeRole;
    const requestId = ++tenantLoadSequence.current;
    const headers = { "x-tenant-id": activeTenantId };
    let memberResponse: Response;
    let eventResponse: Response;
    let resultResponse: Response | null = null;

    try {
      [memberResponse, eventResponse] = await Promise.all([
        fetch("/api/core-sports/members", { cache: "no-store", headers }),
        fetch("/api/core-sports/events", { cache: "no-store", headers }),
      ]);
      if (roleForLoad === "admin") {
        resultResponse = await fetch("/api/core-sports/results", { cache: "no-store", headers });
      }
    } catch (error) {
      if (requestId !== tenantLoadSequence.current) return;
      throw error;
    }

    if (requestId !== tenantLoadSequence.current) return;

    const responses = [memberResponse, eventResponse, resultResponse].filter(
      (response): response is Response => response !== null,
    );
    if (responses.some((response) => response.status === 401)) {
      router.replace("/login");
      return;
    }

    let memberPayload: MemberPayload = {};
    let eventPayload: EventPayload = {};
    let resultPayload: ResultPayload = { results: [] };
    try {
      [memberPayload, eventPayload] = await Promise.all([
        memberResponse.json(),
        eventResponse.json(),
      ]);
      if (resultResponse) resultPayload = await resultResponse.json();
    } catch (error) {
      if (requestId !== tenantLoadSequence.current) return;
      throw error;
    }

    if (requestId !== tenantLoadSequence.current) return;

    if (!memberResponse.ok || !eventResponse.ok || (resultResponse !== null && !resultResponse.ok)) {
      const error = new Error(
        (memberPayload as ApiError).error ||
        (eventPayload as ApiError).error ||
        (resultPayload as ApiError).error ||
        "دریافت اطلاعات ناموفق بود.",
      );
      console.error("[Sports OS] dashboard data load failed:", error, {
        tenantId: activeTenantId,
        members: memberPayload,
        events: eventPayload,
        results: resultPayload,
      });
      throw error;
    }

    setMembers(memberPayload.members ?? []);
    setEvents(eventPayload.events ?? []);
    setResults(roleForLoad === "admin" ? resultPayload.results ?? [] : []);
  }

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          router.replace("/login");
          return;
        }

        const tenantResponse = await fetch("/api/core-sports/tenant", { cache: "no-store" });
        const tenantPayload = (await tenantResponse.json()) as TenantPayload;
        if (!tenantResponse.ok) {
          throw new Error(tenantPayload.error || "سازمان فعالی برای این حساب پیدا نشد.");
        }

        const options = tenantPayload.tenants ?? (tenantPayload.tenant ? [tenantPayload.tenant] : []);
        if (options.length === 0) {
          persistActiveTenant(null);
          throw new Error("این حساب عضویت فعال در هیچ سازمانی ندارد.");
        }
        if (!active) return;

        setTenantOptions(options);
        const storedTenantId = readStoredTenantId();
        const selected = options.length === 1
          ? options[0]
          : options.find((tenant) => tenant.id === storedTenantId) ?? null;

        if (!selected) {
          if (storedTenantId) persistActiveTenant(null);
          setMessage("برای مشاهده اطلاعات، ابتدا سازمان فعال را انتخاب کنید.");
          return;
        }

        // Restore only an organization that the server has just verified.
        persistActiveTenant(selected.id);
        const role = mapRole(selected.role);
        setTenantId(selected.id);
        setTenantName(selected.name);
        setActiveRole(role);

        if (role === "member") {
          setMessage("پنل شخصی ورزشکار هنوز فعال نشده است؛ دسترسی اطلاعات سازمانی برای این نقش مسدود است.");
        } else {
          await loadData(selected.id, role);
        }
      } catch (error) {
        console.error("[Sports OS] dashboard initialization failed:", error);
        if (active) {
          setMessage(error instanceof Error ? error.message : "خطای ارتباط با سرویس");
        }
      } finally {
        if (active) setReady(true);
      }
    }

    void init();
    return () => {
      active = false;
      tenantLoadSequence.current += 1;
    };
  }, [router]);

  async function changeTenant(nextTenantId: string) {
    const selected = tenantOptions.find((tenant) => tenant.id === nextTenantId);
    if (!selected) return;

    tenantLoadSequence.current += 1;
    persistActiveTenant(selected.id);
    setBusy(true);
    setMessage("");
    setMembers([]);
    setEvents([]);
    setResults([]);
    setMemberId("");
    setEventId("");
    setScore("");
    setRank("");
    setNotes("");
    setMemberName("");
    setMemberPhone("");
    setSportType("تیراندازی ورزشی");
    setEventTitle("");
    setEventDate("");
    setEventLocation("");
    setTenantId(selected.id);
    setTenantName(selected.name);

    const role = mapRole(selected.role);
    setActiveRole(role);

    try {
      if (role === "member") {
        setMessage("پنل شخصی ورزشکار هنوز فعال نشده است؛ دسترسی اطلاعات سازمانی برای این نقش مسدود است.");
        return;
      }
      await loadData(selected.id, role);
    } catch (error) {
      console.error("[Sports OS] tenant switch failed:", error);
      setMessage(error instanceof Error ? error.message : "بارگذاری سازمان ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function postJson(path: string, body: unknown, activeTenantId: string) {
    if (!activeTenantId) throw new Error("سازمان فعال هنوز انتخاب نشده است.");

    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": activeTenantId,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error((payload as ApiError).error || "عملیات ناموفق بود.");
      console.error("[Sports OS] API request failed:", { path, status: response.status, payload });
      throw error;
    }
    return payload;
  }

  async function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const activeTenantId = tenantId;
      await postJson("/api/core-sports/members", {
        full_name: memberName,
        phone: memberPhone || null,
        sport_type: sportType,
      }, activeTenantId);
      setMemberName("");
      setMemberPhone("");
      await loadData(activeTenantId);
      setMessage("عضو با موفقیت ثبت شد.");
    } catch (error) {
      console.error("[Sports OS] member form failed:", error);
      setMessage(error instanceof Error ? error.message : "ثبت عضو ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const activeTenantId = tenantId;
      const parsedDate = new Date(eventDate);
      if (!Number.isFinite(parsedDate.getTime())) throw new Error("تاریخ رویداد معتبر نیست.");

      await postJson("/api/core-sports/events", {
        title: eventTitle,
        sport_type: sportType,
        event_date: parsedDate.toISOString(),
        location: eventLocation || null,
      }, activeTenantId);
      setEventTitle("");
      setEventDate("");
      setEventLocation("");
      await loadData(activeTenantId);
      setMessage("رویداد با موفقیت ثبت شد.");
    } catch (error) {
      console.error("[Sports OS] event form failed:", error);
      setMessage(error instanceof Error ? error.message : "ثبت رویداد ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function submitResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const activeTenantId = tenantId;
      await postJson("/api/core-sports/results", {
        member_id: memberId,
        event_id: eventId,
        score: score === "" ? null : Number(score),
        rank: rank === "" ? null : Number(rank),
        notes: notes || null,
      }, activeTenantId);
      await loadData(activeTenantId);
      setMessage("نتیجه با موفقیت ثبت شد.");
      setMemberId("");
      setEventId("");
      setScore("");
      setRank("");
      setNotes("");
    } catch (error) {
      console.error("[Sports OS] result form failed:", error);
      setMessage(error instanceof Error ? error.message : "ثبت نتیجه ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshData() {
    if (!tenantId || !canRecordResults) return;
    setBusy(true);
    setMessage("");
    try {
      const activeTenantId = tenantId;
      await loadData(activeTenantId);
      setMessage("اطلاعات به‌روزرسانی شد.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "به‌روزرسانی ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("خروج از حساب انجام نشد.");
      persistActiveTenant(null);
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("[Sports OS] sign out failed:", error);
      setMessage(error instanceof Error ? error.message : "خروج از حساب انجام نشد.");
    }
  }

  if (!ready) return <main className="shell"><p>در حال بارگذاری پنل...</p></main>;

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div>
            <div className="brand">METATYA Sports OS</div>
            <small>هسته مشترک مدیریت ورزش{tenantName ? " — " + tenantName : ""}</small>
          </div>
          <div className="topbar-actions">
            {tenantOptions.length > 1 && (
              <div className="tenant-switcher">
                <label htmlFor="active-tenant">سازمان فعال</label>
                <select
                  id="active-tenant"
                  value={tenantId}
                  disabled={busy}
                  onChange={(event) => void changeTenant(event.target.value)}
                >
                  <option value="">انتخاب سازمان</option>
                  {tenantOptions.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                  ))}
                </select>
              </div>
            )}
            <span className="role-chip">{roleLabel}</span>
            <button className="btn secondary" onClick={signOut}>خروج</button>
          </div>
        </div>
      </header>

      <main className="shell grid gap-4">
        {canManage && (
          <section className="page-intro">
            <div>
              <h1 className="page-heading">داشبورد مدیریتی</h1>
              <p className="muted">مدیریت امن اعضا، رویدادها و نتایج ورزشی در محدوده سازمان فعال</p>
            </div>
            <div className="topbar-actions">
              <a className="btn secondary" href="/specialists">بانک مربیان، داوران و ورزشکاران</a>
              <button className="btn secondary" onClick={refreshData} disabled={busy}>
                {busy ? "در حال پردازش..." : "به‌روزرسانی"}
              </button>
            </div>
          </section>
        )}

        {message && <p className="status" role="status" aria-live="polite">{message}</p>}

        {!tenantId && tenantOptions.length > 1 && (
          <section className="panel empty-state">
            <h2 className="section-title">انتخاب سازمان</h2>
            <p className="muted">این حساب به چند سازمان دسترسی دارد. برای ادامه، سازمان موردنظر را از فهرست بالای صفحه انتخاب کنید.</p>
          </section>
        )}

        {tenantId && activeRole === "member" && (
          <section className="panel empty-state">
            <h2 className="section-title">پنل شخصی ورزشکار</h2>
            <p className="muted">این نقش فقط برای دسترسی شخصی طراحی شده است. تا زمان تکمیل اتصال امن حساب کاربری به پرونده ورزشکار، نمایش و ویرایش اطلاعات شخصی غیرفعال می‌ماند.</p>
          </section>
        )}

        {tenantId && canRecordResults && (
          <>
            {canManage && (
              <>
                <section className="stats">
                  <article className="stat stat-members">
                    <span className="stat-icon" aria-hidden="true">♙</span>
                    <span className="muted">Total Members · اعضا</span>
                    <strong>{members.length.toLocaleString("fa-IR")}</strong>
                    <small>اعضای ثبت‌شده در سازمان فعال</small>
                  </article>
                  <article className="stat stat-events">
                    <span className="stat-icon" aria-hidden="true">▦</span>
                    <span className="muted">Total Events · رویدادها</span>
                    <strong>{events.length.toLocaleString("fa-IR")}</strong>
                    <small>رویدادهای قابل مشاهده</small>
                  </article>
                  <article className="stat stat-results">
                    <span className="stat-icon" aria-hidden="true">▤</span>
                    <span className="muted">Total Results · نتایج</span>
                    <strong>{results.length.toLocaleString("fa-IR")}</strong>
                    <small>نتایج ثبت‌شده</small>
                  </article>
                </section>
                <section className="panel analytics-panel">
                  <div className="section-heading-row">
                    <div>
                      <h2 className="section-title">نمای آماری رویدادها</h2>
                      <p className="muted">تعداد نتایج ثبت‌شده برای شش رویداد اخیر</p>
                    </div>
                    <span className="chart-legend"><i /> تعداد نتایج</span>
                  </div>
                  {chartEvents.length === 0 ? (
                    <p className="muted">برای نمایش نمودار، ابتدا رویدادی ثبت کنید.</p>
                  ) : (
                    <div className="bar-chart" role="img" aria-label="نمودار تعداد نتایج به تفکیک رویداد">
                      {chartEvents.map((item) => (
                        <div className="bar-chart-column" key={item.id}>
                          <strong>{item.resultCount.toLocaleString("fa-IR")}</strong>
                          <div className="bar-chart-track">
                            <div className="bar-chart-fill" style={{ height: `${Math.max(8, (item.resultCount / chartMax) * 100)}%` }} />
                          </div>
                          <span title={item.title}>{item.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {canManage && (
              <section className="panel">
                <h2 className="section-title">ثبت عضو جدید</h2>
                <form className="form-grid" onSubmit={submitMember}>
                  <div className="field">
                    <label htmlFor="member-name">نام و نام خانوادگی</label>
                    <input id="member-name" required maxLength={150} value={memberName} onChange={(event) => setMemberName(event.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="member-phone">شماره تماس (اختیاری)</label>
                    <input id="member-phone" type="tel" maxLength={30} value={memberPhone} onChange={(event) => setMemberPhone(event.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="member-sport">رشته ورزشی</label>
                    <input id="member-sport" maxLength={120} value={sportType} onChange={(event) => setSportType(event.target.value)} />
                  </div>
                  <div className="field full">
                    <button className="btn" disabled={busy || !tenantId}>ثبت عضو</button>
                  </div>
                </form>
              </section>
            )}

            {canManage && (
              <section className="panel">
                <h2 className="section-title">ثبت رویداد جدید</h2>
                <form className="form-grid" onSubmit={submitEvent}>
                  <div className="field">
                    <label htmlFor="event-title">عنوان رویداد</label>
                    <input id="event-title" required maxLength={200} value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="event-date">تاریخ و ساعت</label>
                    <input id="event-date" type="datetime-local" required value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="event-location">محل برگزاری (اختیاری)</label>
                    <input id="event-location" maxLength={250} value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="event-sport">رشته ورزشی</label>
                    <input id="event-sport" maxLength={120} value={sportType} onChange={(event) => setSportType(event.target.value)} />
                  </div>
                  <div className="field full">
                    <button className="btn" disabled={busy || !tenantId}>ثبت رویداد</button>
                  </div>
                </form>
              </section>
            )}

            <section className="panel">
              <h2 className="section-title">ثبت نتیجه رویداد</h2>
              {canRecordResults ? (
                <form className="form-grid" onSubmit={submitResult}>
                  <div className="field">
                    <label htmlFor="member">ورزشکار / عضو</label>
                    <select id="member" required value={memberId} onChange={(event) => setMemberId(event.target.value)}>
                      <option value="">انتخاب عضو</option>
                      {members.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="event">رویداد</label>
                    <select id="event" required value={eventId} onChange={(event) => setEventId(event.target.value)}>
                      <option value="">انتخاب رویداد</option>
                      {events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="score">امتیاز</label>
                    <input id="score" type="number" min="0" step="0.001" value={score} onChange={(event) => setScore(event.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="rank">رتبه</label>
                    <input id="rank" type="number" min="1" step="1" value={rank} onChange={(event) => setRank(event.target.value)} />
                  </div>
                  <div className="field full">
                    <label htmlFor="notes">توضیحات</label>
                    <textarea id="notes" maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
                  </div>
                  <div className="field full">
                    <button className="btn" disabled={busy || members.length === 0 || events.length === 0}>ثبت نتیجه</button>
                  </div>
                </form>
              ) : <p className="muted">دسترسی ثبت نتیجه برای این نقش فعال نیست.</p>}
            </section>

            {canManage && (
              <section className="panel">
                <div className="section-heading-row">
                  <h2 className="section-title">فهرست اعضا</h2>
                  <span className="muted">{filteredMembers.length.toLocaleString("fa-IR")} مورد</span>
                </div>
                <div className="filter-row">
                  <input aria-label="جستجوی اعضا" className="filter-input" placeholder="جستجو بر اساس نام یا شماره تماس..." value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} />
                  <select aria-label="فیلتر رشته ورزشی" className="filter-select" value={memberSportFilter} onChange={(event) => setMemberSportFilter(event.target.value)}>
                    <option value="all">همه رشته‌ها</option>
                    {availableSports.map((sport) => <option key={sport} value={sport}>{sport}</option>)}
                  </select>
                </div>
                {filteredMembers.length === 0
                  ? <p className="muted">{members.length === 0 ? "عضوی ثبت نشده است." : "موردی با این جستجو پیدا نشد."}</p>
                  : <ul className="list">{filteredMembers.map((member) => (
                      <li key={member.id}>
                        {member.full_name}
                        <span className="muted"> — {member.sport_type || "رشته ثبت نشده"}</span>
                      </li>
                    ))}</ul>}
              </section>
            )}

            {canManage && (
              <section className="panel">
                <div className="section-heading-row">
                  <h2 className="section-title">رویدادها</h2>
                  <span className="muted">{filteredEvents.length.toLocaleString("fa-IR")} مورد</span>
                </div>
                <div className="filter-row">
                  <input aria-label="جستجوی رویدادها" className="filter-input" placeholder="جستجو بر اساس عنوان یا محل..." value={eventSearch} onChange={(event) => setEventSearch(event.target.value)} />
                  <select aria-label="فیلتر وضعیت رویداد" className="filter-select" value={eventStatusFilter} onChange={(event) => setEventStatusFilter(event.target.value)}>
                    <option value="all">همه وضعیت‌ها</option>
                    <option value="scheduled">برنامه‌ریزی‌شده</option>
                    <option value="ongoing">در حال برگزاری</option>
                    <option value="completed">پایان‌یافته</option>
                    <option value="cancelled">لغوشده</option>
                  </select>
                </div>
                {filteredEvents.length === 0
                  ? <p className="muted">{events.length === 0 ? "رویدادی ثبت نشده است." : "موردی با این جستجو پیدا نشد."}</p>
                  : <ul className="list">{filteredEvents.map((item) => (
                      <li key={item.id}>
                        {item.title}
                        <span className="muted"> — {new Date(item.event_date).toLocaleDateString("fa-IR")}</span>
                        {item.location && <span className="muted"> — {item.location}</span>}
                      </li>
                    ))}</ul>}
              </section>
            )}

            {canManage && (
              <section className="panel">
              <h2 className="section-title">نتایج ثبت‌شده</h2>
              {results.length === 0
                ? <p className="muted">هنوز نتیجه‌ای ثبت نشده است.</p>
                : <div className="table-wrap">
                    <table className="results-table">
                      <thead><tr><th>ورزشکار</th><th>رویداد</th><th>امتیاز</th><th>رتبه</th><th>توضیحات</th><th>تاریخ ثبت</th></tr></thead>
                      <tbody>{results.map((result) => (
                        <tr key={result.id}>
                          <td>{members.find((member) => member.id === result.member_id)?.full_name ?? "عضو نامشخص"}</td>
                          <td>{events.find((item) => item.id === result.event_id)?.title ?? "رویداد نامشخص"}</td>
                          <td>{result.score ?? "—"}</td>
                          <td>{result.rank ?? "—"}</td>
                          <td>{result.notes || "—"}</td>
                          <td>{new Date(result.created_at).toLocaleDateString("fa-IR")}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>}
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
