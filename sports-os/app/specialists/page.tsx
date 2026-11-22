"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Tenant = { id: string; name: string; slug: string; role: string };
type Person = { full_name: string; sport_type: string | null };
type Athlete = { id: string; athlete_code: string | null; gender: string | null; county: string | null; membership_status: string; member: Person };
type Coach = { id: string; coach_code: string | null; specialty: string | null; coaching_grade: string | null; certificate_valid_until: string | null; professional_status: string; member: Person };
type Referee = { id: string; referee_code: string | null; referee_grade: string | null; permitted_sports: string[]; card_valid_until: string | null; activity_status: string; member: Person };
type Banks = { athletes: Athlete[]; coaches: Coach[]; referees: Referee[] };

const tenantStorageKey = "metatya-sports-os-active-tenant";
const emptyBanks: Banks = { athletes: [], coaches: [], referees: [] };

const statusLabels: Record<string, string> = {
  pending: "در انتظار بررسی",
  active: "فعال",
  inactive: "غیرفعال",
  suspended: "تعلیق‌شده",
  expired: "منقضی",
};

export default function SpecialistsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [kind, setKind] = useState<"athlete" | "coach" | "referee">("athlete");
  const [banks, setBanks] = useState<Banks>(emptyBanks);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  async function loadBanks(id: string) {
    const response = await fetch("/api/core-sports/specialists", {
      cache: "no-store",
      headers: { "x-tenant-id": id },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "دریافت بانک‌ها ناموفق بود.");
    setBanks({
      athletes: payload.athletes ?? [],
      coaches: payload.coaches ?? [],
      referees: payload.referees ?? [],
    });
  }

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const response = await fetch("/api/core-sports/tenant", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "دسترسی سازمان تأیید نشد.");
        const options: Tenant[] = payload.tenants ?? (payload.tenant ? [payload.tenant] : []);
        if (!active) return;
        setTenants(options);
        const stored = typeof window !== "undefined" ? window.sessionStorage.getItem(tenantStorageKey) ?? "" : "";
        const selected = options.length === 1 ? options[0] : options.find((item) => item.id === stored);
        if (!selected) {
          setMessage(options.length ? "سازمان فعال را انتخاب کنید." : "برای این حساب سازمان فعالی پیدا نشد.");
          return;
        }
        if (selected.role !== "owner" && selected.role !== "admin") {
          setMessage("مدیریت بانک‌های اطلاعاتی فقط برای مدیران سازمان فعال است.");
          return;
        }
        setTenantId(selected.id);
        await loadBanks(selected.id);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "خطای ارتباط با سرویس.");
      } finally {
        if (active) setReady(true);
      }
    }
    void init();
    return () => { active = false; };
  }, []);

  async function changeTenant(id: string) {
    const selected = tenants.find((item) => item.id === id);
    setTenantId(id);
    setBanks(emptyBanks);
    setMessage("");
    if (!selected) return;
    if (selected.role !== "owner" && selected.role !== "admin") {
      setMessage("مدیریت بانک‌های اطلاعاتی فقط برای مدیران سازمان فعال است.");
      return;
    }
    setBusy(true);
    try {
      window.sessionStorage.setItem(tenantStorageKey, id);
      await loadBanks(id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "دریافت اطلاعات ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!tenantId) return;
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const profile: Record<string, unknown> = {
      code: value("code"),
      status: value("status") || "active",
    };
    if (kind === "athlete") {
      profile.gender = value("gender") || null;
      profile.county = value("county") || null;
    } else if (kind === "coach") {
      profile.specialty = value("specialty") || null;
      profile.grade = value("grade") || null;
      profile.valid_until = value("valid_until") || null;
    } else {
      profile.grade = value("grade") || null;
      profile.valid_until = value("valid_until") || null;
      profile.permitted_sports = value("permitted_sports").split(/[،,]/).map((item) => item.trim()).filter(Boolean);
    }

    try {
      const response = await fetch("/api/core-sports/specialists", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({
          kind,
          full_name: value("full_name"),
          sport_type: value("sport_type"),
          profile,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "ثبت اطلاعات ناموفق بود.");
      formElement.reset();
      await loadBanks(tenantId);
      setMessage("پرونده با موفقیت ثبت شد و در فهرست همین بخش قرار گرفت.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ثبت اطلاعات ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  const count = banks.athletes.length + banks.coaches.length + banks.referees.length;

  if (!ready) return <main className="shell"><p>در حال آماده‌سازی بانک‌های اطلاعاتی...</p></main>;

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div>
            <div className="brand">METATYA Sports OS</div>
            <small>بانک‌های اطلاعات تخصصی</small>
          </div>
          <div className="topbar-actions"><Link className="btn secondary" href="/specialists/manage">جست‌وجو و ویرایش پرونده‌ها</Link><Link className="btn secondary" href="/">بازگشت به داشبورد</Link></div>
        </div>
      </header>

      <main className="shell grid gap-4">
        <section className="page-intro">
          <div>
            <h1 className="page-heading">بانک اطلاعات مربیان، داوران و ورزشکاران</h1>
            <p className="muted">ثبت و نگهداری پرونده‌های تخصصی در محدوده سازمان فعال؛ اطلاعات فقط با داده معتبر ثبت شود.</p>
          </div>
          <strong className="role-chip">{count.toLocaleString("fa-IR")} پرونده</strong>
        </section>

        {tenants.length > 1 && (
          <section className="panel">
            <div className="field">
              <label htmlFor="specialist-tenant">سازمان فعال</label>
              <select id="specialist-tenant" value={tenantId} onChange={(event) => void changeTenant(event.target.value)}>
                <option value="">انتخاب سازمان</option>
                {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
              </select>
            </div>
          </section>
        )}

        {message && <p className="status" role="status" aria-live="polite">{message}</p>}

        <section className="panel">
          <div className="filter-row" role="tablist" aria-label="نوع پرونده">
            <button type="button" className={kind === "athlete" ? "btn" : "btn secondary"} onClick={() => setKind("athlete")}>ورزشکاران ({banks.athletes.length.toLocaleString("fa-IR")})</button>
            <button type="button" className={kind === "coach" ? "btn" : "btn secondary"} onClick={() => setKind("coach")}>مربیان ({banks.coaches.length.toLocaleString("fa-IR")})</button>
            <button type="button" className={kind === "referee" ? "btn" : "btn secondary"} onClick={() => setKind("referee")}>داوران ({banks.referees.length.toLocaleString("fa-IR")})</button>
          </div>
          <h2 className="section-title">ثبت پرونده {kind === "athlete" ? "ورزشکار" : kind === "coach" ? "مربی" : "داور"}</h2>
          <form className="form-grid" onSubmit={submit}>
            <div className="field">
              <label htmlFor="specialist-name">نام و نام خانوادگی</label>
              <input id="specialist-name" name="full_name" required minLength={2} maxLength={150} />
            </div>
            <div className="field">
              <label htmlFor="specialist-sport">رشته / حوزه ورزشی</label>
              <input id="specialist-sport" name="sport_type" maxLength={120} defaultValue="تیراندازی ورزشی" />
            </div>
            <div className="field">
              <label htmlFor="specialist-code">کد پرونده / شماره حرفه‌ای</label>
              <input id="specialist-code" name="code" maxLength={50} />
            </div>

            {kind === "athlete" && (
              <>
                <div className="field">
                  <label htmlFor="athlete-gender">جنسیت (اختیاری)</label>
                  <select id="athlete-gender" name="gender" defaultValue="">
                    <option value="">ثبت نشده</option>
                    <option value="female">زن</option>
                    <option value="male">مرد</option>
                    <option value="unspecified">اعلام نشده</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="athlete-county">شهرستان</label>
                  <input id="athlete-county" name="county" maxLength={100} />
                </div>
              </>
            )}

            {kind === "coach" && (
              <>
                <div className="field">
                  <label htmlFor="coach-specialty">تخصص / رشته</label>
                  <input id="coach-specialty" name="specialty" maxLength={150} />
                </div>
                <div className="field">
                  <label htmlFor="coach-grade">درجه مربیگری</label>
                  <input id="coach-grade" name="grade" maxLength={100} />
                </div>
                <div className="field">
                  <label htmlFor="coach-valid">اعتبار گواهی تا</label>
                  <input id="coach-valid" name="valid_until" type="date" />
                </div>
              </>
            )}

            {kind === "referee" && (
              <>
                <div className="field">
                  <label htmlFor="referee-grade">درجه داوری</label>
                  <input id="referee-grade" name="grade" maxLength={100} />
                </div>
                <div className="field">
                  <label htmlFor="referee-sports">رشته‌های مجاز (با ویرگول جدا شود)</label>
                  <input id="referee-sports" name="permitted_sports" maxLength={500} />
                </div>
                <div className="field">
                  <label htmlFor="referee-valid">اعتبار کارت تا</label>
                  <input id="referee-valid" name="valid_until" type="date" />
                </div>
              </>
            )}

            <div className="field">
              <label htmlFor="specialist-status">وضعیت پرونده</label>
              <select id="specialist-status" name="status" defaultValue="active">
                <option value="active">فعال</option>
                <option value="pending">در انتظار بررسی</option>
                <option value="inactive">غیرفعال</option>
                <option value="suspended">تعلیق‌شده</option>
                <option value="expired">منقضی</option>
              </select>
            </div>
            <div className="field full">
              <button className="btn" disabled={busy || !tenantId}>{busy ? "در حال ثبت..." : "ثبت پرونده"}</button>
            </div>
          </form>
        </section>

        <section className="panel">
          <h2 className="section-title">فهرست {kind === "athlete" ? "ورزشکاران" : kind === "coach" ? "مربیان" : "داوران"}</h2>
          {kind === "athlete" && (banks.athletes.length === 0
            ? <p className="muted">هنوز پرونده ورزشکاری ثبت نشده است.</p>
            : <ul className="list">{banks.athletes.map((item) => (
                <li key={item.id}>
                  <strong>{item.member.full_name}</strong>
                  <span className="muted"> — {item.athlete_code || "بدون کد"} · {item.member.sport_type || "رشته ثبت نشده"} · {statusLabels[item.membership_status] || item.membership_status}</span>
                </li>
              ))}</ul>)}
          {kind === "coach" && (banks.coaches.length === 0
            ? <p className="muted">هنوز پرونده مربی ثبت نشده است.</p>
            : <ul className="list">{banks.coaches.map((item) => (
                <li key={item.id}>
                  <strong>{item.member.full_name}</strong>
                  <span className="muted"> — {item.coach_code || "بدون کد"} · {item.specialty || "تخصص ثبت نشده"} · {item.coaching_grade || "درجه ثبت نشده"} · {statusLabels[item.professional_status] || item.professional_status}</span>
                </li>
              ))}</ul>)}
          {kind === "referee" && (banks.referees.length === 0
            ? <p className="muted">هنوز پرونده داور ثبت نشده است.</p>
            : <ul className="list">{banks.referees.map((item) => (
                <li key={item.id}>
                  <strong>{item.member.full_name}</strong>
                  <span className="muted"> — {item.referee_code || "بدون کد"} · {item.referee_grade || "درجه ثبت نشده"} · {statusLabels[item.activity_status] || item.activity_status}</span>
                </li>
              ))}</ul>)}
        </section>
      </main>
    </>
  );
}
