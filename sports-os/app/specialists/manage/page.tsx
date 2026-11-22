"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Tenant = { id: string; name: string; slug: string; role: string };
type Person = { full_name: string; sport_type: string | null };
type Athlete = {
  id: string; athlete_code: string | null; gender: string | null; county: string | null;
  membership_status: string; member: Person;
};
type Coach = {
  id: string; coach_code: string | null; specialty: string | null; coaching_grade: string | null;
  certificate_valid_until: string | null; professional_status: string; member: Person;
};
type Referee = {
  id: string; referee_code: string | null; referee_grade: string | null; permitted_sports: string[];
  card_valid_until: string | null; activity_status: string; member: Person;
};
type Banks = { athletes: Athlete[]; coaches: Coach[]; referees: Referee[] };
type Kind = "athlete" | "coach" | "referee";
type FormValues = Record<string, string>;

const tenantStorageKey = "metatya-sports-os-active-tenant";
const statusLabels: Record<string, string> = {
  pending: "در انتظار بررسی", active: "فعال", inactive: "غیرفعال",
  suspended: "تعلیق‌شده", expired: "منقضی",
};
const optionLabels: Record<string, string> = {
  female: "زن", male: "مرد", unspecified: "اعلام نشده",
  active: "فعال", pending: "در انتظار بررسی", inactive: "غیرفعال",
  suspended: "تعلیق‌شده", expired: "منقضی",
};

export default function SpecialistManagementPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [kind, setKind] = useState<Kind>("athlete");
  const [banks, setBanks] = useState<Banks>({ athletes: [], coaches: [], referees: [] });
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [values, setValues] = useState<FormValues>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  async function loadBanks(id: string) {
    const response = await fetch("/api/core-sports/specialists", {
      cache: "no-store", headers: { "x-tenant-id": id },
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
        const stored = window.sessionStorage.getItem(tenantStorageKey) ?? "";
        const selected = options.length === 1 ? options[0] : options.find((item) => item.id === stored);
        if (!selected) {
          setMessage(options.length ? "سازمان فعال را انتخاب کنید." : "سازمان فعالی پیدا نشد.");
          return;
        }
        if (selected.role !== "owner" && selected.role !== "admin") {
          setMessage("مدیریت پرونده‌ها فقط برای مدیران سازمان فعال است.");
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

  const records = useMemo(() => {
    if (kind === "athlete") return banks.athletes.map((item) => ({
      id: item.id, name: item.member.full_name, sport: item.member.sport_type,
      code: item.athlete_code, detail: item.county, status: item.membership_status,
    }));
    if (kind === "coach") return banks.coaches.map((item) => ({
      id: item.id, name: item.member.full_name, sport: item.member.sport_type,
      code: item.coach_code, detail: item.specialty, status: item.professional_status,
    }));
    return banks.referees.map((item) => ({
      id: item.id, name: item.member.full_name, sport: item.member.sport_type,
      code: item.referee_code, detail: item.referee_grade, status: item.activity_status,
    }));
  }, [banks, kind]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return records;
    return records.filter((item) =>
      [item.name, item.sport, item.code, item.detail, statusLabels[item.status] ?? item.status]
        .some((value) => String(value ?? "").toLocaleLowerCase().includes(term)),
    );
  }, [records, search]);

  function selectRecord(id: string) {
    setSelectedId(id);
    const current = kind === "athlete"
      ? banks.athletes.find((item) => item.id === id)
      : kind === "coach"
        ? banks.coaches.find((item) => item.id === id)
        : banks.referees.find((item) => item.id === id);
    if (!current) return;
    if (kind === "athlete") {
      const item = current as Athlete;
      setValues({
        code: item.athlete_code ?? "", gender: item.gender ?? "", county: item.county ?? "",
        status: item.membership_status,
      });
    } else if (kind === "coach") {
      const item = current as Coach;
      setValues({
        code: item.coach_code ?? "", specialty: item.specialty ?? "", grade: item.coaching_grade ?? "",
        valid_until: item.certificate_valid_until ?? "", status: item.professional_status,
      });
    } else {
      const item = current as Referee;
      setValues({
        code: item.referee_code ?? "", grade: item.referee_grade ?? "",
        permitted_sports: (item.permitted_sports ?? []).join("، "),
        valid_until: item.card_valid_until ?? "", status: item.activity_status,
      });
    }
    setMessage("");
  }

  function changeKind(next: Kind) {
    setKind(next);
    setSelectedId("");
    setValues({});
    setSearch("");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId || !selectedId) return;
    setBusy(true);
    setMessage("");
    const profile: Record<string, unknown> = {
      code: values.code ?? "",
      status: values.status ?? "active",
    };
    if (kind === "athlete") {
      profile.gender = values.gender || null;
      profile.county = values.county || null;
    } else if (kind === "coach") {
      profile.specialty = values.specialty || null;
      profile.grade = values.grade || null;
      profile.valid_until = values.valid_until || null;
    } else {
      profile.grade = values.grade || null;
      profile.valid_until = values.valid_until || null;
      profile.permitted_sports = (values.permitted_sports ?? "").split(/[،,]/)
        .map((item) => item.trim()).filter(Boolean);
    }
    try {
      const response = await fetch(`/api/core-sports/specialists/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ kind, profile }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "ذخیره تغییرات ناموفق بود.");
      await loadBanks(tenantId);
      setMessage("تغییرات پرونده با موفقیت ذخیره شد.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ذخیره تغییرات ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  function field(label: string, key: string, type = "text", options?: string[]) {
    return (
      <div className="field" key={key}>
        <label htmlFor={`edit-${key}`}>{label}</label>
        {options ? (
          <select id={`edit-${key}`} value={values[key] ?? ""} onChange={(event) => setValues((old) => ({ ...old, [key]: event.target.value }))}>
            {options.map((option) => <option key={option} value={option}>{option === "" ? "ثبت نشده" : optionLabels[option] ?? option}</option>)}
          </select>
        ) : (
          <input id={`edit-${key}`} type={type} value={values[key] ?? ""}
            onChange={(event) => setValues((old) => ({ ...old, [key]: event.target.value }))}
            maxLength={key === "permitted_sports" ? 500 : 150} />
        )}
      </div>
    );
  }

  if (!ready) return <main className="shell"><p>در حال آماده‌سازی مدیریت پرونده‌ها...</p></main>;

  const selected = records.find((item) => item.id === selectedId);

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div><div className="brand">METATYA Sports OS</div><small>جست‌وجو و ویرایش پرونده‌ها</small></div>
          <Link className="btn secondary" href="/specialists">بازگشت به بانک‌ها</Link>
        </div>
      </header>
      <main className="shell grid gap-4">
        <section className="page-intro">
          <div>
            <h1 className="page-heading">مدیریت پرونده‌های تخصصی</h1>
            <p className="muted">جست‌وجو و ویرایش اطلاعات تخصصی ورزشکاران، مربیان و داوران در سازمان فعال</p>
          </div>
          <strong className="role-chip">{records.length.toLocaleString("fa-IR")} پرونده</strong>
        </section>

        {tenants.length > 1 && (
          <section className="panel">
            <div className="field">
              <label htmlFor="edit-tenant">سازمان فعال</label>
              <select id="edit-tenant" value={tenantId} onChange={async (event) => {
                const id = event.target.value;
                setTenantId(id); setSelectedId(""); setValues({});
                window.sessionStorage.setItem(tenantStorageKey, id);
                try { setBusy(true); await loadBanks(id); } catch (error) {
                  setMessage(error instanceof Error ? error.message : "دریافت اطلاعات ناموفق بود.");
                } finally { setBusy(false); }
              }}>
                <option value="">انتخاب سازمان</option>
                {tenants.filter((item) => item.role === "owner" || item.role === "admin")
                  .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          </section>
        )}

        {message && <p className="status" role="status" aria-live="polite">{message}</p>}

        <section className="panel">
          <div className="filter-row" role="tablist" aria-label="نوع پرونده">
            <button type="button" className={kind === "athlete" ? "btn" : "btn secondary"} onClick={() => changeKind("athlete")}>ورزشکاران ({banks.athletes.length.toLocaleString("fa-IR")})</button>
            <button type="button" className={kind === "coach" ? "btn" : "btn secondary"} onClick={() => changeKind("coach")}>مربیان ({banks.coaches.length.toLocaleString("fa-IR")})</button>
            <button type="button" className={kind === "referee" ? "btn" : "btn secondary"} onClick={() => changeKind("referee")}>داوران ({banks.referees.length.toLocaleString("fa-IR")})</button>
          </div>
          <div className="field">
            <label htmlFor="specialist-search">جست‌وجو در پرونده‌ها</label>
            <input id="specialist-search" value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="نام، کد، رشته، تخصص یا وضعیت..." />
          </div>
          <p className="muted">{filtered.length.toLocaleString("fa-IR")} نتیجه</p>
          {filtered.length === 0 ? <p className="muted">پرونده‌ای با این جست‌وجو پیدا نشد.</p> : (
            <ul className="list">
              {filtered.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3">
                  <span><strong>{item.name}</strong><span className="muted"> — {item.code || "بدون کد"} · {item.sport || "رشته ثبت نشده"} · {statusLabels[item.status] || item.status}</span></span>
                  <button type="button" className="btn secondary" onClick={() => selectRecord(item.id)}>ویرایش</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selected && (
          <section className="panel">
            <h2 className="section-title">ویرایش پرونده: {selected.name}</h2>
            <p className="muted">این فرم اطلاعات تخصصی پرونده را به‌روزرسانی می‌کند. برای ویرایش نام، تماس، رشته، شماره عضویت، تاریخ تولد و وضعیت پایه عضو از مدیریت اعضا استفاده کنید.</p>
            <Link className="btn secondary" href="/members">بازکردن مدیریت اعضا برای ویرایش اطلاعات پایه</Link>
            <form className="form-grid" onSubmit={submit}>
              {field("کد پرونده / شماره حرفه‌ای", "code")}
              {kind === "athlete" && <>
                {field("جنسیت", "gender", "text", ["", "female", "male", "unspecified"])}
                {field("شهرستان", "county")}
              </>}
              {kind === "coach" && <>
                {field("تخصص / رشته", "specialty")}
                {field("درجه مربیگری", "grade")}
                {field("اعتبار گواهی تا", "valid_until", "date")}
              </>}
              {kind === "referee" && <>
                {field("درجه داوری", "grade")}
                {field("رشته‌های مجاز (با ویرگول جدا شود)", "permitted_sports")}
                {field("اعتبار کارت تا", "valid_until", "date")}
              </>}
              {field("وضعیت (active / pending / inactive / suspended / expired)", "status", "text", ["active", "pending", "inactive", "suspended", "expired"])}
              <div className="field full flex gap-2">
                <button className="btn" disabled={busy}>{busy ? "در حال ذخیره..." : "ذخیره تغییرات"}</button>
                <button type="button" className="btn secondary" disabled={busy} onClick={() => { setSelectedId(""); setValues({}); }}>انصراف</button>
              </div>
            </form>
          </section>
        )}
      </main>
    </>
  );
}
